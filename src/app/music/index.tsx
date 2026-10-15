'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import FeaturedRelease from '@/components/music/FeaturedRelease';
import MusicSectionNav from '@/components/music/MusicSectionNav';
import ReleaseTile from '@/components/music/ReleaseTile';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import PersonMedallion from '@/components/vine/ui/PersonMedallion';
import TabHeader from '@/components/vine/ui/TabHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { usePlayRelease } from '@/hooks/usePlayRelease';
import { useReleaseLikes } from '@/hooks/useReleaseLikes';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { musicService } from '@/services/musicService';
import type { MusicConsumerReleaseSummary, MusicHomePayload } from '@/types/musicConsumer';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

/** A release's line under its name: the artist, else what kind of release it is. */
function releaseLine(release: MusicConsumerReleaseSummary): string {
  return release.primaryArtist?.displayName
    ?? (release.releaseType === 'album' ? tr('Album', 'Album', 'ألبوم') : release.releaseType === 'ep' ? 'EP' : tr('Single', 'Single', 'أغنية'));
}

/** The iPad's and desktop's grid: covers about 200pt wide, 22pt apart, never fewer than three across. */
const GRID_GAP = 22;
function gridColumnsFor(width: number): number {
  return Math.max(3, Math.floor((width + GRID_GAP) / (200 + GRID_GAP)));
}

/**
 * The Music tab (Coptic Vine design, "Music"): on a phone the newest release
 * large, the rest of the latest releases on a rail, then the artists as
 * medallions; on the iPad and desktop the latest releases side by side as
 * covers, the newest marked "New", then the artists in a row.
 */
export default function MusicHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const width = useContentWidth();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const wide = layout !== 'phone';
  const [data, setData] = useState<MusicHomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the load below.
  const [attempt, setAttempt] = useState(0);
  const likes = useReleaseLikes(locale);
  const { play: playRelease, loadingId: loadingReleaseId, isPlaying } = usePlayRelease(locale);

  useEffect(() => {
    let active = true;
    musicService.getHome(locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setData(payload);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load music.'); });
    return () => { active = false; };
  }, [locale, attempt]);

  const latest = data?.latestReleases ?? [];
  const featured = latest[0] ?? null;
  const rail = latest.slice(1);

  const openRelease = (release: MusicConsumerReleaseSummary) => router.push(`/music/release/${release.id}`);
  const gutter = wide ? 0 : 16;
  const rails = { paddingHorizontal: gutter };
  const available = width - 72;
  const columns = gridColumnsFor(available);
  const gridTile = Math.floor((available - GRID_GAP * (columns - 1)) / columns);

  const tile = (release: MusicConsumerReleaseSummary, tileWidth: number, extra: { large?: boolean; badge?: string } = {}) => {
    const liked = likes.isLiked(release.id);
    return (
      <ReleaseTile
        key={release.id}
        id={release.id}
        title={release.title}
        subtitle={releaseLine(release)}
        artworkUri={musicService.resolveAsset(release.coverAsset)}
        width={tileWidth}
        arabic={arabic}
        large={extra.large}
        badge={extra.badge}
        onPress={() => openRelease(release)}
        onPlay={() => playRelease(release)}
        playing={isPlaying(release.id)}
        playLabel={`${isPlaying(release.id) ? tr('Pause', 'Pause', 'إيقاف مؤقت') : tr('Play', 'Lire', 'تشغيل')}: ${release.title}`}
        liked={liked}
        onToggleLike={() => likes.toggle(release.id)}
        likeLabel={`${liked ? tr('Unlike release', 'Retirer des favoris', 'إزالة الإعجاب') : tr('Like release', 'Ajouter aux favoris', 'إعجاب')}: ${release.title}`}
      />
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head><title>{tr('Music — Coptic Vine', 'Musique — Coptic Vine', 'الترانيم — كوبتك فاين')}</title></Head>

      <NowPlayingAwareScrollView
        contentContainerStyle={[styles.content, wide && [styles.contentWide, { paddingTop: insets.top + 28 }]]}
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind="green" tall={wide} />
        <PageGutterProvider gutter={gutter}>
          <TabHeader title={tr('Hymns & Songs', 'Hymnes et chants', 'الألحان والترانيم')} arabic={arabic} wide={wide} nav={<MusicSectionNav active="home" flush={wide} />} />

          {!data && !error ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
          {error ? <LoadFailure error={error} layout="inline" onRetry={() => { setError(null); setAttempt((count) => count + 1); }} /> : null}

          {data ? (
            <>
              <SectionHeading size="page" title={tr('Latest Releases', 'Dernières parutions', 'أحدث الإصدارات')} arabic={arabic} />
              {!featured ? (
                <EmptyState text={tr('No published releases yet.', 'Aucune parution publiée pour l’instant.', 'لا توجد إصدارات منشورة بعد.')} gutter={gutter} />
              ) : wide ? (
                // The iPad and desktop: every latest release a cover in the row, the newest marked "New".
                <View style={styles.grid}>
                  {latest.map((release, index) => tile(release, gridTile, { large: true, badge: index === 0 ? tr('New', 'Nouveau', 'جديد') : undefined }))}
                </View>
              ) : (
                <>
                  <View style={rails}>
                    <FeaturedRelease
                      release={featured}
                      arabic={arabic}
                      onOpen={() => openRelease(featured)}
                      onPlay={() => playRelease(featured)}
                      playing={isPlaying(featured.id)}
                      liked={likes.isLiked(featured.id)}
                      onToggleLike={() => likes.toggle(featured.id)}
                      likeBusy={likes.busyId === featured.id || loadingReleaseId === featured.id}
                    />
                  </View>
                  {rail.length ? (
                    <NowPlayingAwareScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rail, rails]}>
                      {rail.map((release) => tile(release, 136))}
                    </NowPlayingAwareScrollView>
                  ) : null}
                </>
              )}

              <SectionHeading size="page" title={tr('Artists', 'Artistes', 'الفنانون')} arabic={arabic} />
              {data.artists.length ? (
                wide ? (
                  <View style={styles.peopleWide}>
                    {data.artists.map((artist) => (
                      <PersonMedallion
                        key={artist.id}
                        name={artist.displayName}
                        imageUri={musicService.resolveAsset(artist.profileImageAsset)}
                        size={140}
                        arabic={arabic}
                        onPress={() => router.push(`/music/artist/${artist.id}`)}
                      />
                    ))}
                  </View>
                ) : (
                  <NowPlayingAwareScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.people, rails]}>
                    {data.artists.map((artist) => (
                      <PersonMedallion
                        key={artist.id}
                        name={artist.displayName}
                        imageUri={musicService.resolveAsset(artist.profileImageAsset)}
                        size={92}
                        arabic={arabic}
                        onPress={() => router.push(`/music/artist/${artist.id}`)}
                      />
                    ))}
                  </NowPlayingAwareScrollView>
                )
              ) : <EmptyState text={tr('No published artists yet.', 'Aucun artiste publié pour l’instant.', 'لا يوجد فنانون منشورون بعد.')} gutter={gutter} />}
            </>
          ) : null}
        </PageGutterProvider>
      </NowPlayingAwareScrollView>

      <BottomTabBar active="music" />
    </SafeAreaView>
  );
}

function EmptyState({ text, gutter }: { text: string; gutter: number }) {
  return (
    <View style={[styles.empty, { marginHorizontal: gutter }]}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  contentWide: { paddingHorizontal: 36 },
  loader: { marginVertical: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  rail: { gap: 12, paddingTop: 14 },
  people: { gap: 16 },
  // The iPad's and desktop's artists: 140pt medallions, 28pt apart, wrapping when there are many.
  peopleWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  empty: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  emptyText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
});
