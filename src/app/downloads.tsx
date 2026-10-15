'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading, usePageGutter } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import { BuddedCross } from '@/components/vine/ui/Ornaments';
import PageTitle from '@/components/vine/ui/PageTitle';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { Switch } from '@/components/vine/ui/ToggleRow';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import {
  bookDownloadManager, getAutomaticBookUpdatesEnabled, getLastBookUpdateCheck, setAutomaticBookUpdatesEnabled,
} from '@/services/bookDownloadManager';
import { downloadManager, getDownloadPackageDetails } from '@/services/downloadManager';
import { getDownloadPreferences, setDownloadPreferences, type DownloadPreferences } from '@/services/downloadPreferences';
import type { BookDownloadProgress, ManagedContentResource } from '@/types/bookDownloads';
import type { OfflineDownloadProgress, OfflineStorageSummary } from '@/types/offlineDownloads';
import { tr } from '@/utils/appText';
import { formatDayMonthDate, toEasternArabicDigits } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { useLayoutMode } from '@/utils/useLayoutMode';

const EMPTY: OfflineStorageSummary = { packageCount: 0, completeCount: 0, failedCount: 0, totalBytes: 0, musicBytes: 0, learningBytes: 0, bookBytes: 0 };
const MAX_FONT_SCALE = 1.3;
// The storage bar's colours, told apart by lightness as much as by hue.
const MUSIC_GREEN = '#9FD09A';
const LEARNING_GREY = 'rgba(255, 255, 255, 0.3)';

function bytes(value: number, arabic: boolean): string {
  const text = value < 1024 ? `${value} B`
    : value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB`
      : value < 1024 ** 3 ? `${(value / 1024 ** 2).toFixed(1)} MB`
        : `${(value / 1024 ** 3).toFixed(2)} GB`;
  return arabic ? toEasternArabicDigits(text) : text;
}

function percent(progress: number, arabic: boolean) {
  const text = `${Math.round(progress * 100)}%`;
  return arabic ? toEasternArabicDigits(text) : text;
}

/** "today, 12:13 PM", "yesterday, …", or the day itself. */
function lastChecked(iso: string, appLanguage: string): string {
  const date = new Date(iso);
  const arabic = appLanguage === 'ar';
  const locale = arabic ? 'ar-EG' : appLanguage === 'fr' ? 'fr-FR' : 'en-US';
  let time = '';
  try { time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }); } catch { time = ''; }
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  const day = days === 0 ? tr('today', 'aujourd’hui', 'اليوم')
    : days === 1 ? tr('yesterday', 'hier', 'أمس')
      : formatDayMonthDate(date, arabic);
  return time ? `${day}, ${time}` : day;
}

function subscribe(listener: () => void) {
  const media = downloadManager.subscribe(listener);
  const books = bookDownloadManager.subscribe(listener);
  return () => { media(); books(); };
}
function revision() { return `${downloadManager.getRevision()}:${bookDownloadManager.getRevision()}`; }

export default function DownloadsScreen() {
  // Expo Router discovers both route filenames during web bundling. Keep the
  // platform guard as a second line of defence in addition to downloads.web.
  if (Platform.OS === 'web') return <Redirect href={'/account' as any} />;
  return <NativeDownloadsScreen />;
}

type MediaDetails = Record<string, { artworkUri: string | null; mediaCount: number }>;

/**
 * Downloads & Storage (Coptic Vine design, "Library, Search, Downloads"): the
 * space used at a glance, then each book with its state and the one thing it
 * needs, the calendar, when to download, the music and lessons kept offline,
 * and maintenance. One column on a phone, three on the iPad.
 */
function NativeDownloadsScreen() {
  const router = useRouter();
  const { preferences: reading } = useReadingPreferences();
  const arabic = reading.appLanguage === 'ar';
  const wide = useLayoutMode() !== 'phone';
  const currentRevision = useSyncExternalStore(subscribe, revision, revision);
  const [summary, setSummary] = useState<OfflineStorageSummary>(EMPTY);
  const [mediaItems, setMediaItems] = useState<OfflineDownloadProgress[]>([]);
  const [mediaDetails, setMediaDetails] = useState<MediaDetails>({});
  const [books, setBooks] = useState<BookDownloadProgress[]>([]);
  const [resources, setResources] = useState<ManagedContentResource[]>([]);
  const [prefs, setPrefs] = useState<DownloadPreferences>({ wifiOnly: false, allowCellular: true, allowVideoOnCellular: false });
  const [autoUpdates, setAutoUpdates] = useState(true);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      downloadManager.getStorageSummary(), downloadManager.listDownloads(), getDownloadPreferences(),
      bookDownloadManager.listBooks(), bookDownloadManager.listResources(), getAutomaticBookUpdatesEnabled(), getLastBookUpdateCheck(),
    ]).then(async ([nextSummary, items, nextPrefs, nextBooks, nextResources, automatic, checkedAt]) => {
      const media = items.filter((item) => item.domain !== 'books');
      const details = Object.fromEntries(await Promise.all(media.map(async (item) => [item.packageKey, await getDownloadPackageDetails(item.packageKey)] as const)));
      if (!active) return;
      setSummary(nextSummary); setMediaItems(media); setMediaDetails(details); setPrefs(nextPrefs);
      setBooks(nextBooks); setResources(nextResources); setAutoUpdates(automatic); setLastCheck(checkedAt);
    });
    return () => { active = false; };
  }, [currentRevision]);

  const patchPreferences = async (value: Partial<DownloadPreferences>) => setPrefs(await setDownloadPreferences(value));
  const calendar = resources.find((resource) => resource.resourceId === 'calendar');
  const contentBytes = resources.reduce((sum, resource) => sum + resource.bytes, 0);
  const music = mediaItems.filter((item) => item.domain === 'music');
  const learning = mediaItems.filter((item) => item.domain === 'learning');
  const run = async (action: () => Promise<void>) => {
    try { await action(); } catch (error) { if (error instanceof Error && error.message !== 'Download paused.') Alert.alert(tr('Download', 'Téléchargement', 'التنزيل'), error.message); }
  };
  const checkForUpdates = async () => {
    setChecking(true);
    try { await run(() => bookDownloadManager.checkForUpdates(true)); } finally { setChecking(false); }
  };
  const maintenance = async (kind: 'validate' | 'cleanup') => {
    setBusy(true);
    try {
      if (kind === 'validate') {
        const result = await downloadManager.validateIntegrity();
        Alert.alert(
          tr('Downloaded files checked', 'Fichiers vérifiés', 'تم فحص الملفات المنزّلة'),
          result.invalid
            ? tr(`${result.invalid} of ${result.checked} files need to be downloaded again.`, `${result.invalid} fichiers sur ${result.checked} doivent être téléchargés à nouveau.`, `${toEasternArabicDigits(result.invalid)} من ${toEasternArabicDigits(result.checked)} ملفات تحتاج إلى التنزيل من جديد.`)
            : tr(`All ${result.checked} files are complete.`, `Les ${result.checked} fichiers sont complets.`, `جميع الملفات (${toEasternArabicDigits(result.checked)}) مكتملة.`),
        );
      } else {
        const count = await downloadManager.cleanupIncomplete();
        Alert.alert(
          tr('Incomplete downloads cleaned', 'Téléchargements incomplets nettoyés', 'تم تنظيف التنزيلات غير المكتملة'),
          tr(`${count} incomplete file${count === 1 ? '' : 's'} removed.`, `${count} fichier${count === 1 ? '' : 's'} incomplet${count === 1 ? '' : 's'} supprimé${count === 1 ? '' : 's'}.`, `أُزيل ${toEasternArabicDigits(count)} ملف غير مكتمل.`),
        );
      }
    } finally { setBusy(false); }
  };
  const removeAllMedia = () => Alert.alert(
    tr('Remove all media downloads?', 'Supprimer tous les médias téléchargés ?', 'إزالة كل تنزيلات الوسائط؟'),
    tr('Everything downloaded from Music and Learn & Study is removed. Books and the calendar stay.', 'Tout ce qui a été téléchargé depuis Musique et Apprendre est supprimé. Les livres et le calendrier restent.', 'تُزال كل التنزيلات من الموسيقى والتعلّم. تبقى الكتب والتقويم.'),
    [
      { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
      { text: tr('Remove all', 'Tout supprimer', 'إزالة الكل'), style: 'destructive', onPress: () => { void downloadManager.removeAll(); } },
    ],
  );
  const confirmRemoval = (title: string, message: string, remove: () => Promise<void>) => Alert.alert(
    tr(`Remove ${title}?`, `Supprimer ${title} ?`, `إزالة ${title}؟`),
    message,
    [
      { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
      { text: tr('Remove', 'Supprimer', 'إزالة'), style: 'destructive', onPress: () => { void run(remove); } },
    ],
  );
  const confirmBookRemoval = (book: BookDownloadProgress) => confirmRemoval(
    book.title,
    tr('Anything another book or the calendar still uses is kept.', 'Ce qu’un autre livre ou le calendrier utilise encore est conservé.', 'يُحتفظ بكل ما يستخدمه كتاب آخر أو التقويم.'),
    () => bookDownloadManager.remove(book.bookKey),
  );

  const storage = (
    <StorageCard
      arabic={arabic}
      segments={[
        { label: tr('Books', 'Livres', 'الكتب'), bytes: contentBytes, color: COLORS.gold },
        { label: tr('Music', 'Musique', 'الترانيم'), bytes: summary.musicBytes, color: MUSIC_GREEN },
        { label: tr('Learning', 'Apprentissage', 'التعلّم'), bytes: summary.learningBytes, color: LEARNING_GREY },
      ]}
    />
  );

  const booksSection = (
    <Section title={tr('Books', 'Livres', 'الكتب')} arabic={arabic} first={wide}>
      {books.map((book) => (
        <BookRow key={book.bookKey} book={book} arabic={arabic} run={run} onRemove={() => confirmBookRemoval(book)} />
      ))}
      <Row
        quiet
        arabic={arabic}
        icon={<Icon name="refresh" size={21} color={COLORS.gold} />}
        title={checking ? tr('Checking for updates…', 'Recherche de mises à jour…', 'جارٍ البحث عن تحديثات…') : tr('Check for updates', 'Rechercher des mises à jour', 'البحث عن تحديثات')}
        detail={lastCheck ? tr(`Last checked ${lastChecked(lastCheck, reading.appLanguage)}`, `Dernière vérification ${lastChecked(lastCheck, reading.appLanguage)}`, `آخر فحص ${lastChecked(lastCheck, reading.appLanguage)}`) : undefined}
        onPress={checking ? undefined : () => void checkForUpdates()}
      />
    </Section>
  );

  const calendarSection = (
    <Section title={tr('Calendar', 'Calendrier', 'التقويم')} arabic={arabic} first={wide}>
      <Row
        arabic={arabic}
        icon={<Icon name="calendar-outline" size={21} color={COLORS.gold} />}
        title={tr('Liturgical Calendar', 'Calendrier liturgique', 'التقويم الليتورجي')}
        detail={[
          tr('Kept up to date automatically', 'Tenu à jour automatiquement', 'يُحدَّث تلقائيًا'),
          calendar?.bytes ? bytes(calendar.bytes, arabic) : null,
        ].filter(Boolean).join(' · ')}
        trailing={<Text style={[styles.badge, arabic && styles.arabicFont]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Auto', 'Auto', 'تلقائي')}</Text>}
      />
    </Section>
  );

  // Three separate choices, each meaning one thing: whether books update
  // themselves, whether anything may use cellular data at all, and whether
  // videos may too. (Wi-Fi only is just cellular turned off.)
  const cellularOn = prefs.allowCellular && !prefs.wifiOnly;
  const preferencesSection = (
    <Section title={tr('Download Preferences', 'Préférences de téléchargement', 'تفضيلات التنزيل')} arabic={arabic}>
      <SwitchRow
        label={tr('Update books automatically', 'Mettre à jour les livres automatiquement', 'تحديث الكتب تلقائيًا')}
        detail={tr('On Wi-Fi, when a new edition is published', 'En Wi-Fi, à chaque nouvelle édition', 'عبر الواي فاي عند نشر إصدار جديد')}
        arabic={arabic}
        on={autoUpdates}
        onPress={() => { const next = !autoUpdates; setAutoUpdates(next); void setAutomaticBookUpdatesEnabled(next); }}
      />
      <SwitchRow
        label={tr('Download over cellular', 'Télécharger en données cellulaires', 'التنزيل عبر بيانات الجوال')}
        detail={cellularOn
          ? tr('Books and music download on any connection', 'Livres et musique sur toute connexion', 'الكتب والموسيقى على أي اتصال')
          : tr('Downloads wait for Wi-Fi', 'Les téléchargements attendent le Wi-Fi', 'تنتظر التنزيلات شبكة الواي فاي')}
        arabic={arabic}
        on={cellularOn}
        onPress={() => void patchPreferences({ allowCellular: !cellularOn, wifiOnly: cellularOn })}
      />
      <SwitchRow
        label={tr('Videos over cellular', 'Vidéos en données cellulaires', 'الفيديو عبر بيانات الجوال')}
        detail={tr('Lessons with video use far more data', 'Les leçons vidéo consomment bien plus de données', 'تستهلك دروس الفيديو بيانات أكثر بكثير')}
        arabic={arabic}
        on={cellularOn && prefs.allowVideoOnCellular}
        disabled={!cellularOn}
        onPress={() => void patchPreferences({ allowVideoOnCellular: !prefs.allowVideoOnCellular })}
      />
    </Section>
  );

  const mediaSection = (title: string, items: OfflineDownloadProgress[], glyph: IconName, first = false) => (
    <Section title={title} arabic={arabic} first={first}>
      {items.length ? items.map((item) => (
        <MediaRow
          key={item.packageKey}
          item={item}
          details={mediaDetails[item.packageKey]}
          glyph={glyph}
          arabic={arabic}
          onRemove={() => confirmRemoval(item.title, tr('It can be downloaded again at any time.', 'Vous pourrez le télécharger à nouveau.', 'يمكن تنزيله مرة أخرى في أي وقت.'), () => downloadManager.remove(item.packageKey))}
        />
      )) : (
        <View style={[styles.empty, arabic && styles.rowReverse]}>
          <Icon name="cloud-download-outline" size={20} color={COLORS.gold} style={styles.emptyGlyph} />
          <Text style={[styles.emptyText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('No downloads yet.', 'Aucun téléchargement pour l’instant.', 'لا توجد تنزيلات بعد.')}</Text>
        </View>
      )}
    </Section>
  );

  const maintenanceSection = (
    <Section title={tr('Maintenance', 'Entretien', 'الصيانة')} arabic={arabic}>
      <Row
        arabic={arabic}
        icon={<Icon name="shield-checkmark-outline" size={21} color={COLORS.gold} />}
        title={tr('Verify downloaded files', 'Vérifier les fichiers téléchargés', 'التحقق من الملفات المنزّلة')}
        chevron
        onPress={busy ? undefined : () => void maintenance('validate')}
      />
      <Row
        arabic={arabic}
        icon={<Icon name="construct-outline" size={21} color={COLORS.gold} />}
        title={tr('Clean incomplete downloads', 'Nettoyer les téléchargements incomplets', 'تنظيف التنزيلات غير المكتملة')}
        chevron
        onPress={busy ? undefined : () => void maintenance('cleanup')}
      />
      <Pressable accessibilityRole="button" onPress={removeAllMedia} style={({ pressed }) => [styles.destructive, arabic && styles.rowReverse, pressed && styles.pressed]}>
        <Icon name="trash-outline" size={19} color={DESTRUCTIVE} />
        <Text style={[styles.destructiveText, arabic && styles.arabicFont]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {tr('Remove all media downloads', 'Supprimer tous les médias téléchargés', 'إزالة كل تنزيلات الوسائط')}
        </Text>
      </Pressable>
    </Section>
  );

  const title = tr('Downloads & Storage', 'Téléchargements et stockage', 'التنزيلات والتخزين');

  return (
    <View style={styles.page}>
      <PageGlow kind="green" tall={wide} />
      <SafeAreaView edges={['left', 'right']} style={styles.flex}>
        {wide ? (
          <View style={styles.wideHeader}><PageTitle title={title} arabic={arabic} /></View>
        ) : (
          <SubPageHeader compact title={title} arabic={arabic} onBack={() => goBack(router, '/account' as any)} backLabel={tr('Back', 'Retour', 'رجوع')} />
        )}
        <NowPlayingAwareScrollView contentContainerStyle={wide ? styles.contentWide : styles.content} showsVerticalScrollIndicator={false}>
          {wide ? (
            // The iPad's three columns: storage and the books; the calendar,
            // when to download and music; then lessons and maintenance.
            <PageGutterProvider gutter={0}>
              <View style={[styles.columns, arabic && styles.rowReverse]}>
                <View style={styles.column}>{storage}{booksSection}</View>
                <View style={styles.column}>{calendarSection}{preferencesSection}{mediaSection(tr('Music', 'Musique', 'الترانيم'), music, 'musical-notes-outline')}</View>
                <View style={styles.column}>{mediaSection(tr('Learning', 'Apprentissage', 'التعلّم'), learning, 'school-outline', true)}{maintenanceSection}</View>
              </View>
            </PageGutterProvider>
          ) : (
            <PageGutterProvider gutter={16}>
              <View style={styles.gutter}>{storage}</View>
              {booksSection}
              {calendarSection}
              {preferencesSection}
              {mediaSection(tr('Music', 'Musique', 'الترانيم'), music, 'musical-notes-outline')}
              {mediaSection(tr('Learning', 'Apprentissage', 'التعلّم'), learning, 'school-outline')}
              {maintenanceSection}
            </PageGutterProvider>
          )}
        </NowPlayingAwareScrollView>
        <BottomTabBar active="account" />
      </SafeAreaView>
    </View>
  );
}

/** A section heading over its rows, 6pt apart. In the iPad's columns the first one sits at the top. */
function Section({ title, arabic, first = false, children }: { title: string; arabic: boolean; first?: boolean; children: ReactNode }) {
  // In the iPad's columns the rows run to the column's edges, level with the storage card.
  const gutter = usePageGutter();
  return (
    <>
      <View style={first ? styles.firstSection : null}>
        <SectionHeading title={title} arabic={arabic} size="page" />
      </View>
      <View style={[styles.rows, { marginHorizontal: gutter }]}>{children}</View>
    </>
  );
}

/** The space used: the total, a bar split by what takes it, and a key. */
function StorageCard({ arabic, segments }: { arabic: boolean; segments: { label: string; bytes: number; color: string }[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.bytes, 0);
  const [value, unit] = bytes(total, arabic).split(' ');
  return (
    <View style={styles.storage}>
      <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} locations={[0, 0.8]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[styles.eyebrow, arabic && styles.eyebrowArabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('STORAGE USED', 'STOCKAGE UTILISÉ', 'المساحة المستخدمة')}</Text>
      <Text style={[styles.total, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {value} <Text style={styles.totalUnit}>{unit}</Text>
      </Text>
      <View style={[styles.bar, arabic && styles.rowReverse]}>
        {segments.filter((segment) => segment.bytes > 0).map((segment) => (
          <View key={segment.label} style={{ backgroundColor: segment.color, flex: segment.bytes }} />
        ))}
      </View>
      <View style={[styles.legend, arabic && styles.rowReverse]}>
        {segments.map((segment) => (
          <View key={segment.label} style={[styles.legendItem, arabic && styles.rowReverse]}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text style={[styles.legendText, arabic && styles.arabicFont]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{`${segment.label} ${bytes(segment.bytes, arabic)}`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A book with its state and the one thing it needs: Download, Update, Resume or Retry, a ring while it downloads, or a menu once it is in. */
function BookRow({ book, arabic, run, onRemove }: {
  book: BookDownloadProgress;
  arabic: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  onRemove: () => void;
}) {
  const install = () => void run(() => bookDownloadManager.install(book.bookKey));
  const size = book.totalBytes ? bytes(book.totalBytes, arabic) : null;
  const withSize = (status: string) => [status, size].filter(Boolean).join(' · ');
  let detail: ReactNode;
  let detailIcon: ReactNode = null;
  let trailing: ReactNode;
  switch (book.status) {
    case 'installed':
      detailIcon = <Icon name="checkmark-circle" size={14} color={COLORS.gold} />;
      detail = withSize(tr('Downloaded', 'Téléchargé', 'منزّل'));
      trailing = <MenuButton label={tr(`More for ${book.title}`, `Plus pour ${book.title}`, `المزيد لـ ${book.title}`)} onPress={onRemove} />;
      break;
    case 'downloading':
    case 'queued':
      detail = book.status === 'queued'
        ? tr('Waiting to download', 'En attente', 'في انتظار التنزيل')
        : `${tr('Downloading', 'Téléchargement', 'جارٍ التنزيل')} · ${percent(book.progress, arabic)}`;
      trailing = <ProgressRing progress={book.status === 'queued' ? 0 : book.progress} label={tr(`Pause ${book.title}`, `Mettre ${book.title} en pause`, `إيقاف ${book.title} مؤقتًا`)} onPress={() => void run(() => bookDownloadManager.pause(book.bookKey))} />;
      break;
    case 'paused':
      detail = `${tr('Paused', 'En pause', 'متوقف مؤقتًا')} · ${percent(book.progress, arabic)}`;
      trailing = <ActionButton icon="play" label={tr('Resume', 'Reprendre', 'استئناف')} arabic={arabic} onPress={install} />;
      break;
    case 'failed':
      detail = tr('Couldn’t finish downloading', 'Téléchargement interrompu', 'تعذّر إكمال التنزيل');
      trailing = <ActionButton icon="refresh" label={tr('Retry', 'Réessayer', 'أعد المحاولة')} arabic={arabic} onPress={install} />;
      break;
    case 'update_available':
      detail = <><Text style={styles.detailGold}>{tr('Update available', 'Mise à jour disponible', 'يتوفر تحديث')}</Text>{size ? ` · ${size}` : ''}</>;
      trailing = <ActionButton label={tr('Update', 'Mettre à jour', 'تحديث')} arabic={arabic} filled onPress={install} />;
      break;
    default:
      detail = withSize(tr('Not downloaded', 'Non téléchargé', 'غير منزّل'));
      trailing = <ActionButton icon="arrow-down" label={tr('Download', 'Télécharger', 'تنزيل')} arabic={arabic} onPress={install} />;
  }
  return (
    <Row
      arabic={arabic}
      icon={<BuddedCross size={22} />}
      title={book.title}
      detail={detail}
      detailIcon={detailIcon}
      trailing={trailing}
      // A partial download (paused, failed, waiting for an update) can still be removed, by a long press.
      onLongPress={book.status === 'not_downloaded' || book.status === 'installed' ? undefined : onRemove}
    />
  );
}

/** A downloaded release, album or playlist: its saved cover, how many tracks, and its size. */
function MediaRow({ item, details, glyph, arabic, onRemove }: {
  item: OfflineDownloadProgress;
  details?: { artworkUri: string | null; mediaCount: number };
  glyph: IconName;
  arabic: boolean;
  onRemove: () => void;
}) {
  const inProgress = item.status === 'downloading' || item.status === 'queued' || item.status === 'paused';
  const count = details?.mediaCount ?? 0;
  const tracks = count > 1
    ? tr(`${count} tracks`, `${count} pistes`, `${toEasternArabicDigits(count)} مقاطع`)
    : null;
  const detail = inProgress
    ? `${item.status === 'paused' ? tr('Paused', 'En pause', 'متوقف مؤقتًا') : tr('Downloading', 'Téléchargement', 'جارٍ التنزيل')} · ${percent(item.progress, arabic)}`
    : item.status === 'failed'
      ? tr('Couldn’t finish downloading', 'Téléchargement interrompu', 'تعذّر إكمال التنزيل')
      : [tracks, bytes(item.bytesWritten, arabic)].filter(Boolean).join(' · ');
  return (
    <Row
      arabic={arabic}
      icon={details?.artworkUri ? (
        <Image source={{ uri: details.artworkUri }} contentFit="cover" style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbBlank]}><Icon name={glyph} size={20} color={COLORS.gold} /></View>
      )}
      title={item.title}
      detail={detail}
      trailing={<MenuButton label={tr(`More for ${item.title}`, `Plus pour ${item.title}`, `المزيد لـ ${item.title}`)} onPress={onRemove} />}
    />
  );
}

/** One row card: a gold glyph or cover, the name over its state, then whatever the row offers. */
function Row({ icon, title, detail, detailIcon, trailing, chevron = false, quiet = false, arabic, onPress, onLongPress }: {
  icon: ReactNode;
  title: string;
  detail?: ReactNode;
  /** A glyph before the state, 5pt from it: the gold check of a downloaded book. */
  detailIcon?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  /** The quieter "Check for updates" row, without the cards' fade. */
  quiet?: boolean;
  arabic: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const body = (
    <>
      {quiet ? null : <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />}
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
        {detail ? (
          <View style={[styles.detailRow, arabic && styles.rowReverse]}>
            {detailIcon}
            <Text style={[styles.rowDetail, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text>
          </View>
        ) : null}
      </View>
      {trailing}
      {/* Wrapped, so it stacks above the gradient on the web, where a bare SVG paints beneath it. */}
      {chevron ? <View style={styles.chevron}><Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={17} color={COLORS.gold} /></View> : null}
    </>
  );
  const style = [styles.row, quiet && styles.rowQuiet, arabic && styles.rowReverse];
  if (!onPress && !onLongPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [...style, pressed && onPress && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

function SwitchRow({ label, detail, arabic, on, disabled = false, onPress }: {
  label: string;
  /** A word under the label on what the choice does. */
  detail?: string;
  arabic: boolean;
  on: boolean;
  /** Greyed and inert while another choice makes this one moot. */
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.switchRow, arabic && styles.rowReverse, disabled && styles.switchRowDisabled, pressed && styles.pressed]}
    >
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.rowText}>
        <Text style={[styles.switchLabel, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text> : null}
      </View>
      <Switch on={on && !disabled} />
    </Pressable>
  );
}

/** A row's one action: gold on gold's wash, or filled gold for an update waiting. */
function ActionButton({ icon, label, arabic, filled = false, onPress }: { icon?: IconName; label: string; arabic: boolean; filled?: boolean; onPress: () => void }) {
  const color = filled ? COLORS.greenDeep : COLORS.gold;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, filled && styles.actionFilled, arabic && styles.rowReverse, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={15} color={color} /> : null}
      <Text style={[styles.actionText, { color }, arabic && styles.arabicFont]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
    </Pressable>
  );
}

function MenuButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}>
      <Icon name="ellipsis-horizontal" size={19} color={COLORS.muted} />
    </Pressable>
  );
}

/** How far a download has got, round a stop square that pauses it. */
function ProgressRing({ progress, label, onPress }: { progress: number; label: string; onPress: () => void }) {
  const size = 34;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.ring, pressed && styles.pressed]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255, 255, 255, 0.12)" strokeWidth={stroke} fill="#0F2617" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.gold}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringStop} />
    </Pressable>
  );
}

const DESTRUCTIVE = '#FF8A7A';

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.black, flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 28 },
  contentWide: { paddingBottom: 28, paddingHorizontal: 36 },
  wideHeader: { paddingHorizontal: 20 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 24, marginTop: 2 },
  column: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: 16 },
  rowReverse: { flexDirection: 'row-reverse' },
  pressed: { opacity: 0.82 },
  firstSection: { marginTop: -24 },

  // The space used, on the day block's green (the design's "dl-st").
  storage: { borderRadius: 22, boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.35)', marginTop: 4, overflow: 'hidden', padding: 18 },
  eyebrow: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8 },
  eyebrowArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
  total: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 40, fontWeight: '700', lineHeight: 44, marginTop: 8 },
  totalUnit: { color: COLORS.goldBright, fontSize: 20 },
  bar: { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 99, flexDirection: 'row', gap: 3, height: 10, marginTop: 16, overflow: 'hidden' },
  legend: { columnGap: 14, flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, rowGap: 6 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { color: 'rgba(255, 255, 255, 0.85)', fontFamily: TYPOGRAPHY.body, fontSize: 13 },

  // Rows 6pt apart, each a card fading down to the surface (the design's "dl-r").
  rows: { gap: 6 },
  row: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 58, overflow: 'hidden', paddingLeft: 14, paddingRight: 10, paddingVertical: 9 },
  rowQuiet: { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  rowIcon: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', lineHeight: 20 },
  detailRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 2 },
  rowDetail: { color: COLORS.muted, flexShrink: 1, fontFamily: TYPOGRAPHY.body, fontSize: 12.5 },
  detailGold: { color: COLORS.goldBright, fontWeight: '600' },
  chevron: { marginRight: 4 },
  thumb: { borderRadius: 10, height: 44, marginLeft: -5, width: 44 },
  thumbBlank: { alignItems: 'center', backgroundColor: COLORS.surfaceSoft, justifyContent: 'center' },
  switchRow: { minHeight: 54 },
  switchLabel: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  switchRowDisabled: { opacity: 0.5 },
  badge: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 99, color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', lineHeight: 26, overflow: 'hidden', paddingHorizontal: 10 },
  action: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 99, flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 13 },
  actionFilled: { backgroundColor: COLORS.gold },
  actionText: { fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700' },
  menu: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  ring: { alignItems: 'center', height: 34, justifyContent: 'center', marginRight: 2, width: 34 },
  ringStop: { backgroundColor: COLORS.gold, borderRadius: 2, height: 10, width: 10 },
  empty: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  emptyGlyph: { opacity: 0.7 },
  emptyText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  destructive: { alignItems: 'center', backgroundColor: 'rgba(214, 69, 69, 0.12)', borderRadius: 16, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 58 },
  destructiveText: { color: DESTRUCTIVE, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },

  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
  arabicFont: { fontFamily: TYPOGRAPHY.arabic },
});
