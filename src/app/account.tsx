'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import { CrownOrnament } from '@/components/vine/ui/Ornaments';
import PageTitle from '@/components/vine/ui/PageTitle';
import SegmentNav from '@/components/vine/ui/SegmentNav';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { pickAndUploadProfileAvatar, removeProfileAvatar } from '@/services/profileAvatarService';
import { authMessage } from '@/utils/authMessages';
import { getCurrentAppLanguage, type AppLanguage } from '@/utils/preferencesStorage';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../utils/appText';
// Each language also named in itself, so it can be found whatever the app is showing.
const APP_LANGUAGE_OPTIONS: { key: AppLanguage; label: string; native: string }[] = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'fr', label: 'French', native: 'Français' },
  { key: 'ar', label: 'Arabic', native: 'العربية' },
];

const MAX_FONT_SCALE = 1.3;

/**
 * The Account tab (Coptic Vine design, "Account"): who is signed in under the
 * vine crown, then the profile to edit, the app's settings and the account's
 * security, each a section drawn out into a vine. The iPad and desktop set
 * the profile and app settings beside the editing and security.
 */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const { preferences } = useReadingPreferences();
  const { user, loading, recoveryMode } = useAuth();
  const arabic = preferences.appLanguage === 'ar';
  const wide = layout !== 'phone';
  const gutter = wide ? 0 : 16;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head><title>{`${tr('Account', 'Compte', 'الحساب')} — Coptic Vine`}</title></Head>
      <NowPlayingAwareScrollView
        contentContainerStyle={[styles.content, wide && [styles.contentWide, { paddingTop: insets.top + 28 }]]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind="green" tall={wide} />
        <PageGutterProvider gutter={gutter}>
          <PageTitle title={tr('Account', 'Compte', 'الحساب')} arabic={arabic} flush={wide} />
          {loading ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
          {!loading && user ? <SignedInAccount key={user.id} recoveryMode={recoveryMode} wide={wide} gutter={gutter} /> : null}
          {!loading && !user ? (
            wide ? (
              <View style={[styles.columns, arabic && styles.rowReverse]}>
                <View style={styles.column}><SignedOutAccount gutter={gutter} /></View>
                <View style={styles.column}><AppSettingsSection gutter={gutter} /></View>
              </View>
            ) : (
              <>
                <SignedOutAccount gutter={gutter} />
                <AppSettingsSection gutter={gutter} />
              </>
            )
          ) : null}
        </PageGutterProvider>
      </NowPlayingAwareScrollView>
      <BottomTabBar active="account" />
    </SafeAreaView>
  );
}

function SignedOutAccount({ gutter }: { gutter: number }) {
  const auth = useAuth();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
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

  const modes = [
    { key: 'signIn' as const, label: tr('Sign in', 'Se connecter', 'تسجيل الدخول') },
    { key: 'signUp' as const, label: tr('Create account', 'Créer un compte', 'إنشاء حساب') },
  ];

  return (
    <>
      <View style={[styles.framed, { marginHorizontal: gutter }]}>
        <LinearGradient colors={['#173A1F', COLORS.greenDeep]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.crown} pointerEvents="none"><CrownOrnament width={300} height={58} /></View>
        <View style={styles.framedBody}>
          <Text style={[styles.framedTitle, arabic && styles.arabicCentered]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Your Coptic Vine account', 'Votre compte Coptic Vine', 'حساب كوبتك فاين الخاص بك')}</Text>
          <Text style={[styles.framedText, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr('Keep your likes, follows, playlists, and learning progress with you across devices.', 'Retrouvez vos favoris, abonnements, playlists et progrès sur tous vos appareils.', 'احفظ الإعجابات والمتابعات وقوائم التشغيل وتقدّم التعلّم على أجهزتك.')}
          </Text>
        </View>
      </View>

      <View style={[styles.formCard, { marginHorizontal: gutter }]}>
        <SegmentNav items={modes} active={mode} arabic={arabic} role="radiogroup" onSelect={(key) => { setMode(key); setError(null); setNotice(null); }} />

        <Pressable accessibilityRole="button" disabled={busy} style={({ pressed }) => [styles.googleButton, arabic && styles.rowReverse, pressed && styles.pressed]} onPress={() => void googleSignIn()}>
          <Text style={styles.googleMark}>G</Text>
          <Text style={[styles.googleButtonText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Continue with Google', 'Continuer avec Google', 'المتابعة عبر Google')}</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={[styles.dividerText, arabic && styles.arabic]}>{tr('or use email', 'ou avec votre e-mail', 'أو عبر البريد الإلكتروني')}</Text>
          <View style={styles.divider} />
        </View>

        {mode === 'signUp' ? (
          <Field label={tr('Name', 'Nom', 'الاسم')}>
            <TextInput autoCapitalize="words" autoComplete="name" value={displayName} onChangeText={setDisplayName} placeholder={tr('Your name', 'Votre nom', 'اسمك')} placeholderTextColor={PLACEHOLDER} style={[styles.input, arabic && styles.arabic]} />
          </Field>
        ) : null}

        <Field label={tr('Email', 'E-mail', 'البريد الإلكتروني')}>
          <TextInput autoCapitalize="none" autoComplete="email" inputMode="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={PLACEHOLDER} style={styles.input} />
        </Field>

        <Field label={tr('Password', 'Mot de passe', 'كلمة المرور')}>
          <View style={[styles.passwordField, arabic && styles.rowReverse]}>
            <TextInput autoCapitalize="none" autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} placeholder={tr('At least 8 characters', 'Au moins 8 caractères', '8 أحرف على الأقل')} placeholderTextColor={PLACEHOLDER} style={[styles.passwordInput, arabic && styles.arabic]} />
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? tr('Hide password', 'Masquer le mot de passe', 'إخفاء كلمة المرور') : tr('Show password', 'Afficher le mot de passe', 'إظهار كلمة المرور')} onPress={() => setShowPassword((current) => !current)} style={styles.showButton}>
              <Icon name="eye-outline" size={20} color={showPassword ? COLORS.gold : COLORS.muted} />
            </Pressable>
          </View>
        </Field>

        {mode === 'signUp' ? (
          <Field label={tr('Confirm password', 'Confirmer le mot de passe', 'تأكيد كلمة المرور')}>
            <TextInput autoCapitalize="none" autoComplete="new-password" secureTextEntry={!showPassword} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={tr('Enter it again', 'Saisissez-le à nouveau', 'أدخلها مرة أخرى')} placeholderTextColor={PLACEHOLDER} style={[styles.input, arabic && styles.arabic]} />
          </Field>
        ) : null}

        {error ? <Text accessibilityRole="alert" style={[styles.errorText, arabic && styles.arabic]}>{error}</Text> : null}
        {notice ? <Text accessibilityRole="alert" style={[styles.noticeText, arabic && styles.arabic]}>{notice}</Text> : null}

        <Pressable accessibilityRole="button" disabled={busy} style={({ pressed }) => [styles.saveButton, busy && styles.disabled, pressed && styles.pressed]} onPress={() => void submit()}>
          {busy ? <ActivityIndicator color={COLORS.greenDeep} /> : <Text style={[styles.saveButtonText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{mode === 'signIn' ? tr('Sign in', 'Se connecter', 'تسجيل الدخول') : tr('Create account', 'Créer un compte', 'إنشاء حساب')}</Text>}
        </Pressable>

        {mode === 'signIn' ? (
          <Pressable accessibilityRole="button" disabled={busy} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]} onPress={() => void resetPassword()}>
            <Text style={[styles.textButtonText, arabic && styles.arabic]}>{tr('Forgot your password?', 'Mot de passe oublié ?', 'هل نسيت كلمة المرور؟')}</Text>
          </Pressable>
        ) : null}
        {confirmationEmail ? (
          <Pressable accessibilityRole="button" disabled={busy} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]} onPress={() => void resendConfirmation()}>
            <Text style={[styles.textButtonText, arabic && styles.arabic]}>{tr('Resend confirmation email', 'Renvoyer l’e-mail de confirmation', 'إعادة إرسال بريد التأكيد')}</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

function SignedInAccount({ recoveryMode, wide, gutter }: { recoveryMode: boolean; wide: boolean; gutter: number }) {
  const auth = useAuth();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
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
  const verified = Boolean(user.email_confirmed_at);
  const verifiedLabel = tr('Verified', 'Vérifié', 'موثّق');
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

  const messages = (
    <>
      {error ? <Text accessibilityRole="alert" style={[styles.errorText, { marginHorizontal: gutter }, arabic && styles.arabic]}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="alert" style={[styles.noticeText, { marginHorizontal: gutter }, arabic && styles.arabic]}>{notice}</Text> : null}
    </>
  );

  // Who is signed in, under the crown.
  const profileCard = (
    <View style={[styles.framed, { marginHorizontal: gutter }]}>
      <LinearGradient colors={['#173A1F', COLORS.greenDeep]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.crown} pointerEvents="none"><CrownOrnament width={300} height={58} /></View>
      <View style={styles.profileBody}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <>
              <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.avatarText} maxFontSizeMultiplier={1}>{initials}</Text>
            </>
          )}
        </View>
        <Text numberOfLines={1} style={[styles.profileName, arabic && styles.arabicCentered]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {currentName || tr('Coptic Vine listener', 'Auditeur Coptic Vine', 'مستمع كوبتك فاين')}
        </Text>
        <Text numberOfLines={1} style={styles.profileEmail} maxFontSizeMultiplier={MAX_FONT_SCALE}>{user.email}</Text>
        <View style={[styles.verifiedPill, arabic && styles.rowReverse]}>
          {verified ? <Icon name="checkmark" size={13} color={COLORS.gold} /> : null}
          <Text style={[styles.verifiedText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr(`${provider} account`, `Compte ${provider}`, `حساب ${provider}`)}{verified ? ` · ${verifiedLabel}` : ''}
          </Text>
        </View>
        <View style={[styles.photoButtons, arabic && styles.rowReverse]}>
          <Pressable
            accessibilityRole="button"
            disabled={avatarBusy}
            style={({ pressed }) => [styles.photoButton, styles.photoButtonGold, arabic && styles.rowReverse, avatarBusy && styles.disabled, pressed && styles.pressed]}
            onPress={() => void changePhoto()}
          >
            {avatarBusy ? <ActivityIndicator size="small" color={COLORS.greenDeep} /> : <Icon name="person-circle-outline" size={17} color={COLORS.greenDeep} />}
            <Text style={[styles.photoButtonText, styles.photoButtonTextGold, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {avatarUrl ? tr('Change photo', 'Changer la photo', 'تغيير الصورة') : tr('Add photo', 'Ajouter une photo', 'إضافة صورة')}
            </Text>
          </Pressable>
          {customAvatarUrl ? (
            <Pressable accessibilityRole="button" disabled={avatarBusy} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]} onPress={() => void clearPhoto()}>
              <Text style={[styles.photoButtonText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Remove', 'Supprimer', 'إزالة')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  const profileForm = (
    <>
      <SectionHeading title={tr('Profile', 'Profil', 'الملف الشخصي')} arabic={arabic} />
      <Text style={[styles.sectionBody, { paddingHorizontal: gutter }, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {tr('Choose the name that appears on your Coptic Vine account.', 'Choisissez le nom qui apparaît sur votre compte Coptic Vine.', 'عدّل الاسم الذي يظهر في حساب كوبتك فاين الخاص بك.')}
      </Text>
      <View style={[styles.formCard, { marginHorizontal: gutter }]}>
        <Field label={tr('Display name', 'Nom affiché', 'الاسم المعروض')}>
          <TextInput value={displayName} onChangeText={setDisplayName} style={[styles.input, arabic && styles.arabic]} placeholder={tr('Your name', 'Votre nom', 'اسمك')} placeholderTextColor={PLACEHOLDER} />
        </Field>
        <Field label={tr('Email', 'E-mail', 'البريد الإلكتروني')}>
          <TextInput autoCapitalize="none" autoComplete="email" inputMode="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholder="you@example.com" placeholderTextColor={PLACEHOLDER} />
        </Field>
        <Pressable accessibilityRole="button" disabled={busy || !displayName.trim() || !email.trim()} style={({ pressed }) => [styles.saveButton, (busy || !displayName.trim() || !email.trim()) && styles.disabled, pressed && styles.pressed]} onPress={() => void saveProfile()}>
          <Text style={[styles.saveButtonText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Save profile', 'Enregistrer le profil', 'حفظ الملف الشخصي')}</Text>
        </Pressable>
      </View>
    </>
  );

  const security = (
    <>
      <SectionHeading title={tr('Security', 'Sécurité', 'الأمان')} arabic={arabic} />
      <View style={[styles.rows, { marginHorizontal: gutter }]}>
        <SettingsRow
          icon="person-circle-outline"
          label={tr('Sign-in method', 'Méthode de connexion', 'طريقة تسجيل الدخول')}
          description={provider}
          value={verified ? verifiedLabel : undefined}
          arabic={arabic}
        />
        {!recoveryMode ? (
          <SettingsRow
            icon="settings-outline"
            label={tr('Change password', 'Changer le mot de passe', 'تغيير كلمة المرور')}
            description={tr('Set a new password for email sign-in.', 'Définissez un nouveau mot de passe pour la connexion par e-mail.', 'عيّن كلمة مرور جديدة لتسجيل الدخول بالبريد الإلكتروني.')}
            arabic={arabic}
            expanded={showPasswordEditor}
            onPress={() => setShowPasswordEditor((current) => !current)}
          />
        ) : null}
        {showPasswordEditor && !recoveryMode ? (
          <View style={styles.formCard}>
            <PasswordEditor password={newPassword} confirmation={confirmPassword} onPasswordChange={setNewPassword} onConfirmationChange={setConfirmPassword} busy={busy} onSave={() => void savePassword()} />
          </View>
        ) : null}
        <Pressable accessibilityRole="button" disabled={busy} style={({ pressed }) => [styles.signOut, arabic && styles.rowReverse, busy && styles.disabled, pressed && styles.pressed]} onPress={() => void signOut()}>
          <Icon name="close" size={18} color={SIGN_OUT} />
          <Text style={[styles.signOutText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Sign out', 'Se déconnecter', 'تسجيل الخروج')}</Text>
        </Pressable>
      </View>
    </>
  );

  const recovery = recoveryMode ? (
    <>
      <SectionHeading title={tr('Choose a new password', 'Choisissez un nouveau mot de passe', 'اختر كلمة مرور جديدة')} arabic={arabic} />
      <Text style={[styles.sectionBody, { paddingHorizontal: gutter }, arabic && styles.arabic]}>{tr('Finish recovering your account by setting a new password.', 'Terminez la récupération de votre compte en définissant un nouveau mot de passe.', 'أكمل استعادة حسابك بتعيين كلمة مرور جديدة.')}</Text>
      <View style={[styles.formCard, { marginHorizontal: gutter }]}>
        <PasswordEditor password={newPassword} confirmation={confirmPassword} onPasswordChange={setNewPassword} onConfirmationChange={setConfirmPassword} busy={busy} onSave={() => void savePassword()} />
      </View>
    </>
  ) : null;

  if (wide) {
    return (
      <View style={[styles.columns, arabic && styles.rowReverse]}>
        <View style={styles.column}>
          {profileCard}
          <AppSettingsSection gutter={gutter} />
        </View>
        <View style={styles.column}>
          {recovery}
          {profileForm}
          {security}
          {messages}
        </View>
      </View>
    );
  }
  return (
    <>
      {profileCard}
      {recovery}
      {profileForm}
      <AppSettingsSection gutter={gutter} />
      {security}
      {messages}
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
  const arabic = getCurrentAppLanguage() === 'ar';
  return (
    <>
      <Field label={tr('New password', 'Nouveau mot de passe', 'كلمة المرور الجديدة')}>
        <TextInput secureTextEntry autoComplete="new-password" value={password} onChangeText={onPasswordChange} placeholder={tr('At least 8 characters', 'Au moins 8 caractères', '8 أحرف على الأقل')} placeholderTextColor={PLACEHOLDER} style={[styles.input, arabic && styles.arabic]} />
      </Field>
      <Field label={tr('Confirm new password', 'Confirmer le nouveau mot de passe', 'تأكيد كلمة المرور الجديدة')}>
        <TextInput secureTextEntry autoComplete="new-password" value={confirmation} onChangeText={onConfirmationChange} placeholder={tr('Enter it again', 'Saisissez-le à nouveau', 'أدخلها مرة أخرى')} placeholderTextColor={PLACEHOLDER} style={[styles.input, arabic && styles.arabic]} />
      </Field>
      <Pressable accessibilityRole="button" disabled={busy} style={({ pressed }) => [styles.saveButton, busy && styles.disabled, pressed && styles.pressed]} onPress={onSave}>
        <Text style={[styles.saveButtonText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Update password', 'Mettre à jour le mot de passe', 'تحديث كلمة المرور')}</Text>
      </Pressable>
    </>
  );
}

/** App language, Book settings and (on a phone) Downloads — the settings that follow the account. */
function AppSettingsSection({ gutter }: { gutter: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const { preferences, setAppLanguage, contentSyncStatus } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const sync = !user
    ? { label: tr('On this device', 'Sur cet appareil', 'على هذا الجهاز'), icon: 'person-circle-outline' as const, color: COLORS.muted }
    : contentSyncStatus === 'syncing'
      ? { label: tr('Syncing', 'Synchronisation', 'جارٍ المزامنة'), icon: 'time-outline' as const, color: COLORS.gold }
      : contentSyncStatus === 'error'
        ? { label: tr('Offline', 'Hors ligne', 'غير متصل'), icon: 'close' as const, color: '#FF8A7A' }
        : { label: tr('Synced', 'Synchronisé', 'تمت المزامنة'), icon: 'checkmark' as const, color: COLORS.gold };

  return (
    <>
      <SectionHeading
        title={tr('App settings', 'Paramètres de l’application', 'إعدادات التطبيق')}
        arabic={arabic}
        trailing={(
          <View style={[styles.sync, arabic && styles.rowReverse]} accessibilityLabel={sync.label}>
            <Icon name={sync.icon} size={15} color={sync.color} />
            <Text style={[styles.syncText, { color: sync.color }, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{sync.label}</Text>
          </View>
        )}
      />
      <Text style={[styles.kicker, { paddingHorizontal: gutter }, arabic && styles.arabicKicker]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {arabic ? tr('App language', 'Langue de l’application', 'لغة التطبيق') : tr('App language', 'Langue de l’application', 'لغة التطبيق').toUpperCase()}
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.languages, { paddingHorizontal: gutter }, arabic && styles.rowReverse]}>
        {APP_LANGUAGE_OPTIONS.map((option) => {
          const active = preferences.appLanguage === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${option.label}, ${option.native}`}
              style={({ pressed }) => [styles.language, arabic && styles.rowReverse, pressed && styles.pressed]}
              onPress={() => setAppLanguage(option.key)}
            >
              <LinearGradient colors={active ? [COLORS.green, COLORS.greenDeep] : [COLORS.surfaceDeep, COLORS.surface]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={[styles.radio, active && styles.radioActive]} />
              <View style={styles.languageText}>
                <Text style={styles.languageLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{option.label}</Text>
                <Text style={[styles.languageNative, active && styles.languageNativeActive, option.key === 'ar' && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{option.native}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.rows, styles.rowsAfterLanguages, { marginHorizontal: gutter }]}>
        <SettingsRow
          icon="book"
          label={tr('Book settings', 'Réglages des livres', 'إعدادات الكتب')}
          description={tr('Reading languages, text, slideshow, and display', 'Langues de lecture, texte, diaporama et affichage', 'لغات القراءة والنص والعرض التقديمي والشاشة')}
          arabic={arabic}
          onPress={() => router.push('/book-settings')}
        />
        {Platform.OS !== 'web' ? (
          <SettingsRow
            icon="download-outline"
            label={tr('Downloads and storage', 'Téléchargements et stockage', 'التنزيلات والتخزين')}
            description={tr('Manage books, music, and learning saved offline', 'Gérez les livres, la musique et les leçons enregistrés hors ligne', 'إدارة الكتب والموسيقى والدروس المحفوظة دون اتصال')}
            arabic={arabic}
            onPress={() => router.push('/downloads')}
          />
        ) : null}
      </View>
    </>
  );
}

/** One settings row: a gold icon, the setting and a word about it, then a value or a chevron. */
function SettingsRow({ icon, label, description, value, arabic, onPress, expanded }: {
  icon: IconName;
  label: string;
  description?: string;
  value?: string;
  arabic: boolean;
  onPress?: () => void;
  expanded?: boolean;
}) {
  const body = (
    <>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Icon name={icon} size={21} color={COLORS.gold} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
        {description ? <Text style={[styles.rowDescription, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{description}</Text> : null}
      </View>
      {value ? <Text style={[styles.rowValue, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{value}</Text> : null}
      {onPress ? <Icon name={expanded ? 'chevron-down' : arabic ? 'chevron-back' : 'chevron-forward'} size={17} color={COLORS.gold} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, arabic && styles.rowReverse]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, arabic && styles.rowReverse, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** A labelled input. The label follows the App Language's direction, read from the module store so the many fields need no prop for it. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  const arabic = getCurrentAppLanguage() === 'ar';
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, arabic && styles.arabicKicker]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{arabic ? label : label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const PLACEHOLDER = 'rgba(205, 216, 203, 0.55)';
const SIGN_OUT = '#FF8A7A';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  contentWide: { paddingHorizontal: 36 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28 },
  column: { flex: 1, minWidth: 0 },
  rowReverse: { flexDirection: 'row-reverse' },
  loader: { marginVertical: 32 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  // The crowned card: who is signed in, or the invitation to sign in.
  framed: { backgroundColor: COLORS.surface, borderColor: 'rgba(227, 181, 59, 0.3)', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  crown: { alignItems: 'center', left: 8, opacity: 0.85, position: 'absolute', right: 8, top: 8 },
  framedBody: { alignItems: 'center', paddingBottom: 22, paddingHorizontal: 22, paddingTop: 48 },
  framedTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700', lineHeight: 29, textAlign: 'center' },
  framedText: { color: '#DFE6EC', fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  profileBody: { alignItems: 'center', paddingBottom: 22, paddingHorizontal: 22, paddingTop: 54 },
  avatar: { alignItems: 'center', backgroundColor: COLORS.greenDeep, borderRadius: 46, boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.5)', height: 92, justifyContent: 'center', overflow: 'hidden', width: 92 },
  avatarText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 32, fontWeight: '700' },
  profileName: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  profileEmail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, marginTop: 4, textAlign: 'center' },
  verifiedPill: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 99, flexDirection: 'row', gap: 5, height: 26, marginTop: 10, paddingHorizontal: 11 },
  verifiedText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, fontWeight: '700' },
  photoButtons: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16 },
  photoButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 99, flexDirection: 'row', gap: 6, height: 38, justifyContent: 'center', paddingHorizontal: 16 },
  photoButtonGold: { backgroundColor: COLORS.gold },
  photoButtonText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  photoButtonTextGold: { color: COLORS.greenDeep },

  sectionBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, lineHeight: 19, marginBottom: 12, marginTop: -4 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: 20, gap: 16, overflow: 'hidden', padding: 16 },
  field: { gap: 8 },
  fieldLabel: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2 },
  input: { backgroundColor: 'rgba(0, 0, 0, 0.38)', borderRadius: 14, color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, height: 48, paddingHorizontal: 14 },
  passwordField: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.38)', borderRadius: 14, flexDirection: 'row' },
  passwordInput: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, height: 48, paddingHorizontal: 14 },
  showButton: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  saveButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 14, height: 46, justifyContent: 'center', marginTop: 2 },
  saveButtonText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '700' },
  googleButton: { alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.35)', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, height: 48, justifyContent: 'center', paddingHorizontal: 16 },
  googleMark: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 18, fontWeight: '800' },
  googleButtonText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', flex: 1, height: 1 },
  dividerText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12 },
  textButton: { alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  textButtonText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700' },
  errorText: { color: '#FF8A8A', fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19, marginTop: 10 },
  noticeText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19, marginTop: 10 },

  sync: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  syncText: { fontFamily: TYPOGRAPHY.body, fontSize: 12.5, fontWeight: '700' },
  kicker: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  arabicKicker: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
  languages: { flexDirection: 'row', gap: 8 },
  language: { alignItems: 'center', borderRadius: 16, flex: 1, flexDirection: 'row', gap: 10, minWidth: 0, overflow: 'hidden', padding: 12 },
  radio: { borderColor: 'rgba(205, 216, 203, 0.45)', borderRadius: 9, borderWidth: 2, height: 18, width: 18 },
  radioActive: { borderColor: COLORS.gold, borderWidth: 5 },
  languageText: { flex: 1, minWidth: 0 },
  languageLabel: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, fontWeight: '700' },
  languageNative: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 1 },
  languageNativeActive: { color: COLORS.goldBright },
  rows: { gap: 8 },
  rowsAfterLanguages: { marginTop: 10 },
  row: { alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 18, flexDirection: 'row', gap: 14, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 14 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600' },
  rowDescription: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowValue: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  signOut: { alignItems: 'center', backgroundColor: 'rgba(214, 69, 69, 0.12)', borderRadius: 18, flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 15 },
  signOutText: { color: SIGN_OUT, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '700' },

  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
