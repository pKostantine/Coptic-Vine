'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LearningArtwork from '@/components/learning/LearningArtwork';
import LearningBackHeader from '@/components/learning/LearningBackHeader';
import LearningDownloadButton from '@/components/learning/LearningDownloadButton';
import LearningItemActionsMenu from '@/components/learning/LearningItemActionsMenu';
import LearningMediaRow from '@/components/learning/LearningMediaRow';
import LearningPlaylistPicker from '@/components/learning/LearningPlaylistPicker';
import LessonModeSwitch from '@/components/learning/LessonModeSwitch';
import { LESSON_VIDEO_RADIUS, LessonPoster } from '@/components/learning/LessonVideoPanel';
import MusicLyricsView, { LyricsLanguageSwitch } from '@/components/music/MusicLyricsView';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import PlayerIcon from '@/components/playback/PlayerIcon';
import { PLAYER_INK } from '@/components/playback/PlayerParts';
import Icon from '@/components/vine/ui/Icon';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useBottomChrome } from '@/context/BottomChromeContext';
import {
  learningLessonSetQueue,
  lessonHasAudioRendition,
  lessonHasVideo,
  useLearningPlayer,
} from '@/context/LearningPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { usePlayLessons } from '@/hooks/usePlayLessons';
import { learningService, type LearningLessonDetailPayload } from '@/services/learningService';
import { learningLessonDownloadRequest } from '@/services/offlineDownloadRequests';
import type { LearningLesson } from '@/types/learningPlatform';
import type { PublishedLyricSet } from '@/types/musicConsumer';
import { loadLearningResume, peekLearningResume, subscribeLearningResume, type LearningResumeMap } from '@/utils/learningResume';
import { audioSavings } from '@/utils/lessonPlayback';
import { goBack } from '@/utils/navigation';

import { tr } from '../../../utils/appText';

function rowProgress(resume: LearningResumeMap, lesson: LearningLesson): number {
  const entry = resume[lesson.id];
  const duration = entry?.durationMs ?? lesson.durationMs;
  if (!entry || !duration || duration <= 0) return 0;
  return Math.max(0, Math.min(1, entry.positionMs / duration));
}

/**
 * A lesson's page: its cover with Play, then its words, its lyrics and the
 * rest of its set. A lesson with a picture says whether it plays as video or
 * as audio only, and what that costs in data; watched as video, Play opens
 * the full player on its picture (the bar and the full player are where a
 * lesson's picture is shown).
 */
export default function LearningLessonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; setId: string }>();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const isArabic = locale === 'ar';
  const lessonId = Array.isArray(params.id) ? params.id[0] : params.id;
  const lessonSetId = Array.isArray(params.setId) ? params.setId[0] : params.setId;
  const { width, height } = useWindowDimensions();
  const [data, setData] = useState<LearningLessonDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useLearningPlayer();
  const playLessons = usePlayLessons();
  const { requestNowPlayingOpen } = useBottomChrome();
  const [resume, setResume] = useState<LearningResumeMap>(() => peekLearningResume());
  // The lyrics loaded for a lesson, under its id: another lesson's are stale,
  // and "loading" is simply not having this lesson's yet.
  const [lyricsState, setLyricsState] = useState<{ lessonId: string | null; sets: PublishedLyricSet[] }>({ lessonId: null, sets: [] });
  const [selectedLyricSetId, setSelectedLyricSetId] = useState<string | null>(null);
  const lyricSets = lyricsState.lessonId === lessonId ? lyricsState.sets : [];
  const lyricsLoading = Boolean(lessonId) && lyricsState.lessonId !== lessonId;

  const queue = useMemo(() => (data ? learningLessonSetQueue(data.lessonSet) : []), [data]);
  const index = data ? queue.findIndex((entry) => entry.id === data.lesson.id) : -1;
  const item = index >= 0 ? queue[index] : null;
  const isCurrent = Boolean(item && player.currentItem?.id === item.id);
  const hasVideo = Boolean(item && lessonHasVideo(item));
  const mode = player.lessonVideoMode;
  const linkIncomplete = !lessonId || !lessonSetId;
  const downloadRequest = useMemo(
    () => (data ? learningLessonDownloadRequest(data.lessonSet, data.lesson, locale) : null),
    [data, locale],
  );
  // A phone on its side, an iPad, a desktop window: the cover and the words
  // keep the left, the lyrics and the lessons scroll on the right.
  const twoColumns = width > height && width >= 640;

  useEffect(() => {
    if (!lessonId || !lessonSetId) return;
    let active = true;
    learningService.getLesson(lessonSetId, lessonId, locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setData(payload);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load lesson.'); });
    return () => { active = false; };
  }, [lessonId, lessonSetId, locale]);

  useEffect(() => {
    let active = true;
    void loadLearningResume().then((map) => { if (active) setResume(map); });
    const unsubscribe = subscribeLearningResume(() => setResume(peekLearningResume()));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    learningService.getLyrics('lesson', lessonId)
      .then((payload) => {
        if (!active) return;
        const sets: PublishedLyricSet[] = payload.lyricSets.map((set) => ({
          id: set.id,
          trackId: set.itemId,
          locale: set.locale,
          kind: 'original',
          syncPrecision: set.syncPrecision,
          title: null,
          source: null,
          publicationStatus: set.publicationStatus,
          lines: set.lines.map((line) => ({ ...line, words: line.words ?? [] })),
        }));
        setLyricsState({ lessonId, sets });
        const preferred = sets.find((set) => set.locale === locale) ?? sets.find((set) => set.locale === 'en') ?? sets[0] ?? null;
        setSelectedLyricSetId(preferred?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setLyricsState({ lessonId, sets: [] });
        setSelectedLyricSetId(null);
      });
    return () => { active = false; };
  }, [lessonId, locale]);

  const selectedSet = lyricSets.find((set) => set.id === selectedLyricSetId) ?? null;
  const positionMs = isCurrent ? player.currentTimeMs : 0;
  const activeLineId = useMemo(() => {
    if (!isCurrent || !selectedSet || selectedSet.syncPrecision === 'unsynced') return null;
    return selectedSet.lines.find((line, lineIndex) => {
      if (line.startMs == null) return false;
      const nextStart = selectedSet.lines[lineIndex + 1]?.startMs ?? null;
      const effectiveEnd = line.endMs ?? nextStart ?? Number.POSITIVE_INFINITY;
      return positionMs >= line.startMs && positionMs < effectiveEnd;
    })?.id ?? null;
  }, [isCurrent, positionMs, selectedSet]);

  const playLesson = (lessonIndex: number) => {
    if (!data || lessonIndex < 0 || lessonIndex >= queue.length) return;
    const target = queue[lessonIndex];
    if (player.currentItem?.id === target.id) {
      player.togglePlayback();
      return;
    }
    playLessons(queue, lessonIndex);
    if (target.id !== data.lesson.id) {
      router.replace({ pathname: '/learn/lesson/[id]', params: { id: target.id, setId: data.lessonSet.id } });
    }
  };

  if (!data) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <Head><title>{tr('Lesson', 'Leçon', 'الدرس') + ' — Learn & Study'}</title></Head>
        <LearningBackHeader title={tr('Lesson', 'Leçon', 'الدرس')} isArabic={isArabic} onBack={() => goBack(router, '/learn')} />
        {!error && !linkIncomplete ? <ActivityIndicator color={COLORS.learning} style={styles.loader} /> : null}
        {linkIncomplete || error ? (
          <Text style={styles.error}>{linkIncomplete ? tr('This lesson link is incomplete.', 'Ce lien de leçon est incomplet.', 'رابط الدرس هذا غير مكتمل.') : error}</Text>
        ) : null}
      </SafeAreaView>
    );
  }

  const { lesson, lessonSet } = data;
  const coverUri = learningService.resolveAsset(lessonSet.coverAsset);
  const number = index + 1;
  const audioReady = item ? lessonHasAudioRendition(item) : true;
  const savings = audioReady ? audioSavings(lesson.mediaAsset.fileSizeBytes, lesson.audioAsset?.fileSizeBytes) : null;
  const playing = isCurrent && player.playing;

  const hero = (
    <View style={[styles.hero, { maxWidth: twoColumns ? undefined : 720 }]}>
      <LessonPoster uri={coverUri} />
      <View style={styles.heroInner}>
        {!coverUri ? <LearningArtwork asset={lessonSet.coverAsset} size={twoColumns ? 96 : 112} radius={16} label={lessonSet.title} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? tr('Pause', 'Pause', 'إيقاف مؤقت') : tr('Play lesson', 'Lire la leçon', 'تشغيل الدرس')}
          onPress={() => playLesson(index)}
          style={({ pressed }) => [styles.heroPlay, pressed && styles.pressed]}
        >
          {isCurrent && player.buffering ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={26} color={COLORS.black} style={playing ? undefined : styles.playNudge} />
          )}
        </Pressable>
      </View>
    </View>
  );

  const openPlayer = isCurrent ? (
    <Pressable
      accessibilityRole="button"
      onPress={requestNowPlayingOpen}
      style={({ pressed }) => [styles.openPlayer, pressed && styles.pressed]}
    >
      <PlayerIcon name={hasVideo && mode === 'video' ? 'videocam-outline' : 'open-in-full'} size={16} color={PLAYER_INK} />
      <Text style={[styles.openPlayerText, isArabic && styles.arabic]}>
        {hasVideo && mode === 'video' ? tr('Watch in the player', 'Regarder dans le lecteur', 'شاهد في المشغّل') : tr('Open the player', 'Ouvrir le lecteur', 'افتح المشغّل')}
      </Text>
    </Pressable>
  ) : null;

  const modeBlock = hasVideo ? (
    <View style={styles.modeBlock}>
      <LessonModeSwitch mode={mode} onChange={player.setLessonVideoMode} variant="page" isArabic={isArabic} />
      {mode === 'video' && player.cellularBlocked ? (
        <View style={styles.noteRow}>
          <Text style={[styles.note, isArabic && styles.arabic]}>
            {tr('On cellular data the lesson plays as audio.', 'En données cellulaires, la leçon est lue en audio.', 'على بيانات الجوال يُشغَّل الدرس صوتاً فقط.')}
          </Text>
          <Pressable accessibilityRole="button" onPress={player.allowVideoOverCellularNow} hitSlop={6}>
            <Text style={styles.noteAction}>{tr('Play video anyway', 'Lire la vidéo quand même', 'شغّل الفيديو على أي حال')}</Text>
          </Pressable>
        </View>
      ) : null}
      {mode === 'audio' && !audioReady ? (
        <Text style={[styles.note, isArabic && styles.arabic]}>
          {tr('The audio-only version is still being made, so this plays the video’s sound for now.', 'La version audio est encore en préparation ; le son de la vidéo est lu en attendant.', 'ما زالت النسخة الصوتية قيد التجهيز، لذلك يُشغَّل صوت الفيديو الآن.')}
        </Text>
      ) : null}
      {audioReady && savings ? (
        <Text style={[styles.note, isArabic && styles.arabic]}>
          {tr(`Audio only uses ${savings.audio} instead of ${savings.video}.`, `L’audio seul utilise ${savings.audio} au lieu de ${savings.video}.`, `الصوت فقط يستخدم ${savings.audio} بدلاً من ${savings.video}.`)}
        </Text>
      ) : null}
    </View>
  ) : null;

  const words = (
    <View style={styles.meta}>
      <Text style={[styles.type, isArabic && styles.arabic]}>
        {hasVideo
          ? tr('VIDEO LESSON', 'LEÇON VIDÉO', 'درس فيديو')
          : tr('AUDIO LESSON', 'LEÇON AUDIO', 'درس صوتي')}
        {number > 0 ? `  ·  ${number}/${lessonSet.lessons.length}` : ''}
      </Text>
      <Text style={[styles.title, isArabic && styles.arabic]}>{lesson.title}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learn/lesson-set/[id]', params: { id: lessonSet.id } })}>
        <Text style={[styles.setTitle, isArabic && styles.arabic]}>{lessonSet.title}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: lessonSet.cantor.id } })}>
        <Text style={[styles.cantor, isArabic && styles.arabic]}>{lessonSet.cantor.displayName}</Text>
      </Pressable>
      {lesson.description ? <Text style={[styles.description, isArabic && styles.arabic]}>{lesson.description}</Text> : null}
      <View style={styles.actions}>
        {downloadRequest ? (
          <LearningDownloadButton packageKey={downloadRequest.packageKey} request={downloadRequest} isArabic={isArabic} compact />
        ) : null}
        <LearningPlaylistPicker itemKind="lesson" itemId={lesson.id} locale={locale} isArabic={isArabic} />
        {item ? <LearningItemActionsMenu item={item} isArabic={isArabic} size={40} /> : null}
      </View>
    </View>
  );

  const lyrics = lyricSets.length || lyricsLoading ? (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isArabic && styles.arabic]}>{tr('Lyrics', 'Paroles', 'الكلمات')}</Text>
        <LyricsLanguageSwitch sets={lyricSets} selectedId={selectedLyricSetId} onSelect={setSelectedLyricSetId} isArabic={isArabic} />
      </View>
      <MusicLyricsView
        lyricSets={lyricSets}
        selectedSetId={selectedLyricSetId}
        onSelectSet={setSelectedLyricSetId}
        activeLineId={activeLineId}
        loading={lyricsLoading}
        onSeekLine={(startMs) => { if (isCurrent) void player.seekToMs(startMs); }}
        variant="panel"
        hideTabs
        style={styles.lyrics}
      />
    </View>
  ) : null;

  const lessons = (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isArabic && styles.arabic]}>{tr('Lessons in this set', 'Leçons de cette série', 'دروس هذه المجموعة')}</Text>
        <Text style={[styles.sectionMeta, isArabic && styles.arabic]}>
          {lessonSet.lessons.length + tr(lessonSet.lessons.length === 1 ? ' lesson' : ' lessons', lessonSet.lessons.length === 1 ? ' leçon' : ' leçons', ' درس')}
        </Text>
      </View>
      <View style={styles.mediaList}>
        {lessonSet.lessons.map((entry, entryIndex) => (
          <LearningMediaRow
            key={entry.id}
            title={entry.title}
            subtitle={entry.description}
            durationMs={entry.durationMs}
            index={entryIndex}
            mediaType={entry.mediaType}
            active={player.currentItem?.id === entry.id}
            playing={player.currentItem?.id === entry.id && player.playing}
            progress={rowProgress(resume, entry)}
            isArabic={isArabic}
            onPress={() => playLesson(entryIndex)}
          />
        ))}
      </View>
    </View>
  );

  const top = (
    <>
      {hero}
      {openPlayer}
      {modeBlock}
      {words}
    </>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <Head><title>{lesson.title + ' — ' + lessonSet.title + ' — Learn & Study'}</title></Head>
      <LearningBackHeader title={tr('Lesson', 'Leçon', 'الدرس')} isArabic={isArabic} onBack={() => goBack(router, '/learn')} />
      {twoColumns ? (
        <View style={styles.columns}>
          <NowPlayingAwareScrollView style={styles.leftColumn} contentContainerStyle={styles.leftContent} showsVerticalScrollIndicator={false}>
            {top}
          </NowPlayingAwareScrollView>
          <NowPlayingAwareScrollView style={styles.rightColumn} contentContainerStyle={styles.rightContent} showsVerticalScrollIndicator={false}>
            {lyrics}
            {lessons}
          </NowPlayingAwareScrollView>
        </View>
      ) : (
        <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {top}
          {lyrics}
          {lessons}
        </NowPlayingAwareScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  loader: { marginTop: SPACING.xl },
  error: { color: COLORS.priest, fontFamily: TYPOGRAPHY.body, textAlign: 'center', margin: SPACING.xl },
  content: { padding: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xl, gap: SPACING.sm },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  leftColumn: { flex: 11, minWidth: 0 },
  leftContent: { padding: SPACING.md, gap: SPACING.sm },
  rightColumn: { flex: 9, minWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: COLORS.border },
  rightContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: LESSON_VIDEO_RADIUS,
    backgroundColor: COLORS.learningDeep,
    borderWidth: 1,
    borderColor: COLORS.learningLine,
  },
  heroInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  heroPlay: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold },
  playNudge: { marginLeft: 4 },
  pressed: { opacity: 0.75 },
  openPlayer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.gold,
  },
  openPlayerText: { color: PLAYER_INK, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '900' },
  modeBlock: { alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs },
  noteRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  note: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11, textAlign: 'center', paddingHorizontal: SPACING.md },
  noteAction: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800' },
  meta: { alignItems: 'center', maxWidth: 720, width: '100%', alignSelf: 'center', marginTop: SPACING.md },
  type: { color: COLORS.learning, fontFamily: TYPOGRAPHY.body, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: SPACING.sm },
  setTitle: { color: COLORS.learningBright, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: SPACING.sm },
  cantor: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, textAlign: 'center', marginTop: 4 },
  description: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: SPACING.md },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  section: { marginTop: SPACING.xl, width: '100%', maxWidth: 960, alignSelf: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700' },
  sectionMeta: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12 },
  lyrics: { marginTop: 0 },
  mediaList: { overflow: 'hidden', borderRadius: RADII.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
