import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { disableNativeNotificationDevice } from '@/services/notificationService';
import { disableWebPushDevice } from '@/services/webPushService';
import { authMessage } from '@/utils/authMessages';
import { settleWithin } from '@/utils/settleWithin';
import { supabase } from '@/utils/supabase';

WebBrowser.maybeCompleteAuthSession();

interface SignUpResult {
  confirmationRequired: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  recoveryMode: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  updateAvatarUrl: (avatarUrl: string | null) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearRecoveryMode: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** How long sign-out waits for the notification detach before going ahead regardless. */
const DEVICE_DETACH_TIMEOUT_MS = 4000;

function accountRedirectUrl() {
  return Linking.createURL('account');
}

function authError(error: { message: string } | null, fallback: string) {
  if (!error) return;
  if (/provider is not enabled|unsupported provider/i.test(error.message)) {
    throw new Error(authMessage('googleNotEnabled'));
  }
  throw new Error(error.message || fallback);
}

async function applyAuthCallback(url: string) {
  const parsed = new URL(url);
  const query = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const getParameter = (key: string) => query.get(key) ?? fragment.get(key);
  const callbackError = getParameter('error_description') ?? getParameter('error');

  if (callbackError) {
    throw new Error(decodeURIComponent(callbackError.replace(/\+/g, ' ')));
  }

  const code = getParameter('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError(error, authMessage('finishSignIn'));
    return;
  }

  const accessToken = getParameter('access_token');
  const refreshToken = getParameter('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    authError(error, authMessage('finishSignIn'));
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });

    const initialize = async () => {
      if (Platform.OS !== 'web') {
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) await applyAuthCallback(initialUrl);
        } catch (error) {
          console.warn('Unable to process the initial Coptic Vine sign-in link:', error);
        }
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn('Unable to restore Coptic Vine session:', error.message);
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    };
    void initialize();

    const linkSubscription = Platform.OS === 'web'
      ? null
      : Linking.addEventListener('url', ({ url }) => {
        void applyAuthCallback(url).catch((error) => {
          console.warn('Unable to process Coptic Vine sign-in link:', error);
        });
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkSubscription?.remove();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    authError(error, authMessage('signIn'));
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: accountRedirectUrl(),
        data: { full_name: displayName.trim() },
      },
    });
    authError(error, authMessage('createAccount'));
    return { confirmationRequired: data.session == null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = accountRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });
    authError(error, authMessage('startGoogle'));

    if (Platform.OS !== 'web') {
      if (!data.url) throw new Error(authMessage('googleNoUrl'));
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        await applyAuthCallback(result.url);
      } else if (result.type !== 'dismiss' && result.type !== 'cancel') {
        throw new Error(authMessage('googleIncomplete'));
      }
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: accountRedirectUrl(),
    });
    authError(error, authMessage('passwordReset'));
  }, []);

  const resendSignupConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: accountRedirectUrl() },
    });
    authError(error, authMessage('resendConfirmation'));
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    authError(error, authMessage('updateProfile'));
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.updateUser(
      { email: email.trim().toLowerCase() },
      { emailRedirectTo: accountRedirectUrl() },
    );
    authError(error, authMessage('updateEmail'));
  }, []);

  const updateAvatarUrl = useCallback(async (avatarUrl: string | null) => {
    const { error } = await supabase.auth.updateUser({
      data: { chc_avatar_url: avatarUrl },
    });
    authError(error, authMessage('updatePhoto'));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    authError(error, authMessage('updatePassword'));
    setRecoveryMode(false);
  }, []);

  const signOut = useCallback(async () => {
    // Detaching this device from notifications is courtesy work, and the
    // session has to go whatever happens to it.
    await settleWithin(
      [disableNativeNotificationDevice(), disableWebPushDevice()],
      DEVICE_DETACH_TIMEOUT_MS,
      'Unable to detach this device from Coptic Vine notifications before sign-out',
    );

    const { error } = await supabase.auth.signOut();
    // The client drops this device's session before it reports that the
    // server could not be reached, so a sign-out with no connection has
    // still signed this device out (only the refresh token outlives it on
    // the server, until it expires). Anything else is a real failure.
    if (error && !isAuthRetryableFetchError(error)) authError(error, authMessage('signOut'));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    recoveryMode,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPasswordReset,
    resendSignupConfirmation,
    updateDisplayName,
    updateEmail,
    updateAvatarUrl,
    updatePassword,
    clearRecoveryMode: () => setRecoveryMode(false),
    signOut,
  }), [
    loading,
    recoveryMode,
    resendSignupConfirmation,
    sendPasswordReset,
    session,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    signUpWithEmail,
    updateDisplayName,
    updateEmail,
    updateAvatarUrl,
    updatePassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
