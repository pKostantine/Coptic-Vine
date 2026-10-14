import { tr } from './appText';

/**
 * What the account flow says when something fails, in the App Language. Kept
 * here rather than in AuthContext so a plain module can throw them, and so
 * the Account screen's own fallbacks say the same thing the context does.
 */
const MESSAGES = {
  googleNotEnabled: [
    'Google sign-in is not enabled for Coptic Vine yet. Please use email for now.',
    'La connexion Google n’est pas encore activée pour Coptic Vine. Utilisez votre e-mail pour le moment.',
    'تسجيل الدخول عبر Google غير مفعّل في كوبتك فاين بعد. استخدم البريد الإلكتروني حاليًا.',
  ],
  finishSignIn: ['Unable to finish signing in.', 'Impossible de terminer la connexion.', 'تعذّر إكمال تسجيل الدخول.'],
  signIn: ['Unable to sign in.', 'Impossible de se connecter.', 'تعذّر تسجيل الدخول.'],
  signInWithGoogle: ['Unable to sign in with Google.', 'Impossible de se connecter avec Google.', 'تعذّر تسجيل الدخول عبر Google.'],
  createAccount: ['Unable to create your account.', 'Impossible de créer votre compte.', 'تعذّر إنشاء حسابك.'],
  startGoogle: ['Unable to start Google sign-in.', 'Impossible de lancer la connexion Google.', 'تعذّر بدء تسجيل الدخول عبر Google.'],
  googleNoUrl: ['Google did not return a sign-in URL.', 'Google n’a pas renvoyé d’adresse de connexion.', 'لم يُرجع Google رابط تسجيل الدخول.'],
  googleIncomplete: ['Google sign-in did not complete.', 'La connexion Google n’a pas abouti.', 'لم يكتمل تسجيل الدخول عبر Google.'],
  passwordReset: ['Unable to send a password reset email.', 'Impossible d’envoyer l’e-mail de réinitialisation.', 'تعذّر إرسال بريد إعادة تعيين كلمة المرور.'],
  resendConfirmation: ['Unable to resend the confirmation email.', 'Impossible de renvoyer l’e-mail de confirmation.', 'تعذّر إعادة إرسال بريد التأكيد.'],
  updateProfile: ['Unable to update your profile.', 'Impossible de mettre à jour votre profil.', 'تعذّر تحديث ملفك الشخصي.'],
  updateEmail: ['Unable to update your email address.', 'Impossible de mettre à jour votre adresse e-mail.', 'تعذّر تحديث بريدك الإلكتروني.'],
  updatePhoto: ['Unable to update your profile photo.', 'Impossible de mettre à jour votre photo de profil.', 'تعذّر تحديث صورة ملفك الشخصي.'],
  removePhoto: ['Unable to remove your profile photo.', 'Impossible de supprimer votre photo de profil.', 'تعذّر إزالة صورة ملفك الشخصي.'],
  updatePassword: ['Unable to update your password.', 'Impossible de mettre à jour votre mot de passe.', 'تعذّر تحديث كلمة المرور.'],
  signOut: ['Unable to sign out.', 'Impossible de se déconnecter.', 'تعذّر تسجيل الخروج.'],
} as const satisfies Record<string, readonly [string, string, string]>;

export type AuthMessageKey = keyof typeof MESSAGES;

/** One of the account flow's messages, in the App Language. */
export function authMessage(key: AuthMessageKey): string {
  const [english, french, arabic] = MESSAGES[key];
  return tr(english, french, arabic);
}
