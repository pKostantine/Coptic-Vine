'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import LearningArtwork from '@/components/learning/LearningArtwork';
import LearningBackHeader from '@/components/learning/LearningBackHeader';
import LearningDownloadButton from '@/components/learning/LearningDownloadButton';
import LearningItemActionsMenu from '@/components/learning/LearningItemActionsMenu';
import LearningMediaRow from '@/components/learning/LearningMediaRow';
import LessonModeSwitch from '@/components/learning/LessonModeSwitch';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { learningLessonSetQueue, useLearningPlayer } from '@/context/LearningPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useLearningItemLikes } from '@/hooks/useLearningItemLikes';
import { usePlayLessons } from '@/hooks/usePlayLessons';
import { learningService } from '@/services/learningService';
import {
  learningLessonDownloadRequest,
  learningLessonSetDownloadRequest,
} from '@/services/offlineDownloadRequests';
import type { LearningLesson, LearningLessonSetDetail } from '@/types/learningPlatform';
import { loadLearningResume, peekLearningResume, subscribeLearningResume, type LearningResumeMap } from '@/utils/learningResume';

import { tr } from '../../../utils/appText';

function rowProgress(resume: LearningResumeMap, lesson: LearningLesson): number {
  const entry = resume[lesson.id];
  const duration = entry?.durationMs ?? lesson.durationMs;
  if (!entry || !duration || duration <= 0) return 0;
  return Math.max(0, Math.min(1, entry.positionMs / duration));
}

/**
 * A lesson set: its cover and its words, then its lessons in order. Play
 * plays them all, video and audio lessons alike, on the one queue; a lesson
 * with a picture, watched as video, opens the full player on its picture,
 * and as audio only plays where the listener is. A set with video lessons
 * offers that choice beside Play, before anything is fetched.
 */
export default function LearningLessonSetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const isArabic = locale === 'ar';
  const lessonSetId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [lessonSet, setLessonSet] = useState<LearningLessonSetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<LearningResumeMap>(() => peekLearningResume());
  const player = useLearningPlayer();
  const likes = useLearningItemLikes(locale);
  const playLessons = usePlayLessons();
  const { currentItem, playing, lessonVideoMode } = player;
  const queue = useMemo(() => (lessonSet ? learningLessonSetQueue(lessonSet) : []), [lessonSet]);
  const downloadRequest = useMemo(
    () => (lessonSet ? learningLessonSetDownloadRequest(lessonSet, locale) : null),
    [lessonSet, locale],
  );

  useEffect(() => {
    if (!lessonSetId) return;
    let active = true;
    learningService.getLessonSet(lessonSetId, locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setLessonSet(payload);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load lesson set.'); });
    return () => { active = false; };
  }, [lessonSetId, locale]);

  useEffect(() => {
    let active = true;
    void loadLearningResume().then((map) => { if (active) setResume(map); });
    const unsubscribe = subscribeLearningResume(() => setResume(peekLearningResume()));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const openLessonPage = (lessonId: string) => {
    if (!lessonSet) return;
    router.push({ pathname: '/learn/lesson/[id]', params: { id: lessonId, setId: lessonSet.id } });
  };

  // Plays the lesson in the set's order (usePlayLessons): watched as video,
  // the full player opens on its picture.
  const playLesson = (index: number) => {
    if (!lessonSet || index < 0 || index >= queue.length) return;
    const item = queue[index];
    if (currentItem?.id === item.id) {
      player.togglePlayback();
      return;
    }
    playLessons(queue, index);
  };

  const count = lessonSet?.lessons.length ?? 0;
  const videoCount = lessonSet?.lessons.filter((lesson) => lesson.mediaType === 'video').length ?? 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <Head><title>{lessonSet ? lessonSet.title + ' — Learn & Study' : 'Lesson Set'}</title></Head>
      <LearningBackHeader title={tr('Lesson Set', 'Série de leçons', 'مجموعة دروس')} isArabic={isArabic} />
      {!lessonSet && !error ? <ActivityIndicator color={COLORS.learning} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {lessonSet ? (
        <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <LearningArtwork asset={lessonSet.coverAsset} size={190} label={lessonSet.title} />
            <View style={styles.heroInfo}>
              <Text style={[styles.eyebrow, isArabic && styles.arabicCentered]}>{tr('HYMN COURSE', 'COURS D’HYMNE', 'منهج لحن')}</Text>
              <Text style={[styles.title, isArabic && styles.arabicCentered]}>{lessonSet.title}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learn/hymn/[id]', params: { id: lessonSet.hymn.id } })}>
                <Text style={[styles.hymn, isArabic && styles.arabicCentered]}>{lessonSet.hymn.title}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: lessonSet.cantor.id } })}>
                <Text style={[styles.cantor, isArabic && styles.arabicCentered]}>{lessonSet.cantor.displayName}</Text>
              </Pressable>
              {lessonSet.season ? (
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learn/season/[id]', params: { id: lessonSet.season!.id } })}>
                  <Text style={[styles.season, isArabic && styles.arabicCentered]}>{lessonSet.season.title}</Text>
                </Pressable>
              ) : null}
              {lessonSet.description ? <Text style={[styles.description, isArabic && styles.arabicCentered]}>{lessonSet.description}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!queue.length}
                  style={({ pressed }) => [styles.playAll, !queue.length && styles.disabled, pressed && styles.pressed]}
                  onPress={() => queue.length && playLesson(0)}
                >
                  <Text style={styles.playAllText}>▶  {tr('Play Lessons', 'Lire les leçons', 'تشغيل الدروس')}</Text>
                </Pressable>
                {downloadRequest ? (
                  <LearningDownloadButton packageKey={downloadRequest.packageKey} request={downloadRequest} isArabic={isArabic} />
                ) : null}
              </View>
              {videoCount ? (
                <View style={styles.mode}>
                  <LessonModeSwitch mode={lessonVideoMode} onChange={player.setLessonVideoMode} variant="page" isArabic={isArabic} />
                  <Text style={[styles.modeNote, isArabic && styles.arabicCentered]}>
                    {lessonVideoMode === 'video'
                      ? tr('Video lessons open on their picture. Audio only uses far less data.', 'Les leçons vidéo s’ouvrent sur leur image. L’audio seul utilise bien moins de données.', 'تُفتح دروس الفيديو على صورتها. الصوت فقط يستهلك بيانات أقل بكثير.')
                      : tr('Video lessons play as audio only, to save data.', 'Les leçons vidéo sont lues en audio seulement, pour économiser les données.', 'تُشغَّل دروس الفيديو صوتاً فقط لتوفير البيانات.')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.headingRow}>
            <Text style={[styles.sectionTitle, isArabic && styles.arabic]}>{tr('Lessons', 'Leçons', 'الدروس')}</Text>
            <Text style={[styles.sectionMeta, isArabic && styles.arabic]}>
              {count + tr(count === 1 ? ' lesson' : ' lessons', count === 1 ? ' leçon' : ' leçons', ' درس')}
              {videoCount ? `  ·  ${videoCount} ${tr('video', 'vidéo', 'فيديو')}` : ''}
            </Text>
          </View>
          <View style={styles.mediaList}>
            {lessonSet.lessons.map((lesson, index) => {
              const item = queue[index];
              const active = currentItem?.id === lesson.id;
              return (
                <LearningMediaRow
                  key={lesson.id}
                  title={lesson.title}
                  subtitle={lesson.description}
                  durationMs={lesson.durationMs}
                  index={index}
                  mediaType={lesson.mediaType}
                  active={active}
                  playing={active && playing}
                  progress={rowProgress(resume, lesson)}
                  isArabic={isArabic}
                  onPress={() => playLesson(index)}
                  // As a song's title opens its page: the lesson's own page, with its picture and words.
                  onTitlePress={() => openLessonPage(lesson.id)}
                  liked={likes.isLiked(lesson.id)}
                  onToggleLike={() => likes.toggle('lesson', lesson.id)}
                  trailing={item ? (
                    <LearningItemActionsMenu
                      item={item}
                      isArabic={isArabic}
                      size={32}
                      download={learningLessonDownloadRequest(lessonSet, lesson, locale)}
                    />
                  ) : undefined}
                />
              );
            })}
            {!lessonSet.lessons.length ? <Text style={styles.empty}>{tr('No published lessons.', 'Aucune leçon publiée.', 'لا توجد دروس منشورة.')}</Text> : null}
          </View>
        </NowPlayingAwareScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  loader: { marginTop: SPACING.xl },
  error: { color: COLORS.priest, fontFamily: TYPOGRAPHY.body, textAlign: 'center', margin: SPACING.xl },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  hero: { alignItems: 'center' },
  heroInfo: { width: '100%', maxWidth: 680, alignItems: 'center', marginTop: SPACING.lg },
  eyebrow: { color: COLORS.learning, fontFamily: TYPOGRAPHY.body, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: SPACING.sm },
  hymn: { color: COLORS.learningBright, fontFamily: TYPOGRAPHY.title, fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: SPACING.sm },
  cantor: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: SPACING.xs },
  season: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: SPACING.xs },
  description: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: SPACING.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.lg },
  playAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.lg, borderRadius: RADII.pill, backgroundColor: COLORS.gold },
  playAllText: { color: COLORS.black, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '900' },
  mode: { alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md },
  modeNote: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11, textAlign: 'center', paddingHorizontal: SPACING.md },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  headingRow: { marginTop: SPACING.xl, marginBottom: SPACING.md },
  sectionTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700' },
  sectionMeta: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 3 },
  mediaList: { overflow: 'hidden', borderRadius: RADII.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, textAlign: 'center', padding: SPACING.lg },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
