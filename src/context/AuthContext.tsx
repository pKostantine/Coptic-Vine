import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { accountAuth } from '@/services/accountAuth';
import { disableNativeNotificationDevice } from '@/services/notificationService';
import { disableWebPushDevice } from '@/services/webPushService';
import type { AccountSession, AccountUser } from '@/types/account';
import { settleWithin } from '@/utils/settleWithin';

WebBrowser.maybeCompleteAuthSession();

interface SignUpResult {
  confirmationRequired: boolean;
}

interface AuthContextValue {
  session: AccountSession | null;
  user: AccountUser | null;
  loading: boolean;
  recoveryMode: boolean;
  /** Whether a new password needs the current one beside it (cv-api). */
  needsCurrentPassword: boolean;
  /** Whether this user can change their password here: one who only signs in with Google may have none. */
  canChangePassword: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  updateAvatarUrl: (avatarUrl: string | null) => Promise<void>;
  updatePassword: (password: string, currentPassword?: string) => Promise<void>;
  clearRecoveryMode: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** How long sign-out waits for the notification detach before going ahead regardless. */
const DEVICE_DETACH_TIMEOUT_MS = 4000;

function accountRedirectUrl() {
  return Linking.createURL('account');
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = accountAuth.onChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      // A reset left unfinished doesn't wait for whoever signs in next.
      if (event === 'SIGNED_OUT') setRecoveryMode(false);
    });

    const initialize = async () => {
      if (Platform.OS !== 'web' || accountAuth.readsWebCallbacks) {
        try {
          const initialUrl = Platform.OS === 'web' ? window.location.href : await Linking.getInitialURL();
          if (initialUrl) await accountAuth.applyCallback(initialUrl);
        } catch (error) {
          console.warn('Unable to process the initial Coptic Vine sign-in link:', error);
        }
      }
      let restored: AccountSession | null = null;
      try {
        restored = await accountAuth.getSession();
      } catch (error) {
        console.warn('Unable to restore Coptic Vine session:', error instanceof Error ? error.message : error);
      }
      if (mounted) {
        setSession(restored);
        setLoading(false);
      }
    };
    void initialize();

    const linkSubscription = Platform.OS === 'web'
      ? null
      : Linking.addEventListener('url', ({ url }) => {
        void accountAuth.applyCallback(url).catch((error) => {
          console.warn('Unable to process Coptic Vine sign-in link:', error);
        });
      });

    return () => {
      mounted = false;
      unsubscribe();
      linkSubscription?.remove();
    };
  }, []);

  const signInWithEmail = useCallback((email: string, password: string) => accountAuth.signInWithEmail(email, password), []);

  const signUpWithEmail = useCallback(
    (email: string, password: string, displayName: string) => accountAuth.signUpWithEmail(email, password, displayName, accountRedirectUrl()),
    [],
  );

  const signInWithGoogle = useCallback(() => accountAuth.signInWithGoogle(accountRedirectUrl()), []);

  const sendPasswordReset = useCallback((email: string) => accountAuth.sendPasswordReset(email, accountRedirectUrl()), []);

  const resendSignupConfirmation = useCallback((email: string) => accountAuth.resendSignupConfirmation(email, accountRedirectUrl()), []);

  const updateDisplayName = useCallback((displayName: string) => accountAuth.updateDisplayName(displayName), []);

  const updateEmail = useCallback((email: string) => accountAuth.updateEmail(email, accountRedirectUrl()), []);

  const updateAvatarUrl = useCallback((avatarUrl: string | null) => accountAuth.updateAvatarUrl(avatarUrl), []);

  const updatePassword = useCallback(async (password: string, currentPassword?: string) => {
    await accountAuth.updatePassword(password, currentPassword);
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
    await accountAuth.signOut();
  }, []);

  const user = session?.user ?? null;
  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    loading,
    recoveryMode,
    needsCurrentPassword: accountAuth.needsCurrentPassword,
    canChangePassword: user ? accountAuth.canChangePassword(user) : false,
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
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
