'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '@/components/vine/ui/AppHeader';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { pickAndUploadProfileAvatar, removeProfileAvatar } from '@/services/profileAvatarService';
import { authMessage } from '@/utils/authMessages';
import { getCurrentAppLanguage, type AppLanguage } from '@/utils/preferencesStorage';

import { tr } from '../utils/appText';
// Each language also named in itself, so it can be found whatever the app is showing.
const APP_LANGUAGE_OPTIONS: { key: AppLanguage; label: string; native: string }[] = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'fr', label: 'French', native: 'Français' },
  { key: 'ar', label: 'Arabic', native: 'العربية' },
];

export default function AccountScreen() {
  const { preferences } = useReadingPreferences();
  const { user, loading, recoveryMode } = useAuth();
  const isArabic = preferences.appLanguage === 'ar';

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head><title>{`${tr('Account', 'Compte', 'الحساب')} — Coptic Vine`}</title></Head>
      <AppHeader
        title={{ english: 'Account', arabic: 'الحساب', french: 'Compte' }}
        visibleLanguages={{ english: !isArabic, arabic: isArabic }}
      />
      <NowPlayingAwareScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {loading ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
          {!loading && user ? <SignedInAccount key={user.id} recoveryMode={recoveryMode} /> : null}
          {!loading && !user ? <SignedOutAccount /> : null}
          <AppSettingsSection />
        </View>
      </NowPlayingAwareScrollView>
      <BottomTabBar active="account" />
    </SafeAreaView>
  );
}

function SignedOutAccount() {
  const auth = useAuth();
  const { preferences } = useReadingPreferences();
  const isArabic = preferences.appLanguage === 'ar';
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const validateEmail = () => {
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error(tr('Enter a valid email address.', 'Saisissez une adresse e-mail valide.', 'أدخل بريدًا إلكترونيًا صالحًا.'));
    return normalized;
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    setNotice(null);
    try {
      const normalizedEmail = validateEmail();
      if (password.length < 8) throw new Error(tr('Your password must be at least 8 characters.', 'Votre mot de passe doit contenir au moins 8 caractères.', 'يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل.'));
      if (mode === 'signUp') {
        if (!displayName.trim()) throw new Error(tr('Enter your name.', 'Saisissez votre nom.', 'أدخل اسمك.'));
        if (password !== confirmPassword) throw new Error(tr('The passwords do not match.', 'Les mots de passe ne correspondent pas.', 'كلمتا المرور غير متطابقتين.'));
      }
      setBusy(true);
      if (mode === 'signIn') {
        await auth.signInWithEmail(normalizedEmail, password);
      } else {
        const result = await auth.signUpWithEmail(normalizedEmail, password, displayName);
        if (result.confirmationRequired) {
          setConfirmationEmail(normalizedEmail);
          setNotice(tr(
            'Check your email and open the confirmation link to finish creating your account.',
            'Consultez votre e-mail et ouvrez le lien de confirmation pour terminer la création de votre compte.',
            'افتح بريدك الإلكتروني واضغط على رابط التأكيد لإكمال إنشاء حسابك.',
          ));
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to continue.', 'Impossible de continuer.', 'تعذّر المتابعة.'));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await auth.signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('signInWithGoogle'));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    setNotice(null);
    try {
      const normalizedEmail = validateEmail();
      setBusy(true);
      await auth.sendPasswordReset(normalizedEmail);
      setNotice(tr('Password reset instructions are on their way. Check your email.', 'Les instructions de réinitialisation sont en route. Consultez votre e-mail.', 'تم إرسال تعليمات إعادة تعيين كلمة المرور. تحقّق من بريدك الإلكتروني.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('passwordReset'));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    setBusy(true);
    setError(null);
    try {
      await auth.resendSignupConfirmation(confirmationEmail);
      setNotice(tr('A new confirmation email has been sent.', 'Un nouvel e-mail de confirmation a été envoyé.', 'تم إرسال بريد تأكيد جديد.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('resendConfirmation'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isArabic && styles.arabic]}>{tr('Your Coptic Vine account', 'Votre compte Coptic Vine', 'حساب كوبتك فاين الخاص بك')}</Text>
      <Text style={[styles.sectionBody, isArabic && styles.arabic]}>
        {tr('Keep your likes, follows, playlists, and learning progress with you across devices.', 'Retrouvez vos favoris, abonnements, playlists et progrès sur tous vos appareils.', 'احفظ الإعجابات والمتابعات وقوائم التشغيل وتقدّم التعلّم على أجهزتك.')}
      </Text>

      <View accessibilityRole="tablist" style={styles.segmentedControl}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'signIn' }}
          style={[styles.segment, mode === 'signIn' && styles.segmentActive]}
          onPress={() => { setMode('signIn'); setError(null); setNotice(null); }}
        >
          <Text style={[styles.segmentText, mode === 'signIn' && styles.segmentTextActive, isArabic && styles.arabicText]}>{tr('Sign in', 'Se connecter', 'تسجيل الدخول')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'signUp' }}
          style={[styles.segment, mode === 'signUp' && styles.segmentActive]}
          onPress={() => { setMode('signUp'); setError(null); setNotice(null); }}
        >
          <Text style={[styles.segmentText, mode === 'signUp' && styles.segmentTextActive, isArabic && styles.arabicText]}>{tr('Create account', 'Créer un compte', 'إنشاء حساب')}</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" disabled={busy} style={styles.googleButton} onPress={() => void googleSignIn()}>
        <Text style={styles.googleMark}>G</Text>
        <Text style={[styles.googleButtonText, isArabic && styles.arabicText]}>{tr('Continue with Google', 'Continuer avec Google', 'المتابعة عبر Google')}</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={[styles.dividerText, isArabic && styles.arabicText]}>{tr('or use email', 'ou avec votre e-mail', 'أو عبر البريد الإلكتروني')}</Text>
        <View style={styles.divider} />
      </View>

      {mode === 'signUp' ? (
        <Field label={tr('Name', 'Nom', 'الاسم')}>
          <TextInput autoCapitalize="words" autoComplete="name" value={displayName} onChangeText={setDisplayName} placeholder={tr('Your name', 'Votre nom', 'اسمك')} placeholderTextColor={COLORS.muted} style={styles.input} />
        </Field>
      ) : null}

      <Field label={tr('Email', 'E-mail', 'البريد الإلكتروني')}>
        <TextInput autoCapitalize="none" autoComplete="email" inputMode="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={COLORS.muted} style={styles.input} />
      </Field>

      <Field label={tr('Password', 'Mot de passe', 'كلمة المرور')}>
        <View style={styles.passwordField}>
          <TextInput autoCapitalize="none" autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} placeholder={tr('At least 8 characters', 'Au moins 8 caractères', '8 أحرف على الأقل')} placeholderTextColor={COLORS.muted} style={styles.passwordInput} />
          <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? tr('Hide password', 'Masquer le mot de passe', 'إخفاء كلمة المرور') : tr('Show password', 'Afficher le mot de passe', 'إظهار كلمة المرور')} onPress={() => setShowPassword((current) => !current)} style={styles.showButton}>
            <Icon name="eye-outline" size={20} color={showPassword ? COLORS.gold : COLORS.muted} />
          </Pressable>
        </View>
      </Field>

      {mode === 'signUp' ? (
        <Field label={tr('Confirm password', 'Confirmer le mot de passe', 'تأكيد كلمة المرور')}>
          <TextInput autoCapitalize="none" autoComplete="new-password" secureTextEntry={!showPassword} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={tr('Enter it again', 'Saisissez-le à nouveau', 'أدخلها مرة أخرى')} placeholderTextColor={COLORS.muted} style={styles.input} />
        </Field>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.noticeText}>{notice}</Text> : null}

      <Pressable accessibilityRole="button" disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void submit()}>
        {busy ? <ActivityIndicator color={COLORS.black} /> : <Text style={[styles.primaryButtonText, isArabic && styles.arabicText]}>{mode === 'signIn' ? tr('Sign in', 'Se connecter', 'تسجيل الدخول') : tr('Create account', 'Créer un compte', 'إنشاء حساب')}</Text>}
      </Pressable>

      {mode === 'signIn' ? (
        <Pressable accessibilityRole="button" disabled={busy} style={styles.textButton} onPress={() => void resetPassword()}>
          <Text style={[styles.textButtonText, isArabic && styles.arabicText]}>{tr('Forgot your password?', 'Mot de passe oublié ?', 'هل نسيت كلمة المرور؟')}</Text>
        </Pressable>
      ) : null}
      {confirmationEmail ? (
        <Pressable accessibilityRole="button" disabled={busy} style={styles.textButton} onPress={() => void resendConfirmation()}>
          <Text style={[styles.textButtonText, isArabic && styles.arabicText]}>{tr('Resend confirmation email', 'Renvoyer l’e-mail de confirmation', 'إعادة إرسال بريد التأكيد')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SignedInAccount({ recoveryMode }: { recoveryMode: boolean }) {
  const auth = useAuth();
  const { preferences } = useReadingPreferences();
  const isArabic = preferences.appLanguage === 'ar';
  const user = auth.user!;
  const currentName = typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '';
  const customAvatarUrl = typeof user.user_metadata.chc_avatar_url === 'string' ? user.user_metadata.chc_avatar_url : null;
  const providerAvatarUrl = typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : null;
  const avatarUrl = customAvatarUrl || providerAvatarUrl;
  const [displayName, setDisplayName] = useState(currentName);
  const [email, setEmail] = useState(user.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordEditor, setShowPasswordEditor] = useState(recoveryMode);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const provider = user.app_metadata.provider === 'google' ? 'Google' : tr('Email', 'E-mail', 'البريد الإلكتروني');
  const verified = user.email_confirmed_at ? tr(' · Verified', ' · Vérifié', ' · موثّق') : '';
  const initials = (currentName || user.email || 'CV')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const saveProfile = async () => {
    const trimmed = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!trimmed || busy) return;
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError(tr('Enter a valid email address.', 'Saisissez une adresse e-mail valide.', 'أدخل بريدًا إلكترونيًا صالحًا.'));
      return;
    }
    const emailChanged = normalizedEmail !== (user.email ?? '').toLowerCase();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await auth.updateDisplayName(trimmed);
      if (emailChanged) await auth.updateEmail(normalizedEmail);
      setNotice(emailChanged
        ? tr('Profile saved. Check your email to confirm the new address.', 'Profil enregistré. Consultez votre e-mail pour confirmer la nouvelle adresse.', 'تم حفظ الملف الشخصي. تحقّق من بريدك الإلكتروني لتأكيد العنوان الجديد.')
        : tr('Your profile has been updated.', 'Votre profil a été mis à jour.', 'تم تحديث ملفك الشخصي.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('updateProfile'));
    } finally {
      setBusy(false);
    }
  };

  const changePhoto = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setError(null);
    setNotice(null);
    try {
      const nextUrl = await pickAndUploadProfileAvatar(user.id);
      if (!nextUrl) return;
      await auth.updateAvatarUrl(nextUrl);
      setNotice(tr('Your profile photo has been updated.', 'Votre photo de profil a été mise à jour.', 'تم تحديث صورة ملفك الشخصي.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('updatePhoto'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const clearPhoto = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setError(null);
    setNotice(null);
    try {
      await auth.updateAvatarUrl(null);
      await removeProfileAvatar(user.id);
      setNotice(tr('Your profile photo has been removed.', 'Votre photo de profil a été supprimée.', 'تمت إزالة صورة ملفك الشخصي.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('removePhoto'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const savePassword = async () => {
    setError(null);
    setNotice(null);
    if (newPassword.length < 8) {
      setError(tr('Your new password must be at least 8 characters.', 'Votre nouveau mot de passe doit contenir au moins 8 caractères.', 'يجب أن تتكوّن كلمة المرور الجديدة من 8 أحرف على الأقل.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tr('The passwords do not match.', 'Les mots de passe ne correspondent pas.', 'كلمتا المرور غير متطابقتين.'));
      return;
    }
    setBusy(true);
    try {
      await auth.updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordEditor(false);
      setNotice(tr('Your password has been updated.', 'Votre mot de passe a été mis à jour.', 'تم تحديث كلمة المرور.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('updatePassword'));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.signOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : authMessage('signOut'));
      setBusy(false);
    }
  };

  return (
    <>
      <View style={[styles.section, styles.profileHero]}>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} contentFit="cover" transition={150} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>

          <View style={styles.profileIdentity}>
            <Text numberOfLines={1} style={[styles.identityName, isArabic && styles.arabicText]}>{currentName || tr('Coptic Vine listener', 'Auditeur Coptic Vine', 'مستمع كوبتك فاين')}</Text>
            <Text numberOfLines={1} style={styles.identityEmail}>{user.email}</Text>
            <Text style={[styles.identityMeta, isArabic && styles.arabicText]}>{tr(`${provider} account`, `Compte ${provider}`, `حساب ${provider}`)}{verified}</Text>
          </View>
        </View>

        <View style={styles.profilePhotoActions}>
          <Pressable
            accessibilityRole="button"
            disabled={avatarBusy}
            style={[styles.photoButton, avatarBusy && styles.disabled]}
            onPress={() => void changePhoto()}
          >
            {avatarBusy ? <ActivityIndicator size="small" color={COLORS.goldBright} /> : <Icon name="person-circle-outline" size={18} color={COLORS.goldBright} />}
            <Text style={[styles.photoButtonText, isArabic && styles.arabicText]}>{avatarUrl ? tr('Change photo', 'Changer la photo', 'تغيير الصورة') : tr('Add photo', 'Ajouter une photo', 'إضافة صورة')}</Text>
          </Pressable>
          {customAvatarUrl ? (
            <Pressable accessibilityRole="button" disabled={avatarBusy} style={styles.removePhotoButton} onPress={() => void clearPhoto()}>
              <Text style={[styles.removePhotoText, isArabic && styles.arabicText]}>{tr('Remove', 'Supprimer', 'إزالة')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {recoveryMode ? (
        <View style={[styles.section, styles.recoverySection]}>
          <Text style={[styles.sectionTitle, isArabic && styles.arabic]}>{tr('Choose a new password', 'Choisissez un nouveau mot de passe', 'اختر كلمة مرور جديدة')}</Text>
          <Text style={[styles.sectionBody, isArabic && styles.arabic]}>{tr('Finish recovering your account by setting a new password.', 'Terminez la récupération de votre compte en définissant un nouveau mot de passe.', 'أكمل استعادة حسابك بتعيين كلمة مرور جديدة.')}</Text>
          <PasswordEditor password={newPassword} confirmation={confirmPassword} onPasswordChange={setNewPassword} onConfirmationChange={setConfirmPassword} busy={busy} onSave={() => void savePassword()} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isArabic && styles.arabic]}>{tr('Profile', 'Profil', 'الملف الشخصي')}</Text>
        <Text style={[styles.sectionBody, isArabic && styles.arabic]}>
          {tr('Choose the name that appears on your Coptic Vine account.', 'Choisissez le nom qui apparaît sur votre compte Coptic Vine.', 'عدّل الاسم الذي يظهر في حساب كوبتك فاين الخاص بك.')}
        </Text>
        <Field label={tr('Display name', 'Nom affiché', 'الاسم المعروض')}>
          <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholder={tr('Your name', 'Votre nom', 'اسمك')} placeholderTextColor={COLORS.muted} />
        </Field>
        <Field label={tr('Email', 'E-mail', 'البريد الإلكتروني')}>
          <TextInput autoCapitalize="none" autoComplete="email" inputMode="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholder="you@example.com" placeholderTextColor={COLORS.muted} />
        </Field>
        <Pressable accessibilityRole="button" disabled={busy || !displayName.trim() || !email.trim()} style={[styles.secondaryButton, (busy || !displayName.trim() || !email.trim()) && styles.disabled]} onPress={() => void saveProfile()}>
          <Text style={[styles.secondaryButtonText, isArabic && styles.arabicText]}>{tr('Save profile', 'Enregistrer le profil', 'حفظ الملف الشخصي')}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isArabic && styles.arabic]}>{tr('Security', 'Sécurité', 'الأمان')}</Text>
        <Text style={[styles.accountDetailLabel, isArabic && styles.arabic]}>{tr('Sign-in method', 'Méthode de connexion', 'طريقة تسجيل الدخول')}</Text>
        <Text style={[styles.accountDetailValue, isArabic && styles.arabic]}>{provider}{verified}</Text>

        {!recoveryMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showPasswordEditor }}
            style={[styles.disclosureRow, isArabic && styles.rowReverse]}
            onPress={() => setShowPasswordEditor((current) => !current)}
          >
            <View>
              <Text style={[styles.disclosureText, isArabic && styles.arabic]}>{tr('Change password', 'Changer le mot de passe', 'تغيير كلمة المرور')}</Text>
              <Text style={[styles.disclosureDescription, isArabic && styles.arabic]}>{tr('Set a new password for email sign-in.', 'Définissez un nouveau mot de passe pour la connexion par e-mail.', 'عيّن كلمة مرور جديدة لتسجيل الدخول بالبريد الإلكتروني.')}</Text>
            </View>
            <Icon name={showPasswordEditor ? 'chevron-down' : 'chevron-forward'} size={18} color={COLORS.goldBright} />
          </Pressable>
        ) : null}
        {showPasswordEditor && !recoveryMode ? (
          <PasswordEditor password={newPassword} confirmation={confirmPassword} onPasswordChange={setNewPassword} onConfirmationChange={setConfirmPassword} busy={busy} onSave={() => void savePassword()} />
        ) : null}

        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        {notice ? <Text accessibilityRole="alert" style={styles.noticeText}>{notice}</Text> : null}
      </View>

      <View style={[styles.section, styles.signOutSection]}>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.signOutButton} onPress={() => void signOut()}>
          <Text style={[styles.signOutText, isArabic && styles.arabicText]}>{tr('Sign out', 'Se déconnecter', 'تسجيل الخروج')}</Text>
        </Pressable>
      </View>
    </>
  );
}

function PasswordEditor({ password, confirmation, onPasswordChange, onConfirmationChange, busy, onSave }: {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <View style={styles.passwordEditor}>
      <Field label={tr('New password', 'Nouveau mot de passe', 'كلمة المرور الجديدة')}>
        <TextInput secureTextEntry autoComplete="new-password" value={password} onChangeText={onPasswordChange} placeholder={tr('At least 8 characters', 'Au moins 8 caractères', '8 أحرف على الأقل')} placeholderTextColor={COLORS.muted} style={styles.input} />
      </Field>
      <Field label={tr('Confirm new password', 'Confirmer le nouveau mot de passe', 'تأكيد كلمة المرور الجديدة')}>
        <TextInput secureTextEntry autoComplete="new-password" value={confirmation} onChangeText={onConfirmationChange} placeholder={tr('Enter it again', 'Saisissez-le à nouveau', 'أدخلها مرة أخرى')} placeholderTextColor={COLORS.muted} style={styles.input} />
      </Field>
      <Pressable accessibilityRole="button" disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={onSave}>
        <Text style={[styles.primaryButtonText, getCurrentAppLanguage() === 'ar' && styles.arabicText]}>{tr('Update password', 'Mettre à jour le mot de passe', 'تحديث كلمة المرور')}</Text>
      </Pressable>
    </View>
  );
}

function AppSettingsSection() {
  const router = useRouter();
  const { user } = useAuth();
  const { preferences, setAppLanguage, contentSyncStatus } = useReadingPreferences();
  const isArabic = preferences.appLanguage === 'ar';
  const syncLabel = !user
    ? (tr('On this device', 'Sur cet appareil', 'على هذا الجهاز'))
    : contentSyncStatus === 'syncing'
      ? (tr('Syncing', 'Synchronisation', 'جارٍ المزامنة'))
      : contentSyncStatus === 'error'
        ? (tr('Offline', 'Hors ligne', 'غير متصل'))
        : (tr('Synced', 'Synchronisé', 'تمت المزامنة'));

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <Icon name="settings-outline" size={22} color={COLORS.goldBright} />
        <Text style={[styles.sectionTitle, styles.sectionHeadingTitle, isArabic && styles.arabic]}>{tr('App settings', 'Paramètres de l’application', 'إعدادات التطبيق')}</Text>
        <Text style={[styles.syncStatus, user && contentSyncStatus === 'error' && styles.syncStatusError]}>{syncLabel}</Text>
      </View>
      <Text style={[styles.fieldLabel, isArabic && styles.arabic]}>{tr('App language', 'Langue de l’application', 'لغة التطبيق')}</Text>
      <View style={styles.languageOptions}>
        {APP_LANGUAGE_OPTIONS.map((option) => {
          const active = preferences.appLanguage === option.key;
          return (
            <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ checked: active }} style={[styles.languageButton, active && styles.languageButtonActive]} onPress={() => setAppLanguage(option.key)}>
              <View style={[styles.radioOuter, active && styles.radioOuterActive]}>{active ? <View style={styles.radioInner} /> : null}</View>
              <View style={styles.languageTextGroup}>
                <Text style={styles.languageLabel}>{option.label}</Text>
                <Text style={option.key === 'ar' ? styles.languageArabic : styles.languageNative}>{option.native}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <SettingsLink
        label={tr('Book settings', 'Réglages des livres', 'إعدادات الكتب')}
        description={tr('Reading languages, text, slideshow, and display', 'Langues de lecture, texte, diaporama et affichage', 'لغات القراءة والنص والعرض التقديمي والشاشة')}
        arabic={isArabic}
        onPress={() => router.push('/book-settings')}
      />
      {Platform.OS !== 'web' ? (
        <SettingsLink
          label={tr('Downloads and storage', 'Téléchargements et stockage', 'التنزيلات والتخزين')}
          description={tr('Manage books, music, and learning saved offline', 'Gérez les livres, la musique et les leçons enregistrés hors ligne', 'إدارة الكتب والموسيقى والدروس المحفوظة دون اتصال')}
          arabic={isArabic}
          onPress={() => router.push('/downloads')}
        />
      ) : null}
    </View>
  );
}

function SettingsLink({ label, description, arabic, onPress }: { label: string; description: string; arabic: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${description}`} style={[styles.settingsLink, arabic && styles.rowReverse]} onPress={onPress}>
      <View style={styles.settingsLinkText}>
        <Text style={[styles.settingsLinkLabel, arabic && styles.arabic]}>{label}</Text>
        <Text style={[styles.settingsLinkDescription, arabic && styles.arabic]}>{description}</Text>
      </View>
      <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.goldBright} />
    </Pressable>
  );
}

/** A labelled input. The label follows the App Language's direction, read from the module store so the many fields need no prop for it. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  const arabic = getCurrentAppLanguage() === 'ar';
  return <View style={styles.field}><Text style={[styles.fieldLabel, arabic && styles.arabic]}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  profileHero: { paddingTop: SPACING.sm },
  profileHeader: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
  profileAvatar: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderColor: COLORS.goldLine, borderRadius: 44, borderWidth: 1, height: 88, justifyContent: 'center', overflow: 'hidden', width: 88 },
  profileAvatarImage: { height: 88, width: 88 },
  profileIdentity: { flex: 1, minWidth: 0 },
  profilePhotoActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  photoButton: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderColor: COLORS.goldLine, borderRadius: RADII.pill, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 40, paddingHorizontal: SPACING.md },
  photoButtonText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '800' },
  removePhotoButton: { alignItems: 'center', borderColor: COLORS.border, borderRadius: RADII.pill, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: SPACING.md },
  removePhotoText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  accountDetailLabel: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  accountDetailValue: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, marginTop: -8 },
  disclosureDescription: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 3 },
  signOutSection: { backgroundColor: 'transparent', borderWidth: 0, padding: 0 },

  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
  container: { alignSelf: 'center', gap: 0, maxWidth: 640, width: '100%' },
  loader: { marginVertical: SPACING.xl },
  section: { borderBottomColor: COLORS.border, borderBottomWidth: 1, gap: SPACING.md, paddingHorizontal: SPACING.xs, paddingVertical: SPACING.lg },
  recoverySection: { borderColor: COLORS.goldLine, borderTopWidth: 1, paddingTop: SPACING.lg },
  sectionTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700' },
  sectionBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, lineHeight: 22 },
  sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
  sectionHeadingTitle: { flex: 1 },
  syncStatus: { color: COLORS.learningBright, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800' },
  syncStatusError: { color: '#FF8A8A' },
  segmentedControl: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', padding: 3 },
  segment: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: SPACING.sm },
  segmentActive: { backgroundColor: COLORS.gold },
  segmentText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: COLORS.black },
  googleButton: { alignItems: 'center', borderColor: COLORS.muted, borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 50, paddingHorizontal: SPACING.md },
  googleMark: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 18, fontWeight: '900', marginRight: SPACING.sm },
  googleButtonText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '800' },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
  divider: { backgroundColor: COLORS.border, flex: 1, height: 1 },
  dividerText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12 },
  field: { gap: 6 },
  fieldLabel: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '800' },
  input: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 8, borderWidth: 1, color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, minHeight: 48, paddingHorizontal: SPACING.md },
  passwordField: { alignItems: 'center', backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row' },
  passwordInput: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15, minHeight: 46, paddingHorizontal: SPACING.md },
  showButton: { alignItems: 'center', height: 46, justifyContent: 'center', width: 46 },
  primaryButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 8, justifyContent: 'center', minHeight: 48, paddingHorizontal: SPACING.md },
  primaryButtonText: { color: COLORS.black, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: SPACING.md },
  secondaryButtonText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '800' },
  textButton: { alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  textButtonText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  errorText: { color: '#FF8A8A', fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19 },
  noticeText: { color: COLORS.learningBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19 },
  identityRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
  avatar: { alignItems: 'center', backgroundColor: COLORS.green, borderColor: COLORS.goldLine, borderRadius: 32, borderWidth: 1, height: 64, justifyContent: 'center', width: 64 },
  avatarText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '800' },
  identityText: { flex: 1, minWidth: 0 },
  identityName: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  identityEmail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 2 },
  identityMeta: { color: COLORS.learningBright, fontFamily: TYPOGRAPHY.body, fontSize: 11, marginTop: 5 },
  shortcutRow: { flexDirection: 'row', gap: SPACING.sm },
  shortcut: { alignItems: 'center', borderColor: COLORS.border, borderRadius: 8, borderWidth: 1, flex: 1, gap: SPACING.sm, justifyContent: 'center', minHeight: 82, padding: SPACING.sm },
  shortcutText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  disclosureRow: { alignItems: 'center', borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  disclosureText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '800' },
  passwordEditor: { gap: SPACING.md },
  signOutButton: { alignItems: 'center', borderColor: 'rgba(214,69,69,0.7)', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 46 },
  signOutText: { color: '#FF8A8A', fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '800' },
  languageOptions: { flexDirection: 'row', gap: SPACING.sm },
  languageButton: { alignItems: 'center', borderColor: COLORS.border, borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', gap: SPACING.sm, minHeight: 58, paddingHorizontal: SPACING.sm },
  languageButtonActive: { backgroundColor: COLORS.goldSoft, borderColor: COLORS.gold },
  radioOuter: { alignItems: 'center', borderColor: COLORS.muted, borderRadius: 10, borderWidth: 2, height: 20, justifyContent: 'center', width: 20 },
  radioOuterActive: { borderColor: COLORS.gold },
  radioInner: { backgroundColor: COLORS.gold, borderRadius: 5, height: 10, width: 10 },
  languageTextGroup: { flex: 1 },
  languageLabel: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '800' },
  languageArabic: { color: COLORS.muted, fontFamily: TYPOGRAPHY.arabic, fontSize: 12, marginTop: 2, writingDirection: 'rtl' },
  languageNative: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  settingsLink: { alignItems: 'center', borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: 'row', gap: SPACING.md, minHeight: 64, paddingVertical: SPACING.sm },
  settingsLinkText: { flex: 1 },
  settingsLinkLabel: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '800' },
  settingsLinkDescription: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, lineHeight: 17, marginTop: 3 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
  arabicText: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  rowReverse: { flexDirection: 'row-reverse' },
});
