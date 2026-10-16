'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { type ErrorBoundaryProps, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '@/components/vine/ui/AppHeader';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import TabHeader from '@/components/vine/ui/TabHeader';
import MusicSectionNav from '@/components/music/MusicSectionNav';
import ReleaseTile from '@/components/music/ReleaseTile';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useMusicPlayer } from '@/context/MusicPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { downloadManager } from '@/services/downloadManager';
import { musicService } from '@/services/musicService';
import type { MusicLibraryPayload } from '@/types/musicConsumer';
import { formatMusicTrackPerformers } from '@/utils/musicCredits';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';
import { useSidePadding } from '@/utils/useSidePadding';

import { tr } from '../../utils/appText';
type LibraryFolder = 'likes' | 'playlists' | 'releases' | 'following' | 'downloads';

/** The iPad's and desktop's page margins (Coptic Vine design, "Layout and spacing"). */
const WIDE_MARGIN = 36;
/** Recently Played on the iPad and desktop: one row of five covers, 22 apart. */
const GRID_COLUMNS = 5;
const GRID_GAP = 22;

/** A tile's count line: "3 tracks", or "None yet" for an empty folder. */
function countLine(count: number, one: [string, string, string], many: [string, string, string]): string {
  if (count === 0) return tr('None yet', 'Aucun pour l’instant', 'لا شيء بعد');
  const [english, french, arabic] = count === 1 ? one : many;
  return tr(`${count} ${english}`, `${count} ${french}`, `${count} ${arabic}`);
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();

  return (
    <BleedPage header={<AppHeader title={{ english: 'Your Library', arabic: 'مكتبتك', french: 'Votre bibliothèque' }} visibleLanguages={{ english: true, arabic: false }} />}>
      <View style={styles.crashCard}>
        <Text style={styles.crashTitle}>Library could not be displayed</Text>
        <Text selectable style={styles.crashBody}>{error.message}</Text>
        <View style={styles.crashActions}>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void retry()}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => router.replace('/music')}>
            <Text style={styles.secondaryButtonText}>Back to Music</Text>
          </Pressable>
        </View>
      </View>
    </BleedPage>
  );
}

/**
 * Music's Library (Coptic Vine design, "Library"): Liked Tracks large up top
 * with a play button, your collections as tiles beside or beneath it, then
 * what you've played lately. On the iPad and desktop the title and the
 * section pill share a row and Liked Tracks stands beside the tiles.
 */
export default function MusicLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const contentWidth = useContentWidth();
  const wide = layout !== 'phone';
  // The page and its glow run to both edges; its content keeps clear of the notch.
  const sidePadding = useSidePadding(wide ? WIDE_MARGIN : 0);
  const { user } = useAuth();
  const { preferences } = useReadingPreferences();
  const { playQueue } = useMusicPlayer();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const isArabic = locale === 'ar';
  const [library, setLibrary] = useState<MusicLibraryPayload | null>(null);
  const [downloadCount, setDownloadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async (_activeUserId?: string) => {
    setLoading(true);
    setError(null);
    try {
      setLibrary(await musicService.getLibrary(locale));
      if (Platform.OS !== 'web') {
        const downloads = await downloadManager.listDownloads();
        setDownloadCount(downloads.filter((item) => item.domain === 'music').length);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your music library.');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route entry starts an async data load
    void loadLibrary(user?.id);
  }, [loadLibrary, user?.id]);

  const recentQueue = useMemo(() => (library?.recentTracks ?? []).map(({ track, release }) => ({
    track,
    releaseId: release?.id ?? track.releaseId,
    releaseTitle: release?.title ?? null,
    releaseType: release?.releaseType ?? null,
    musicType: release?.musicType ?? null,
    recordingType: release?.recordingType ?? null,
    coverAsset: release?.coverAsset ?? null,
  })), [library?.recentTracks]);

  const likedQueue = useMemo(() => (library?.likedTracks ?? []).map((track) => ({
    track,
    releaseId: track.releaseId,
    coverAsset: track.releaseCoverAsset ?? null,
  })), [library?.likedTracks]);

  const openFolder = (section: LibraryFolder | 'recent-tracks' | 'recent-releases') => {
    router.push({ pathname: '/music/library/[section]', params: { section } });
  };

  const folders = ([
    {
      id: 'likes',
      title: tr('Liked Tracks', 'Titres aimés', 'الترانيم المعجبة'),
      detail: countLine(library?.likedTracks.length ?? 0, ['track', 'titre', 'ترنيمة'], ['tracks', 'titres', 'ترنيمة']),
      icon: 'heart',
    },
    {
      id: 'playlists',
      title: tr('Playlists', 'Playlists', 'قوائم التشغيل'),
      detail: countLine(library?.playlists.length ?? 0, ['playlist', 'playlist', 'قائمة'], ['playlists', 'playlists', 'قائمة']),
      icon: 'list-outline',
    },
    {
      id: 'releases',
      title: tr('Liked Releases', 'Parutions aimées', 'الإصدارات المعجبة'),
      detail: countLine(library?.likedReleases.length ?? 0, ['release', 'parution', 'إصدار'], ['releases', 'parutions', 'إصدار']),
      icon: 'disc-outline',
    },
    {
      id: 'following',
      title: tr('Following', 'Abonnements', 'المتابَعون'),
      detail: countLine(library?.followedArtists.length ?? 0, ['artist', 'artiste', 'فنان'], ['artists', 'artistes', 'فنان']),
      icon: 'people-outline',
    },
    {
      id: 'downloads',
      title: tr('Downloads', 'Téléchargements', 'التنزيلات'),
      detail: countLine(downloadCount, ['download', 'téléchargement', 'تنزيل'], ['downloads', 'téléchargements', 'تنزيل']),
      icon: 'arrow-down-circle-outline',
    },
  ] satisfies { id: LibraryFolder; title: string; detail: string; icon: IconName }[])
    .filter((folder) => Platform.OS !== 'web' || folder.id !== 'downloads');

  // Liked Tracks heads the page on its own card; the other folders are tiles,
  // two to a row (the website has no Downloads, so its third tile runs across).
  const [likes, ...collections] = folders;
  const tileRows: (typeof collections)[] = [];
  for (let index = 0; index < collections.length; index += 2) tileRows.push(collections.slice(index, index + 2));

  const likedCount = library?.likedTracks.length ?? 0;
  const gutter = wide ? 0 : 16;
  const gridTile = (contentWidth - WIDE_MARGIN * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const recentTracks = library?.recentTracks.slice(0, wide ? GRID_COLUMNS : 10) ?? [];
  const recentReleases = library?.recentReleases.slice(0, wide ? GRID_COLUMNS : 10) ?? [];
  const seeAll = (section: 'recent-tracks' | 'recent-releases') => (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={() => openFolder(section)} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.seeAll, isArabic && styles.arabic]}>{tr('See all', 'Tout voir', 'الكل')}</Text>
    </Pressable>
  );

  // The card opens Liked Tracks; its play button sits over the card as a
  // sibling, so neither is a button inside the other.
  const hero = (
    <View style={[styles.hero, wide && styles.heroWide]}>
      <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} locations={[0, 0.8]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${likes.title}, ${likes.detail}`}
        onPress={() => openFolder('likes')}
        style={({ pressed }) => [
          styles.heroOpen,
          wide ? styles.heroOpenWide : styles.heroOpenStart,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.heroIcon, wide && styles.heroIconWide]}>
          <Icon name="heart" size={wide ? 28 : 25} color={COLORS.gold} />
        </View>
        <View style={[styles.heroText, wide ? styles.heroTextWide : styles.heroTextPhone]}>
          <Text style={[styles.heroTitle, wide && styles.heroTitleWide, isArabic && styles.arabic]} numberOfLines={1}>{likes.title}</Text>
          <Text style={[styles.heroDetail, wide && styles.heroDetailWide, isArabic && styles.arabic]} numberOfLines={1}>{likes.detail}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('Play Liked Tracks', 'Lire les titres aimés', 'تشغيل الترانيم المعجبة')}
        aria-disabled={!likedCount}
        disabled={!likedCount}
        hitSlop={6}
        onPress={() => playQueue(likedQueue, 0)}
        style={({ pressed }) => [
          styles.heroPlay,
          wide ? styles.heroPlayWide : styles.heroPlayPhone,
          !likedCount && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Icon name="play" size={wide ? 23 : 19} color={COLORS.greenDeep} />
      </Pressable>
    </View>
  );

  const tiles = (
    <View style={[styles.tiles, wide && styles.tilesWide]}>
      {tileRows.map((row) => (
        <View key={row.map((folder) => folder.id).join(':')} style={[styles.tileRow, wide && styles.tileRowWide]}>
          {row.map((folder) => (
            <Pressable
              key={folder.id}
              accessibilityRole="button"
              accessibilityLabel={`${folder.title}, ${folder.detail}`}
              onPress={() => openFolder(folder.id)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              {/* In a View of its own so it draws over the gradient on the web, as the text does. */}
              <View><Icon name={folder.icon} size={22} color={COLORS.gold} /></View>
              <View style={styles.tileText}>
                <Text style={[styles.tileTitle, isArabic && styles.arabic]} numberOfLines={1}>{folder.title}</Text>
                <Text style={[styles.tileDetail, isArabic && styles.arabic]} numberOfLines={1}>{folder.detail}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );

  /** A shelf of covers: a rail on a phone, one row of five on the iPad and desktop. */
  const shelf = (children: ReactNode) => (wide ? (
    <View style={styles.grid}>{children}</View>
  ) : <Rail>{children}</Rail>);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head><title>{tr('Your Library — Coptic Vine', 'Votre bibliothèque — Coptic Vine', 'مكتبتي — كوبتك فاين')}</title></Head>

      <NowPlayingAwareScrollView
        // Keyed by layout: a turn of the phone mounts the page afresh rather than
        // restyling its views in place, which iOS laid out wrongly (a column of zero width).
        key={layout}
        contentContainerStyle={[styles.content, wide && [styles.contentWide, { paddingTop: insets.top + 28 }], sidePadding]}
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind="green" tall={wide} />
        <PageGutterProvider gutter={gutter}>
          <TabHeader title={tr('Your Library', 'Votre bibliothèque', 'مكتبتك')} arabic={isArabic} wide={wide} nav={<MusicSectionNav active="library" flush={wide} />} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!loading && library && !library.authenticated ? (
            <View style={[styles.authCard, !wide && styles.gutter]}>
              <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <Text style={[styles.authTitle, isArabic && styles.arabic]}>{tr('Sign in to your Coptic Vine account', 'Connectez-vous à votre compte Coptic Vine', 'سجّل الدخول إلى حساب كوبتك فاين')}</Text>
              <Text style={[styles.authBody, isArabic && styles.arabic]}>
                {tr('Likes, playlists, follows, and listening history are tied to your account.', 'Vos favoris, playlists, abonnements et historique d’écoute sont liés à votre compte.', 'الإعجابات وقوائم التشغيل وسجل الاستماع مرتبطة بحسابك.')}
              </Text>
              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => router.push('/account')}>
                <Text style={[styles.primaryButtonText, isArabic && styles.arabic]}>{tr('Open Account', 'Ouvrir le compte', 'فتح الحساب')}</Text>
              </Pressable>
            </View>
          ) : null}

          {loading && !library ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : (
            <View style={[styles.top, wide ? styles.topWide : styles.gutter]}>
              {hero}
              {tiles}
            </View>
          )}

          {library?.authenticated ? (
            <>
              <SectionHeading title={tr('Recently Played', 'Écoutés récemment', 'المشغّلة مؤخراً')} arabic={isArabic} size="page" trailing={seeAll('recent-tracks')} />
              {recentTracks.length ? shelf(recentTracks.map((recent, index) => (
                <ReleaseTile
                  key={recent.track.id}
                  id={recent.release?.id ?? recent.track.id}
                  title={recent.track.title}
                  subtitle={formatMusicTrackPerformers(recent.track, recent.release?.primaryArtist?.displayName ?? '') || null}
                  artworkUri={musicService.resolveAsset(recent.release?.coverAsset)}
                  width={wide ? gridTile : 136}
                  arabic={isArabic}
                  large={wide}
                  onPress={() => playQueue(recentQueue, index)}
                  onPlay={() => playQueue(recentQueue, index)}
                  playLabel={`${tr('Play', 'Lire', 'تشغيل')}: ${recent.track.title}`}
                />
              ))) : <EmptyLine text={tr('Tracks will appear here after you listen.', 'Les titres apparaîtront ici après votre écoute.', 'ستظهر الترانيم هنا بعد الاستماع.')} arabic={isArabic} gutter={gutter} />}

              <SectionHeading title={tr('Recently Played Releases', 'Parutions écoutées récemment', 'الإصدارات المشغّلة مؤخراً')} arabic={isArabic} size="page" trailing={seeAll('recent-releases')} />
              {recentReleases.length ? shelf(recentReleases.map((release) => (
                <ReleaseTile
                  key={release.id}
                  id={release.id}
                  title={release.title}
                  subtitle={release.primaryArtist?.displayName ?? release.releaseType}
                  artworkUri={musicService.resolveAsset(release.coverAsset)}
                  width={wide ? gridTile : 136}
                  arabic={isArabic}
                  large={wide}
                  onPress={() => router.push(`/music/release/${release.id}`)}
                />
              ))) : <EmptyLine text={tr('Releases will appear here after you listen.', 'Les parutions apparaîtront ici après votre écoute.', 'ستظهر الإصدارات هنا بعد الاستماع.')} arabic={isArabic} gutter={gutter} />}
            </>
          ) : null}
        </PageGutterProvider>
      </NowPlayingAwareScrollView>

      <BottomTabBar active="music" />
    </SafeAreaView>
  );
}

/** A phone's rail of covers. */
function Rail({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {children}
    </ScrollView>
  );
}

function EmptyLine({ text, arabic, gutter }: { text: string; arabic: boolean; gutter: number }) {
  return <Text style={[styles.emptyText, { marginHorizontal: gutter }, arabic && styles.arabic]}>{text}</Text>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  contentWide: { paddingHorizontal: WIDE_MARGIN },
  gutter: { marginHorizontal: 16 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  loader: { marginVertical: SPACING.xl },
  error: { color: COLORS.priest, fontFamily: TYPOGRAPHY.body, marginTop: SPACING.md, textAlign: 'center' },

  // Liked Tracks over the tiles on a phone; beside them, a column each, on the iPad and desktop.
  top: { gap: 10, marginTop: 18 },
  topWide: { alignItems: 'stretch', flexDirection: 'row', gap: 14, marginTop: 26 },
  hero: { borderRadius: 22, boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.35)', overflow: 'hidden' },
  heroWide: { flex: 1, minHeight: 202 },
  heroOpen: { alignItems: 'center', flexDirection: 'row', gap: 14, padding: 16 },
  // On a phone the play button sits at the row's end: the text stops short of it.
  heroOpenStart: { paddingRight: 76 },
  heroOpenWide: { alignItems: 'flex-start', flex: 1, flexDirection: 'column', gap: 0, padding: 22 },
  heroIcon: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.28)', borderRadius: 16, height: 52, justifyContent: 'center', width: 52 },
  heroIconWide: { height: 60, width: 60 },
  heroText: { minWidth: 0 },
  heroTextPhone: { flex: 1 },
  // On the iPad and desktop the name sits 14 under the icon, clear of the play button in the corner below.
  heroTextWide: { alignSelf: 'stretch', paddingRight: 72, paddingTop: 14 },
  heroTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700' },
  heroTitleWide: { fontSize: 30 },
  heroDetail: { color: 'rgba(255, 255, 255, 0.78)', fontFamily: TYPOGRAPHY.body, fontSize: 13.5, marginTop: 2 },
  heroDetailWide: { fontSize: 15 },
  heroPlay: {
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    boxShadow: '0px 8px 18px rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    position: 'absolute',
  },
  heroPlayPhone: { borderRadius: 23, height: 46, marginTop: -23, right: 16, top: '50%', width: 46 },
  heroPlayWide: { borderRadius: 28, bottom: 22, height: 56, right: 22, width: 56 },

  tiles: { gap: 10 },
  tilesWide: { flex: 1 },
  tileRow: { flexDirection: 'row', gap: 10 },
  tileRowWide: { flex: 1 },
  tile: { borderRadius: 18, flex: 1, minHeight: 96, minWidth: 0, overflow: 'hidden', padding: 14 },
  tileText: { alignSelf: 'stretch', marginTop: 'auto', paddingTop: 12 },
  tileTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '700' },
  tileDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 2 },

  seeAll: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  // A phone's rail sits 14 below its heading, as on Music; the iPad's and desktop's grid 12, with the heading's own 10.
  rail: { gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  grid: { flexDirection: 'row', gap: GRID_GAP, paddingTop: 2 },
  emptyText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19 },

  authCard: { borderRadius: 18, gap: SPACING.sm, marginTop: 18, overflow: 'hidden', padding: SPACING.md },
  authTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700' },
  authBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, lineHeight: 19 },

  crashCard: { backgroundColor: COLORS.greenDeep, borderColor: COLORS.goldLine, borderRadius: RADII.lg, borderWidth: 1, gap: SPACING.md, margin: SPACING.md, padding: SPACING.lg },
  crashTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  crashBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19 },
  crashActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  primaryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: COLORS.gold, borderRadius: RADII.pill, justifyContent: 'center', marginTop: 4, minHeight: 40, paddingHorizontal: SPACING.lg },
  primaryButtonText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: COLORS.border, borderRadius: RADII.pill, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: SPACING.lg },
  secondaryButtonText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '800' },
});
