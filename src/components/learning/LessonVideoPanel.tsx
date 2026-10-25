'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import LessonVideoSurface, { pictureInPictureButtonSupported } from '@/components/playback/LessonVideoSurface';
import type { LessonVideoSurfaceHandle } from '@/components/playback/lessonVideoSurfaceTypes';
import PlayerIcon from '@/components/playback/PlayerIcon';
import { PLAYER_INK } from '@/components/playback/PlayerParts';
import RoundIconButton from '@/components/playback/RoundIconButton';
import { COLORS, RADII, TYPOGRAPHY } from '@/constants/theme';
import { lessonHasAudioRendition, type LearningQueueItem, useLearningPlayer } from '@/context/LearningPlayerContext';
import { learningService } from '@/services/learningService';
import { audioSavings, videoAspect } from '@/utils/lessonPlayback';

import { tr } from '../../utils/appText';

/** The corners of a lesson's picture in the full player. */
export const LESSON_VIDEO_RADIUS = 14;

/** A lesson's picture's shape: as the player measured it, else as the catalogue knows it. */
export function lessonVideoAspect(item: Pick<LearningQueueItem, 'mediaAsset'>, measured: number | null): number {
  const { width, height } = item.mediaAsset;
  return videoAspect(measured ?? (width && height ? width / height : null));
}

/** The cover where the picture is not: filling the frame, under a shade, and in the middle when there is room. */
export function LessonPoster({ uri, compact = false, raised = false }: { uri: string | null; compact?: boolean; raised?: boolean }) {
  return (
    <View style={styles.poster}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={compact ? 0 : 24} transition={0} /> : null}
      <View style={[styles.shade, compact && styles.shadeCompact]} />
      {!compact && uri ? (
        <View style={[styles.posterCoverWrap, raised && styles.posterCoverRaised]}>
          <Image source={{ uri }} style={styles.posterCover} contentFit="cover" transition={0} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The full player's picture for a lesson with one: its video, with full
 * screen (and, on the web, picture in picture) in the corner; or, as sound
 * alone, its cover in the same frame, so switching moves nothing on the
 * page. On cellular data the picture waits for the listener's word.
 */
export default function LessonVideoPanel({
  item,
  width,
  height,
  aspect,
  isArabic,
}: {
  item: LearningQueueItem;
  width: number;
  height: number;
  aspect: number;
  isArabic: boolean;
}) {
  const player = useLearningPlayer();
  const surfaceRef = useRef<LessonVideoSurfaceHandle>(null);
  const cover = learningService.resolveAsset(item.coverAsset);
  const frame: StyleProp<ViewStyle> = { width, height, borderRadius: LESSON_VIDEO_RADIUS };

  if (player.lessonVideoMode === 'audio') {
    return <AudioOnlyFrame item={item} cover={cover} style={frame} isArabic={isArabic} />;
  }

  return (
    <LessonVideoSurface
      ref={surfaceRef}
      kind="full"
      aspect={aspect}
      contentFit="contain"
      showsBuffering={!player.cellularBlocked}
      style={frame}
      poster={<LessonPoster uri={cover} />}
    >
      {player.cellularBlocked ? (
        <View style={styles.notice}>
          <Text style={[styles.noticeText, isArabic && styles.arabic]}>
            {tr('On cellular data, the lesson plays as audio to save your data.', 'En données cellulaires, la leçon est lue en audio pour économiser vos données.', 'على بيانات الجوال يُشغَّل الدرس صوتاً فقط لتوفير بياناتك.')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={player.allowVideoOverCellularNow}
            hitSlop={6}
            style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}
          >
            <PlayerIcon name="videocam-outline" size={15} color={PLAYER_INK} />
            <Text style={[styles.noticeButtonText, isArabic && styles.arabic]}>{tr('Play video anyway', 'Lire la vidéo quand même', 'شغّل الفيديو على أي حال')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.corner}>
          {pictureInPictureButtonSupported() ? (
            <RoundIconButton
              icon="picture-in-picture"
              accessibilityLabel={tr('Picture in picture', 'Image dans l’image', 'صورة داخل صورة')}
              onPress={() => void surfaceRef.current?.startPictureInPicture()}
              size={36}
              variant="filled"
              fill="rgba(0, 0, 0, 0.55)"
              iconSize={18}
              iconColor={COLORS.white}
            />
          ) : null}
          <RoundIconButton
            icon="open-in-full"
            accessibilityLabel={tr('Full screen', 'Plein écran', 'ملء الشاشة')}
            onPress={() => void surfaceRef.current?.enterFullscreen()}
            size={36}
            variant="filled"
            fill="rgba(0, 0, 0, 0.55)"
            iconSize={17}
            iconColor={COLORS.white}
          />
        </View>
      )}
    </LessonVideoSurface>
  );
}

/** The sound alone: the cover in the picture's frame, and what it saves. */
function AudioOnlyFrame({ item, cover, style, isArabic }: { item: LearningQueueItem; cover: string | null; style: StyleProp<ViewStyle>; isArabic: boolean }) {
  const ready = lessonHasAudioRendition(item);
  const savings = ready ? audioSavings(item.mediaAsset.fileSizeBytes, item.audioAsset?.fileSizeBytes) : null;
  const note = !ready
    ? tr('The audio-only version is still being made, so the video’s sound plays for now.', 'La version audio est encore en préparation ; le son de la vidéo est lu en attendant.', 'ما زالت النسخة الصوتية قيد التجهيز، لذلك يُشغَّل صوت الفيديو الآن.')
    : savings
      ? tr(`${savings.audio} instead of ${savings.video}`, `${savings.audio} au lieu de ${savings.video}`, `${savings.audio} بدلاً من ${savings.video}`)
      : tr('Plays the smaller audio version instead of the video', 'Lit la version audio, plus légère, au lieu de la vidéo', 'يُشغّل النسخة الصوتية الأصغر بدلاً من الفيديو');
  return (
    <View style={[styles.audioFrame, style]} accessible accessibilityLabel={`${tr('Audio only', 'Audio seulement', 'صوت فقط')}. ${note}`}>
      <LessonPoster uri={cover} raised />
      <View style={styles.audioFoot}>
        <View style={styles.audioChip}>
          <PlayerIcon name="headset-outline" size={13} color={COLORS.white} />
          <Text style={[styles.audioChipText, isArabic && styles.arabic]}>{tr('Audio only', 'Audio seulement', 'صوت فقط')}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.audioNote, isArabic && styles.arabic]}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.learningDeep },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  shadeCompact: { backgroundColor: 'rgba(0, 0, 0, 0.18)' },
  posterCoverWrap: {
    height: '62%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  posterCover: { width: '100%', height: '100%' },
  // Clear of the line along the foot (the audio frame's note).
  posterCoverRaised: { height: '54%', marginBottom: '9%' },
  corner: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  notice: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  noticeText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700', textAlign: 'center', maxWidth: 420 },
  noticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.gold,
  },
  noticeButtonText: { color: PLAYER_INK, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.75 },
  audioFrame: { overflow: 'hidden', backgroundColor: COLORS.learningDeep },
  audioFoot: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  audioChipText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  audioNote: { flex: 1, color: 'rgba(255, 255, 255, 0.82)', fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '600', textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowRadius: 4 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
