'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import FeaturedRelease from '@/components/music/FeaturedRelease';
import MusicSectionNav from '@/components/music/MusicSectionNav';
import ReleaseTile from '@/components/music/ReleaseTile';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import PageTitle from '@/components/vine/ui/PageTitle';
import PersonMedallion from '@/components/vine/ui/PersonMedallion';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePlayRelease } from '@/hooks/usePlayRelease';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { musicService } from '@/services/musicService';
import type { MusicConsumerReleaseSummary, MusicHomePayload } from '@/types/musicConsumer';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

/** A release's line under its name: the artist, else what kind of release it is. */
function releaseLine(release: MusicConsumerReleaseSummary): string {
  return release.primaryArtist?.displayName
    ?? (release.releaseType === 'album' ? tr('Album', 'Album', 'ألبوم') : release.releaseType === 'ep' ? 'EP' : tr('Single', 'Single', 'أغنية'));
}

/**
 * The Music tab (Coptic Vine design, "Music"): the newest release large,
 * the rest of the latest releases on a rail, then the artists as medallions.
 */
export default function MusicHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const { user } = useAuth();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const wide = layout !== 'phone';
  const [data, setData] = useState<MusicHomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the load below.
  const [attempt, setAttempt] = useState(0);
  const [featuredLiked, setFeaturedLiked] = useState<{ id: string; liked: boolean } | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const { play: playRelease, loadingId: loadingReleaseId, isPlaying } = usePlayRelease(locale);

  useEffect(() => {
    let active = true;
    setError(null);
    musicService.getHome(locale)
      .then((payload) => { if (active) setData(payload); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load music.'); });
    return () => { active = false; };
  }, [locale, attempt]);

  const featured = data?.latestReleases[0] ?? null;
  const rail = data?.latestReleases.slice(1) ?? [];

  useEffect(() => {
    if (!featured) return;
    let active = true;
    const { id } = featured;
    musicService.getReleaseLiked(id)
      .then((liked) => { if (active) setFeaturedLiked({ id, liked }); })
      .catch(() => { if (active) setFeaturedLiked({ id, liked: false }); });
    return () => { active = false; };
  }, [featured, user?.id]);

  const toggleFeaturedLike = () => {
    if (!featured || likeBusy) return;
    if (!user) {
      Alert.alert(
        tr('Like release', 'Ajouter aux favoris', 'إعجاب'),
        tr('Sign in to your Coptic Vine account to like releases.', 'Connectez-vous à votre compte Coptic Vine pour ajouter des parutions à vos favoris.', 'سجّل الدخول إلى حساب كوبتك فاين لحفظ الإصدارات.'),
      );
      return;
    }
    const next = !(featuredLiked?.id === featured.id && featuredLiked.liked);
    setLikeBusy(true);
    musicService.setReleaseLiked(featured.id, next)
      .then(() => setFeaturedLiked({ id: featured.id, liked: next }))
      .catch((cause) => Alert.alert(tr('Like release', 'Ajouter aux favoris', 'إعجاب'), cause instanceof Error ? cause.message : 'Unable to update this release.'))
      .finally(() => setLikeBusy(false));
  };

  const openRelease = (release: MusicConsumerReleaseSummary) => router.push(`/music/release/${release.id}`);
  const gutter = wide ? 0 : 16;
  const rails = { paddingHorizontal: gutter };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head><title>{tr('Music — Coptic Vine', 'Musique — Coptic Vine', 'الترانيم — كوبتك فاين')}</title></Head>

      <NowPlayingAwareScrollView
        contentContainerStyle={[styles.content, wide && [styles.contentWide, { paddingTop: insets.top + 28 }]]}
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind="green" tall={wide} />
        <PageGutterProvider gutter={gutter}>
          <PageTitle title={tr('Hymns & Songs', 'Hymnes et chants', 'الألحان والترانيم')} arabic={arabic} flush={wide} />
          <MusicSectionNav active="home" flush={wide} />

          {!data && !error ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
          {error ? <LoadFailure error={error} layout="inline" onRetry={() => setAttempt((count) => count + 1)} /> : null}

          {data ? (
            <>
              <SectionHeading title={tr('Latest Releases', 'Dernières parutions', 'أحدث الإصدارات')} arabic={arabic} />
              {featured ? (
                <View style={[rails, wide && styles.featuredWide]}>
                  <FeaturedRelease
                    release={featured}
                    arabic={arabic}
                    onOpen={() => openRelease(featured)}
                    onPlay={() => playRelease(featured)}
                    playing={isPlaying(featured.id)}
                    liked={featuredLiked?.id === featured.id && featuredLiked.liked}
                    onToggleLike={toggleFeaturedLike}
                    likeBusy={likeBusy || loadingReleaseId === featured.id}
                  />
                </View>
              ) : (
                <EmptyState text={tr('No published releases yet.', 'Aucune parution publiée pour l’instant.', 'لا توجد إصدارات منشورة بعد.')} gutter={gutter} />
              )}
              {rail.length ? (
                <NowPlayingAwareScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rail, rails]}>
                  {rail.map((release) => (
                    <ReleaseTile
                      key={release.id}
                      id={release.id}
                      title={release.title}
                      subtitle={releaseLine(release)}
                      artworkUri={musicService.resolveAsset(release.coverAsset)}
                      width={136}
                      arabic={arabic}
                      onPress={() => openRelease(release)}
                      onPlay={() => playRelease(release)}
                      playLabel={`${tr('Play', 'Lire', 'تشغيل')}: ${release.title}`}
                    />
                  ))}
                </NowPlayingAwareScrollView>
              ) : null}

              <SectionHeading title={tr('Artists', 'Artistes', 'الفنانون')} arabic={arabic} />
              {data.artists.length ? (
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
  featuredWide: { maxWidth: 640 },
  rail: { gap: 12, paddingTop: 14 },
  people: { gap: 16 },
  empty: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  emptyText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
});
