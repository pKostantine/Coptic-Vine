import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { cvApiAuth } from '@/services/userApi';
import type { AccountAuth } from '@/types/account';
import { authMessage } from '@/utils/authMessages';
import { supabase } from '@/utils/supabase';

/**
 * Signing in, from whichever source src/services/userApi.ts says: Supabase
 * Auth (below, until the cutover) or cv-api's Better Auth
 * (src/services/cvApiAuth.ts). AuthContext and the services ask this, never
 * supabase.auth, which the cv-api client doesn't have.
 */

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

const supabaseAuth: AccountAuth = {
  needsCurrentPassword: false,
  // supabase-js reads the web's sign-in links itself (detectSessionInUrl).
  readsWebCallbacks: false,
  canChangePassword: () => true,

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  onChange(listener) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(listener);
    return () => subscription.unsubscribe();
  },

  applyCallback: applyAuthCallback,

  async signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    authError(error, authMessage('signIn'));
  },

  async signUpWithEmail(email, password, displayName, redirectTo) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: displayName.trim() },
      },
    });
    authError(error, authMessage('createAccount'));
    return { confirmationRequired: data.session == null };
  },

  async signInWithGoogle(redirectTo) {
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
  },

  async sendPasswordReset(email, redirectTo) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    authError(error, authMessage('passwordReset'));
  },

  async resendSignupConfirmation(email, redirectTo) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo },
    });
    authError(error, authMessage('resendConfirmation'));
  },

  async updateDisplayName(displayName) {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    authError(error, authMessage('updateProfile'));
  },

  async updateEmail(email, redirectTo) {
    const { error } = await supabase.auth.updateUser(
      { email: email.trim().toLowerCase() },
      { emailRedirectTo: redirectTo },
    );
    authError(error, authMessage('updateEmail'));
  },

  async updateAvatarUrl(avatarUrl) {
    const { error } = await supabase.auth.updateUser({
      data: { chc_avatar_url: avatarUrl },
    });
    authError(error, authMessage('updatePhoto'));
  },

  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    authError(error, authMessage('updatePassword'));
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    // The client drops this device's session before it reports that the
    // server could not be reached, so a sign-out with no connection has
    // still signed this device out (only the refresh token outlives it on
    // the server, until it expires). Anything else is a real failure.
    if (error && !isAuthRetryableFetchError(error)) authError(error, authMessage('signOut'));
  },
};

export const accountAuth: AccountAuth = cvApiAuth ?? supabaseAuth;
