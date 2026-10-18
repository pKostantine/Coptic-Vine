'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { InlineSwitch } from '@/components/canon/CanonEditorParts';
import { agpeyaHourName, canonFrequencyLabel, canonGoalLabel, canonItemTitle, canonTimeLabel } from '@/components/canon/canonText';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, SectionHeading } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useSpiritualCanon } from '@/context/SpiritualCanonContext';
import { tr } from '@/utils/appText';
import { goBack } from '@/utils/navigation';
import { canonHasReminders, MAX_CANON_ITEMS, sortHourPlans, WEEKDAYS, type CanonItem, type CanonKind } from '@/utils/spiritualCanon';

const MAX_FONT_SCALE = 1.3;

const CANON_KIND_ICONS: Record<CanonKind, IconName> = {
  agpeya: 'sunrise',
  bible: 'book-outline',
  custom: 'checkmark-done',
};

/** The line under an item in the list: what it asks, how often, when. */
function itemSummary(item: CanonItem): string {
  if (item.kind === 'agpeya') {
    if (item.pattern === 'byDay') {
      // Every hour kept on some day, in the order of the day.
      const hours = sortHourPlans(WEEKDAYS.flatMap((day) => item.days[day]).filter((plan, index, all) => all.findIndex((other) => other.hourId === plan.hourId) === index));
      return [canonFrequencyLabel({ kind: 'byDay' }), hours.map((plan) => agpeyaHourName(plan.hourId, 'traditional')).join(', ')].filter(Boolean).join(' · ');
    }
    const names = item.hours.map((plan) => agpeyaHourName(plan.hourId, 'traditional')).join(', ');
    return [names, canonFrequencyLabel(item.frequency)].filter(Boolean).join(' · ');
  }
  return [canonGoalLabel(item.goal), canonFrequencyLabel(item.frequency), item.time ? canonTimeLabel(item.time) : null]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

/**
 * Editing the spiritual canon: what it holds, each opening its own editor;
 * the three kinds of thing to add; and whether this device sends the
 * reminders.
 */
export default function CanonEditScreen() {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const canon = useSpiritualCanon();
  const full = canon.items.length >= MAX_CANON_ITEMS;
  const anyReminders = canonHasReminders(canon.items);

  const add = (kind: CanonKind) => router.push({ pathname: '/canon/[id]', params: { id: 'new', kind } } as never);
  const open = (item: CanonItem) => router.push({ pathname: '/canon/[id]', params: { id: item.id } } as never);

  const title = tr('Edit Canon', 'Modifier le canon', 'تعديل القانون');
  const kinds: { kind: CanonKind; title: string; detail: string }[] = [
    {
      kind: 'agpeya',
      title: tr('Agpeya', 'Agpia', 'الأجبية'),
      detail: tr(
        'Hours of the Agpeya, by psalms or by time — the same each day or by day of the week',
        'Des heures de l’Agpia, en psaumes ou en temps — les mêmes chaque jour ou selon le jour',
        'ساعات من الأجبية، بالمزامير أو بالوقت — نفسها كل يوم أو حسب أيام الأسبوع',
      ),
    },
    {
      kind: 'bible',
      title: tr('Bible reading', 'Lecture de la Bible', 'قراءة الكتاب المقدس'),
      detail: tr('A number of chapters, or a time in the Scriptures', 'Un nombre de chapitres, ou un temps dans les Écritures', 'عدد من الإصحاحات، أو وقت في الكتاب المقدس'),
    },
    {
      kind: 'custom',
      title: tr('Something else', 'Autre chose', 'شيء آخر'),
      detail: tr('Metanias, a prayer, a fast — anything you keep', 'Métanies, une prière, un jeûne — tout ce que vous gardez', 'مطانيات، صلاة، صوم — كل ما تحافظ عليه'),
    },
  ];

  const reminderNote = Platform.OS === 'web'
    ? tr(
      'Reminders come to the Coptic Vine app on your phone or tablet.',
      'Les rappels arrivent dans l’application Coptic Vine sur votre téléphone ou votre tablette.',
      'تصل التذكيرات إلى تطبيق كوبتك فاين على هاتفك أو جهازك اللوحي.',
    )
    : canon.reminderPermission === 'denied'
      ? tr('Notifications are turned off for Coptic Vine in Settings.', 'Les notifications de Coptic Vine sont désactivées dans les Réglages.', 'الإشعارات متوقفة لكوبتك فاين في الإعدادات.')
      : tr(
        'Each device with Coptic Vine can send the reminders; turn them off here for this one.',
        'Chaque appareil avec Coptic Vine peut envoyer les rappels ; désactivez-les ici pour celui-ci.',
        'يمكن لكل جهاز عليه كوبتك فاين إرسال التذكيرات؛ أوقفها هنا لهذا الجهاز.',
      );

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head><title>{title}</title></Head>
      <SubPageHeader compact title={title} arabic={arabic} onBack={() => goBack(router, '/canon' as never)} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.firstSection}>
            <SectionHeading size="page" title={tr('Your canon', 'Votre canon', 'قانونك')} arabic={arabic} />
          </View>
          <View style={styles.rows}>
            {canon.items.length ? canon.items.map((item) => (
              <Row
                key={item.id}
                icon={CANON_KIND_ICONS[item.kind]}
                title={canonItemTitle(item)}
                detail={itemSummary(item)}
                arabic={arabic}
                onPress={() => open(item)}
              />
            )) : (
              <View style={styles.note}>
                <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {canon.loaded
                    ? tr('Nothing in your canon yet. Add the first below.', 'Rien dans votre canon pour l’instant. Ajoutez le premier ci-dessous.', 'لا شيء في قانونك بعد. أضف الأول أدناه.')
                    : tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}
                </Text>
              </View>
            )}
          </View>

          <SectionHeading size="page" title={tr('Add to your canon', 'Ajouter à votre canon', 'أضف إلى قانونك')} arabic={arabic} />
          <View style={styles.rows}>
            {kinds.map((entry) => (
              <Row
                key={entry.kind}
                icon={CANON_KIND_ICONS[entry.kind]}
                title={entry.title}
                detail={entry.detail}
                arabic={arabic}
                add
                disabled={full || !canon.loaded}
                onPress={() => add(entry.kind)}
              />
            ))}
            {full ? (
              <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr('Your canon is full. Remove something to add more.', 'Votre canon est plein. Retirez un élément pour en ajouter.', 'قانونك ممتلئ. احذف شيئًا لتضيف غيره.')}
              </Text>
            ) : null}
          </View>

          <SectionHeading size="page" title={tr('Reminders', 'Rappels', 'التذكيرات')} arabic={arabic} />
          <View style={styles.reminders}>
            <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            {Platform.OS === 'web' ? (
              <View style={styles.webNote}>
                <Icon name="notifications-outline" size={19} color={COLORS.muted} />
                <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{reminderNote}</Text>
              </View>
            ) : (
              <InlineSwitch
                icon="notifications-outline"
                label={tr('Reminders on this device', 'Rappels sur cet appareil', 'التذكيرات على هذا الجهاز')}
                detail={anyReminders ? reminderNote : tr('Set a time and turn on “Remind me” on anything in your canon.', 'Choisissez une heure et activez « Me le rappeler » sur un élément de votre canon.', 'اختر وقتًا وفعّل «ذكّرني» لأي شيء في قانونك.')}
                on={canon.remindersEnabled}
                onPress={() => canon.setRemindersEnabled(!canon.remindersEnabled)}
                arabic={arabic}
              />
            )}
            {Platform.OS !== 'web' && canon.reminderPermission === 'denied' && canon.remindersEnabled && anyReminders ? (
              <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
                <Text style={[styles.settingsText, arabic && styles.arabicTight]}>{tr('Open Settings', 'Ouvrir les Réglages', 'افتح الإعدادات')}</Text>
              </Pressable>
            ) : null}
          </View>

          {canon.loaded && !canon.signedIn ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/account' as never)} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
              <Icon name="person-circle-outline" size={22} color={COLORS.gold} />
              <Text style={[styles.accountText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr('Your canon is kept on this device. Sign in to keep it on all your devices.', 'Votre canon est gardé sur cet appareil. Connectez-vous pour le retrouver partout.', 'قانونك محفوظ على هذا الجهاز. سجّل الدخول ليبقى على كل أجهزتك.')}
              </Text>
              <Icon name="chevron-forward" size={16} color={COLORS.gold} />
            </Pressable>
          ) : null}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

function Row({ icon, title, detail, arabic, add = false, disabled = false, onPress }: {
  icon: IconName;
  title: string;
  detail: string;
  arabic: boolean;
  /** One of the ways to add: a gold plus where the others have a chevron. */
  add?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={add ? `${tr('Add', 'Ajouter', 'أضف')}: ${title}` : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.rowIcon}>
        <Icon name={icon} size={19} color={COLORS.gold} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
        <Text style={[styles.rowDetail, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text>
      </View>
      <View style={add ? styles.addBadge : styles.chevron}>
        <Icon name={add ? 'add' : 'chevron-forward'} size={add ? 18 : 17} color={add ? COLORS.greenDeep : COLORS.gold} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', maxWidth: 640, width: '100%' },
  firstSection: { marginTop: -24 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  rows: { gap: 6 },
  row: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 64, overflow: 'hidden', paddingLeft: 14, paddingRight: 12, paddingVertical: 10 },
  rowIcon: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', lineHeight: 20 },
  rowDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  chevron: { marginRight: 2 },
  addBadge: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  note: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  noteText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  quiet: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingHorizontal: 4, paddingTop: 4 },
  reminders: { borderRadius: 16, gap: 8, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 8 },
  webNote: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 44 },
  settingsButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: COLORS.goldSoft, borderRadius: 99, height: 34, justifyContent: 'center', marginBottom: 6, paddingHorizontal: 14 },
  settingsText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700' },
  account: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 22, paddingHorizontal: 14, paddingVertical: 13 },
  accountText: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
