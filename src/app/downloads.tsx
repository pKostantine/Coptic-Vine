'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import ToggleRow from '@/components/vine/ui/ToggleRow';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { bookDownloadManager, getAutomaticBookUpdatesEnabled, setAutomaticBookUpdatesEnabled } from '@/services/bookDownloadManager';
import { downloadManager } from '@/services/downloadManager';
import { getDownloadPreferences, setDownloadPreferences, type DownloadPreferences } from '@/services/downloadPreferences';
import type { BookDownloadProgress, BookDownloadStatus, ManagedContentResource } from '@/types/bookDownloads';
import type { OfflineDownloadProgress, OfflineDownloadStatus, OfflineStorageSummary } from '@/types/offlineDownloads';
import { tr } from '@/utils/appText';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { useLayoutMode } from '@/utils/useLayoutMode';

const EMPTY: OfflineStorageSummary = { packageCount: 0, completeCount: 0, failedCount: 0, totalBytes: 0, musicBytes: 0, learningBytes: 0, bookBytes: 0 };
const MAX_FONT_SCALE = 1.3;

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

const BOOK_STATUS: Record<BookDownloadStatus, () => string> = {
  not_downloaded: () => tr('Not downloaded', 'Non téléchargé', 'غير منزّل'),
  queued: () => tr('Waiting to download', 'En attente', 'في انتظار التنزيل'),
  downloading: () => tr('Downloading', 'Téléchargement', 'جارٍ التنزيل'),
  paused: () => tr('Paused', 'En pause', 'متوقف مؤقتًا'),
  installed: () => tr('Downloaded', 'Téléchargé', 'منزّل'),
  update_available: () => tr('Update available', 'Mise à jour disponible', 'يتوفر تحديث'),
  failed: () => tr('Couldn’t finish downloading', 'Téléchargement interrompu', 'تعذّر إكمال التنزيل'),
};

const MEDIA_STATUS: Record<OfflineDownloadStatus, () => string> = {
  idle: () => tr('Waiting to download', 'En attente', 'في انتظار التنزيل'),
  queued: () => tr('Waiting to download', 'En attente', 'في انتظار التنزيل'),
  downloading: () => tr('Downloading', 'Téléchargement', 'جارٍ التنزيل'),
  paused: () => tr('Paused', 'En pause', 'متوقف مؤقتًا'),
  complete: () => tr('Downloaded', 'Téléchargé', 'منزّل'),
  failed: () => tr('Couldn’t finish downloading', 'Téléchargement interrompu', 'تعذّر إكمال التنزيل'),
  cancelled: () => tr('Cancelled', 'Annulé', 'أُلغي'),
};

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

/**
 * Downloads & Storage (Coptic Vine design): the page's green glow, the space
 * used on a green block, then the books, the calendar, when to download, the
 * music and lessons kept offline, and upkeep -- each under a section heading,
 * every item on a card of its own.
 */
function NativeDownloadsScreen() {
  const router = useRouter();
  const { preferences: reading } = useReadingPreferences();
  const arabic = reading.appLanguage === 'ar';
  const wide = useLayoutMode() !== 'phone';
  const currentRevision = useSyncExternalStore(subscribe, revision, revision);
  const [summary, setSummary] = useState<OfflineStorageSummary>(EMPTY);
  const [mediaItems, setMediaItems] = useState<OfflineDownloadProgress[]>([]);
  const [books, setBooks] = useState<BookDownloadProgress[]>([]);
  const [resources, setResources] = useState<ManagedContentResource[]>([]);
  const [prefs, setPrefs] = useState<DownloadPreferences>({ wifiOnly: false, allowCellular: true, allowVideoOnCellular: false });
  const [autoUpdates, setAutoUpdates] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([downloadManager.getStorageSummary(), downloadManager.listDownloads(), getDownloadPreferences(), bookDownloadManager.listBooks(), bookDownloadManager.listResources(), getAutomaticBookUpdatesEnabled()])
      .then(([nextSummary, items, nextPrefs, nextBooks, nextResources, automatic]) => {
        if (!active) return;
        setSummary(nextSummary); setMediaItems(items.filter((item) => item.domain !== 'books')); setPrefs(nextPrefs);
        setBooks(nextBooks); setResources(nextResources); setAutoUpdates(automatic);
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
          tr('Unfinished downloads cleared', 'Téléchargements inachevés effacés', 'تم مسح التنزيلات غير المكتملة'),
          tr(`${count} unfinished file${count === 1 ? '' : 's'} removed.`, `${count} fichier${count === 1 ? '' : 's'} inachevé${count === 1 ? '' : 's'} supprimé${count === 1 ? '' : 's'}.`, `أُزيل ${toEasternArabicDigits(count)} ملف غير مكتمل.`),
        );
      }
    } finally { setBusy(false); }
  };
  const removeAllMedia = () => Alert.alert(
    tr('Remove all music and lessons?', 'Supprimer toute la musique et les leçons ?', 'إزالة كل الموسيقى والدروس؟'),
    tr('Everything downloaded from Music and Learn & Study is removed. Books and the calendar stay.', 'Tout ce qui a été téléchargé depuis Musique et Apprendre est supprimé. Les livres et le calendrier restent.', 'تُزال كل التنزيلات من الموسيقى والتعلّم. تبقى الكتب والتقويم.'),
    [
      { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
      { text: tr('Remove all', 'Tout supprimer', 'إزالة الكل'), style: 'destructive', onPress: () => { void downloadManager.removeAll(); } },
    ],
  );
  const confirmBookRemoval = (book: BookDownloadProgress) => Alert.alert(
    tr(`Remove ${book.title}?`, `Supprimer ${book.title} ?`, `إزالة ${book.title}؟`),
    tr('Anything another book or the calendar still uses is kept.', 'Ce qu’un autre livre ou le calendrier utilise encore est conservé.', 'يُحتفظ بكل ما يستخدمه كتاب آخر أو التقويم.'),
    [
      { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
      { text: tr('Remove', 'Supprimer', 'إزالة'), style: 'destructive', onPress: () => { void run(() => bookDownloadManager.remove(book.bookKey)); } },
    ],
  );

  // The one thing a book's row offers besides removing it.
  const bookAction = (book: BookDownloadProgress): { icon: IconName; label: string; onPress: () => void } | null => {
    switch (book.status) {
      case 'installed': return null;
      case 'downloading':
      case 'queued': return { icon: 'pause', label: tr('Pause', 'Pause', 'إيقاف مؤقت'), onPress: () => void run(() => bookDownloadManager.pause(book.bookKey)) };
      case 'paused': return { icon: 'play', label: tr('Resume', 'Reprendre', 'استئناف'), onPress: () => void run(() => bookDownloadManager.install(book.bookKey)) };
      case 'failed': return { icon: 'repeat', label: tr('Retry', 'Réessayer', 'أعد المحاولة'), onPress: () => void run(() => bookDownloadManager.install(book.bookKey)) };
      case 'update_available': return { icon: 'download-outline', label: tr('Update', 'Mettre à jour', 'تحديث'), onPress: () => void run(() => bookDownloadManager.install(book.bookKey)) };
      default: return { icon: 'download-outline', label: tr('Download', 'Télécharger', 'تنزيل'), onPress: () => void run(() => bookDownloadManager.install(book.bookKey)) };
    }
  };
  const bookDetail = (book: BookDownloadProgress) => {
    const status = BOOK_STATUS[book.status]();
    if (book.status === 'downloading' || book.status === 'paused') return `${status} · ${percent(book.progress, arabic)}`;
    return book.totalBytes ? `${status} · ${bytes(book.totalBytes, arabic)}` : status;
  };

  const used = summary.musicBytes + summary.learningBytes + contentBytes;

  return (
    <View style={styles.page}>
      <PageGlow kind="green" tall={wide} />
      <SafeAreaView edges={['left', 'right']} style={styles.flex}>
        <SubPageHeader
          title={tr('Downloads & Storage', 'Téléchargements et stockage', 'التنزيلات والتخزين')}
          arabic={arabic}
          onBack={() => goBack(router, '/account' as any)}
          backLabel={tr('Back', 'Retour', 'رجوع')}
        />
        <NowPlayingAwareScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} showsVerticalScrollIndicator={false}>
          <PageGutterProvider gutter={16}>
            <View style={[styles.gutter, styles.block]}>
              <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <Text style={[styles.eyebrow, arabic && styles.eyebrowArabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr('ON THIS DEVICE', 'SUR CET APPAREIL', 'على هذا الجهاز')}
              </Text>
              <Text style={[styles.total, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{bytes(used, arabic)}</Text>
              <View style={[styles.tiles, arabic && styles.rowReverse]}>
                <StatTile label={tr('Books', 'Livres', 'الكتب')} value={bytes(contentBytes, arabic)} arabic={arabic} />
                <StatTile label={tr('Music', 'Musique', 'الترانيم')} value={bytes(summary.musicBytes, arabic)} arabic={arabic} />
                <StatTile label={tr('Learn', 'Apprendre', 'التعلّم')} value={bytes(summary.learningBytes, arabic)} arabic={arabic} />
              </View>
            </View>

            <SectionHeading
              title={tr('Books', 'Livres', 'الكتب')}
              arabic={arabic}
              trailing={(
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void run(() => bookDownloadManager.checkForUpdates(true))} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={[styles.textButton, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Check for updates', 'Rechercher des mises à jour', 'البحث عن تحديثات')}</Text>
                </Pressable>
              )}
            />
            <View style={[styles.gutter, styles.rows]}>
              {books.map((book) => (
                <ItemRow
                  key={book.bookKey}
                  icon="library-outline"
                  title={book.title}
                  detail={bookDetail(book)}
                  progress={book.status === 'downloading' || book.status === 'paused' ? book.progress : undefined}
                  arabic={arabic}
                  action={bookAction(book)}
                  onRemove={book.status === 'not_downloaded' ? undefined : () => confirmBookRemoval(book)}
                />
              ))}
            </View>

            <SectionHeading title={tr('Calendar', 'Calendrier', 'التقويم')} arabic={arabic} />
            <View style={[styles.gutter, styles.rows]}>
              <ItemRow
                icon="calendar-outline"
                title={tr('Liturgical Calendar', 'Calendrier liturgique', 'التقويم الليتورجي')}
                detail={`${tr('Kept up to date for you', 'Tenu à jour pour vous', 'يُحدَّث تلقائيًا')} · ${calendar ? BOOK_STATUS[calendar.state]() : tr('Waiting for Wi-Fi', 'En attente du Wi-Fi', 'في انتظار الواي فاي')}`}
                value={calendar?.bytes ? bytes(calendar.bytes, arabic) : undefined}
                arabic={arabic}
              />
            </View>

            <SectionHeading title={tr('When to Download', 'Quand télécharger', 'متى يتم التنزيل')} arabic={arabic} />
            <View style={[styles.gutter, styles.rows]}>
              <ToggleRow
                label={tr('Update books automatically on Wi-Fi', 'Mettre à jour les livres en Wi-Fi', 'تحديث الكتب تلقائيًا عبر الواي فاي')}
                isArabic={arabic}
                active={autoUpdates}
                onPress={() => { const next = !autoUpdates; setAutoUpdates(next); void setAutomaticBookUpdatesEnabled(next); }}
              />
              <ToggleRow
                label={tr('Download on Wi-Fi only', 'Télécharger en Wi-Fi uniquement', 'التنزيل عبر الواي فاي فقط')}
                isArabic={arabic}
                active={prefs.wifiOnly}
                onPress={() => void patchPreferences({ wifiOnly: !prefs.wifiOnly, allowCellular: prefs.wifiOnly ? prefs.allowCellular : false })}
              />
              <ToggleRow
                label={tr('Allow cellular data', 'Autoriser les données cellulaires', 'السماح ببيانات الجوال')}
                isArabic={arabic}
                active={prefs.allowCellular && !prefs.wifiOnly}
                onPress={() => void patchPreferences({ allowCellular: !prefs.allowCellular, wifiOnly: prefs.allowCellular ? true : false })}
              />
              <ToggleRow
                label={tr('Allow video on cellular data', 'Autoriser la vidéo en données cellulaires', 'السماح بالفيديو عبر بيانات الجوال')}
                isArabic={arabic}
                active={prefs.allowVideoOnCellular}
                onPress={() => void patchPreferences({ allowVideoOnCellular: !prefs.allowVideoOnCellular })}
              />
            </View>

            <MediaSection title={tr('Music', 'Musique', 'الترانيم')} icon="musical-notes-outline" items={music} arabic={arabic} onRemove={(key) => void run(() => downloadManager.remove(key))} />
            <MediaSection title={tr('Learn & Study', 'Apprendre et étudier', 'التعلّم والدراسة')} icon="school-outline" items={learning} arabic={arabic} onRemove={(key) => void run(() => downloadManager.remove(key))} />

            <SectionHeading title={tr('Upkeep', 'Entretien', 'الصيانة')} arabic={arabic} />
            <View style={[styles.gutter, styles.rows]}>
              <ItemRow
                icon="eye-outline"
                title={tr('Check downloaded files', 'Vérifier les fichiers téléchargés', 'فحص الملفات المنزّلة')}
                detail={tr('Find any file that needs downloading again', 'Trouver les fichiers à télécharger à nouveau', 'العثور على أي ملف يحتاج إلى التنزيل من جديد')}
                arabic={arabic}
                onPress={busy ? undefined : () => void maintenance('validate')}
              />
              <ItemRow
                icon="trash-outline"
                title={tr('Clear unfinished downloads', 'Effacer les téléchargements inachevés', 'مسح التنزيلات غير المكتملة')}
                detail={tr('Free the space taken by downloads that stopped partway', 'Libérer l’espace des téléchargements interrompus', 'تحرير المساحة التي تشغلها التنزيلات المتوقفة')}
                arabic={arabic}
                onPress={busy ? undefined : () => void maintenance('cleanup')}
              />
              <Pressable accessibilityRole="button" onPress={removeAllMedia} style={({ pressed }) => [styles.destructive, pressed && styles.pressed]}>
                <Text style={[styles.destructiveText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {tr('Remove all music and lessons', 'Supprimer toute la musique et les leçons', 'إزالة كل الموسيقى والدروس')}
                </Text>
              </Pressable>
            </View>
          </PageGutterProvider>
        </NowPlayingAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

/** The space one kind of download takes, on an inset tile in the green block. */
function StatTile({ label, value, arabic }: { label: string; value: string; arabic: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileLabel, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
      <Text style={[styles.tileValue, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{value}</Text>
    </View>
  );
}

/** One download on its own card: a gold glyph, its name and state, then what can be done with it. */
function ItemRow({ icon, title, detail, value, progress, arabic, action, onRemove, onPress }: {
  icon: IconName;
  title: string;
  detail?: string;
  value?: string;
  /** A gold bar under the state while a download is under way or paused. */
  progress?: number;
  arabic: boolean;
  action?: { icon: IconName; label: string; onPress: () => void } | null;
  onRemove?: () => void;
  onPress?: () => void;
}) {
  const body = (
    <>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Icon name={icon} size={21} color={COLORS.gold} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
        {detail ? <Text style={[styles.rowDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text> : null}
        {progress !== undefined ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(2, Math.min(100, Math.round(progress * 100)))}%` }, arabic && styles.progressFillArabic]} />
          </View>
        ) : null}
      </View>
      {value ? <Text style={[styles.rowValue, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{value}</Text> : null}
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${action.label} ${title}`} onPress={action.onPress} style={({ pressed }) => [styles.chip, arabic && styles.rowReverse, pressed && styles.pressed]}>
          <Icon name={action.icon} size={14} color={COLORS.gold} />
          <Text style={[styles.chipText, arabic && styles.arabicChip]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{action.label}</Text>
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tr(`Remove ${title}`, `Supprimer ${title}`, `إزالة ${title}`)} hitSlop={8} onPress={onRemove} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="trash-outline" size={19} color={COLORS.muted} />
        </Pressable>
      ) : null}
      {onPress ? <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={17} color={COLORS.gold} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, arabic && styles.rowReverse]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, arabic && styles.rowReverse, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

function MediaSection({ title, icon, items, arabic, onRemove }: {
  title: string;
  icon: IconName;
  items: OfflineDownloadProgress[];
  arabic: boolean;
  onRemove: (key: string) => void;
}) {
  return (
    <>
      <SectionHeading title={title} arabic={arabic} />
      <View style={[styles.gutter, styles.rows]}>
        {items.length ? items.map((item) => (
          <ItemRow
            key={item.packageKey}
            icon={icon}
            title={item.title}
            detail={item.status === 'downloading' || item.status === 'paused'
              ? `${MEDIA_STATUS[item.status]()} · ${percent(item.progress, arabic)}`
              : `${MEDIA_STATUS[item.status]()} · ${bytes(item.bytesWritten, arabic)}`}
            progress={item.status === 'downloading' || item.status === 'paused' ? item.progress : undefined}
            arabic={arabic}
            onRemove={() => onRemove(item.packageKey)}
          />
        )) : <Empty arabic={arabic}>{tr('Nothing downloaded yet.', 'Rien de téléchargé pour l’instant.', 'لا توجد تنزيلات بعد.')}</Empty>}
      </View>
    </>
  );
}

function Empty({ arabic, children }: { arabic: boolean; children: ReactNode }) {
  return <Text style={[styles.empty, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{children}</Text>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.black, flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 32 },
  contentWide: { alignSelf: 'center', maxWidth: 720, width: '100%' },
  gutter: { marginHorizontal: 16 },
  rowReverse: { flexDirection: 'row-reverse' },
  pressed: { opacity: 0.82 },

  // The space used, on the day block's green.
  block: { borderRadius: 24, overflow: 'hidden', paddingBottom: 16, paddingHorizontal: 18, paddingTop: 18 },
  eyebrow: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8 },
  eyebrowArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
  total: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 40, fontWeight: '700', marginTop: 6 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tile: { backgroundColor: 'rgba(0, 0, 0, 0.32)', borderRadius: 14, flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 10 },
  tileLabel: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5 },
  tileValue: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700', marginTop: 2 },

  textButton: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700' },

  rows: { gap: 8 },
  row: { alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 18, flexDirection: 'row', gap: 14, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 14 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600' },
  rowDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowValue: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  progressTrack: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, height: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: COLORS.gold, borderRadius: 2, height: 4 },
  progressFillArabic: { alignSelf: 'flex-end' },
  // A row's one action, on gold's 13% wash (the design's chip).
  chip: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 99, flexDirection: 'row', gap: 5, height: 32, paddingHorizontal: 12 },
  chipText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  arabicChip: { fontFamily: TYPOGRAPHY.arabic },
  iconButton: { alignItems: 'center', height: 32, justifyContent: 'center', width: 28 },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, paddingHorizontal: 2 },

  destructive: { alignItems: 'center', backgroundColor: 'rgba(214, 69, 69, 0.12)', borderRadius: 18, justifyContent: 'center', marginTop: 6, paddingVertical: 15 },
  destructiveText: { color: '#FF8A7A', fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '700' },

  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
});
