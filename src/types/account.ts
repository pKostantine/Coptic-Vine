/**
 * The signed-in account as the app reads it, and what signing in can do: the
 * same for Supabase Auth and for cv-api's Better Auth (src/services/accountAuth.ts).
 * The user keeps Supabase's shape, which both hand out, so the screens read it
 * one way.
 */
export interface AccountUser {
  id: string;
  email?: string;
  /** Set once the email is confirmed. */
  email_confirmed_at?: string;
  /** full_name; cv_avatar_url, the photo the user uploaded; avatar_url, Google's. */
  user_metadata: { [key: string]: unknown };
  /** provider, how the account was first signed in to ('email' or 'google'); providers, every way it can be. */
  app_metadata: { provider?: string; providers?: string[]; [key: string]: unknown };
}

export interface AccountSession {
  user: AccountUser;
}

export type AccountEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'TOKEN_REFRESHED' | 'PASSWORD_RECOVERY' | 'MFA_CHALLENGE_VERIFIED';

export interface AccountAuth {
  /** Whether changing the password asks for the current one. */
  readonly needsCurrentPassword: boolean;
  /** Whether the web app hands its own address to applyCallback when it opens (Supabase reads it itself). */
  readonly readsWebCallbacks: boolean;
  /** Whether this user can change their password here (one who only signs in with Google may have none). */
  canChangePassword(user: AccountUser): boolean;
  /** This device's session, without waiting on the network when it is known. */
  getSession(): Promise<AccountSession | null>;
  /** The signed-in user, checked with the server where the backend does. */
  getUser(): Promise<AccountUser | null>;
  /** Called on every change of session; returns the unsubscribe. */
  onChange(listener: (event: AccountEvent, session: AccountSession | null) => void): () => void;
  /** A sign-in, confirmation or password-reset link that brought the app back. */
  applyCallback(url: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string, displayName: string, redirectTo: string): Promise<{ confirmationRequired: boolean }>;
  signInWithGoogle(redirectTo: string): Promise<void>;
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;
  resendSignupConfirmation(email: string, redirectTo: string): Promise<void>;
  updateDisplayName(displayName: string): Promise<void>;
  updateEmail(email: string, redirectTo: string): Promise<void>;
  updateAvatarUrl(avatarUrl: string | null): Promise<void>;
  /** A new password: after a reset link, or, signed in, in place of the current one. */
  updatePassword(password: string, currentPassword?: string): Promise<void>;
  signOut(): Promise<void>;
}
