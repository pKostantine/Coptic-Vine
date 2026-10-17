'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import LearningMiniPlayer from '@/components/learning/LearningMiniPlayer';
import ReleaseTile from '@/components/music/ReleaseTile';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import { BuddedCross } from '@/components/vine/ui/Ornaments';
import PersonHero from '@/components/vine/ui/PersonHero';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { learningAlbumQueue, useLearningPlayer } from '@/context/LearningPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { learningService } from '@/services/learningService';
import type { LearningAlbumDetail, LearningCantorDetail } from '@/types/learningPlatform';
import { goBack } from '@/utils/navigation';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';
import { useSidePadding } from '@/utils/useSidePadding';

import { tr } from '../../../utils/appText';

/** The iPad's and desktop's columns, and the covers three across in each. */
const COLUMN_GAP = 32;
const GRID_GAP = 22;

/**
 * A cantor (Coptic Vine design, "Cantor"): their photo glowing out of the
 * page and their name, then their learning albums (each with a play button)
 * and lesson sets as covers, over the tab bar. The iPad and desktop set the
 * photo beside the name and the albums beside the lesson sets.
 */
export default function LearningCantorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const layout = useLayoutMode();
  const width = useContentWidth();
  const wide = layout !== 'phone';
  // The page and the hero's glow run to both edges; the content keeps clear of the notch.
  const sidePadding = useSidePadding(0);
  const insets = useSafeAreaInsets();
  const cantorId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [cantor, setCantor] = useState<LearningCantorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { currentItem, playing, playQueue, togglePlayback } = useLearningPlayer();
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
  // Each album as it loads on its own, for its cover, and for its recordings when it is played.
  const [albumDetails, setAlbumDetails] = useState<Record<string, LearningAlbumDetail>>({});

  useEffect(() => {
    if (!cantorId) return;
    let active = true;
    learningService.getCantor(cantorId, locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setCantor(payload);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load cantor.'); });
    return () => { active = false; };
  }, [cantorId, locale, attempt]);

  // An album's covers play it from its first recording, fetched on the tap; the album playing pauses.
  const albumIsCurrent = (albumId: string) => currentItem?.kind === 'recording' && currentItem.containerId === albumId;
  const playAlbum = (albumId: string) => {
    if (albumIsCurrent(albumId)) {
      togglePlayback();
      return;
    }
    if (loadingAlbumId) return;
    setLoadingAlbumId(albumId);
    const loaded = albumDetails[albumId];
    (loaded ? Promise.resolve(loaded) : learningService.getAlbum(albumId, locale))
      .then((album) => {
        // Kept, so playing it again doesn't load it again.
        setAlbumDetails((current) => ({ ...current, [albumId]: album }));
        const queue = learningAlbumQueue(album);
        if (queue.length) playQueue(queue, 0);
      })
      .catch((cause) => Alert.alert(tr('Play album', 'Lire l’album', 'تشغيل الألبوم'), cause instanceof Error ? cause.message : 'Unable to play this album.'))
      .finally(() => setLoadingAlbumId((current) => (current === albumId ? null : current)));
  };

  // The iPad's and desktop's 36pt margins are the sections' gutter, the hero's glow running past them to the edges.
  const gutter = wide ? 36 : 16;
  // The page's content is inset from a phone's notch on its side; the tiles share what is left.
  const available = width - (wide ? 72 : 32) - insets.left - insets.right;
  // A phone sets two 140pt covers side by side; the iPad and desktop three in each of two columns.
  const gap = wide ? GRID_GAP : 12;
  const tileWidth = wide ? Math.floor(((available - COLUMN_GAP) / 2 - GRID_GAP * 2) / 3) : 140;
  const chevron = <Icon name="chevron-forward" size={wide ? 20 : 18} color={COLORS.gold} />;

  // In the iPad's and desktop's columns the sections sit flush; the row of columns takes the margins.
  const sectionGutter = wide ? 0 : gutter;
  const empty = (text: string) => (
    <View style={[styles.empty, { marginHorizontal: sectionGutter }]}>
      <View style={styles.emptyCross}><BuddedCross size={22} /></View>
      <Text style={[styles.emptyText, arabic && styles.arabic]}>{text}</Text>
    </View>
  );

  const albums = cantor ? (
    <>
      <View style={!wide && styles.phoneSection}>
        <SectionHeading size="page" title={tr('Learning Albums', 'Albums d’apprentissage', 'ألبومات التعلّم')} arabic={arabic} />
      </View>
      <Text style={[styles.sub, { paddingHorizontal: sectionGutter }, arabic && styles.arabic]}>
        {tr('Ordered recordings for listening and review', 'Enregistrements ordonnés pour l’écoute et la révision', 'تسجيلات مرتبة للاستماع والمراجعة')}
      </Text>
      {cantor.albums.length ? (
        <View style={[styles.grid, { gap, paddingHorizontal: sectionGutter }]}>
          {cantor.albums.map((album) => {
            const albumPlaying = albumIsCurrent(album.id) && playing;
            return (
              <ReleaseTile
                key={album.id}
                id={album.id}
                title={album.title}
                subtitle={tr('Learning album', 'Album d’apprentissage', 'ألبوم تعلّم')}
                artworkUri={learningService.resolveAsset(album.coverAsset ?? null)}
                width={tileWidth}
                arabic={arabic}
                wrapTitle
                large={wide}
                onPress={() => router.push({ pathname: '/learn/album/[id]', params: { id: album.id } })}
                onPlay={() => playAlbum(album.id)}
                playing={albumPlaying}
                playLabel={`${albumPlaying ? tr('Pause', 'Pause', 'إيقاف مؤقت') : tr('Play', 'Lire', 'تشغيل')}: ${album.title}`}
                trailing={chevron}
              />
            );
          })}
        </View>
      ) : empty(tr('No published learning albums yet.', 'Aucun album d’apprentissage publié pour l’instant.', 'لا توجد ألبومات منشورة بعد.'))}
    </>
  ) : null;

  const lessonSets = cantor ? (
    <>
      <View style={!wide && styles.phoneSection}>
        <SectionHeading size="page" title={tr('Lesson Sets', 'Séries de leçons', 'مجموعات الدروس')} arabic={arabic} />
      </View>
      <Text style={[styles.sub, { paddingHorizontal: sectionGutter }, arabic && styles.arabic]}>
        {tr('Step-by-step study for individual hymns', 'Étude pas à pas de chaque hymne', 'دروس خطوة بخطوة لكل لحن')}
      </Text>
      {cantor.lessonSets.length ? (
        <View style={[styles.grid, { gap, paddingHorizontal: sectionGutter }]}>
          {cantor.lessonSets.map((lessonSet) => (
            <ReleaseTile
              key={lessonSet.id}
              id={lessonSet.id}
              title={lessonSet.title}
              subtitle={tr('Hymn course', 'Cours d’hymne', 'منهج لحن')}
              artworkUri={learningService.resolveAsset(lessonSet.coverAsset ?? null)}
              width={tileWidth}
              arabic={arabic}
              wrapTitle
              large={wide}
              onPress={() => router.push({ pathname: '/learn/lesson-set/[id]', params: { id: lessonSet.id } })}
              trailing={chevron}
            />
          ))}
        </View>
      ) : empty(tr('No published lesson sets yet.', 'Aucune série de leçons publiée pour l’instant.', 'لا توجد مجموعات دروس منشورة بعد.'))}
    </>
  ) : null;

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head><title>{cantor ? `${cantor.displayName} — ${tr('Learn & Study', 'Apprendre', 'تعلّم وادرس')}` : tr('Cantor — Learn & Study', 'Chantre — Apprendre', 'معلّم — تعلّم وادرس')}</title></Head>
      {!cantor ? (
        <View style={[styles.pending, { paddingTop: 12 + insets.top, paddingLeft: 16 + sidePadding.paddingLeft, paddingRight: 16 + sidePadding.paddingRight }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Go back', 'Retour', 'رجوع')} onPress={() => goBack(router, '/learn')} style={({ pressed }) => [styles.pendingBack, pressed && styles.pressed]}>
            <Icon name="chevron-back" size={20} color={COLORS.gold} />
          </Pressable>
          {error ? (
            <LoadFailure error={error} layout="inline" onRetry={() => { setError(null); setAttempt((count) => count + 1); }} />
          ) : (
            <ActivityIndicator color={COLORS.gold} style={styles.loader} />
          )}
        </View>
      ) : (
        // Keyed by layout: a turn of the phone mounts the page afresh rather than restyling it in place.
        <NowPlayingAwareScrollView key={layout} contentContainerStyle={[styles.content, sidePadding]} showsVerticalScrollIndicator={false}>
          <PageGutterProvider gutter={gutter}>
            <PersonHero
              name={cantor.displayName}
              kicker={tr('Cantor', 'Chantre', 'معلّم')}
              imageUri={learningService.resolveAsset(cantor.profileImageAsset)}
              bio={cantor.biography}
              compact
              arabic={arabic}
              wide={wide}
              onBack={() => goBack(router, '/learn')}
              backLabel={tr('Go back', 'Retour', 'رجوع')}
            />

            {wide ? (
              <PageGutterProvider gutter={0}>
                <View style={[styles.columns, { paddingHorizontal: gutter }]}>
                  <View style={styles.column}>{albums}</View>
                  <View style={styles.column}>{lessonSets}</View>
                </View>
              </PageGutterProvider>
            ) : (
              <>
                {albums}
                {lessonSets}
              </>
            )}
          </PageGutterProvider>
        </NowPlayingAwareScrollView>
      )}
      <LearningMiniPlayer />
      <BottomTabBar active="learn" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 32 },
  pending: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  pendingBack: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  loader: { marginTop: 48 },
  pressed: { opacity: 0.7 },
  // A phone sets the sections 22pt under what comes before them, not the page's 28.
  phoneSection: { marginTop: -6 },
  sub: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, lineHeight: 19, marginBottom: 12, marginTop: -4 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: COLUMN_GAP },
  column: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  emptyCross: { opacity: 0.5 },
  emptyText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
