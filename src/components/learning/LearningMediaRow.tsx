import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { LearningLessonMediaType } from '@/types/learningPlatform';

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs < 0) return '';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ':' + seconds.toString().padStart(2, '0');
}

/**
 * A recording or lesson in a list, laid out as a song is on an album
 * (MusicTrackRow): its number, its title and the line under it, its length,
 * then the one More menu that holds everything else.
 */
export default function LearningMediaRow({
  title,
  subtitle,
  durationMs,
  index,
  mediaType = 'audio',
  active = false,
  playing = false,
  progress = 0,
  onPress,
  onTitlePress,
  trailing,
  liked,
  onToggleLike,
  isArabic = false,
}: {
  title: string;
  subtitle?: string | null;
  durationMs: number | null;
  index: number;
  mediaType?: LearningLessonMediaType;
  active?: boolean;
  /** The active row is sounding now (a pause glyph instead of play). */
  playing?: boolean;
  /** How far through it the listener got, 0–1, as a hairline along the foot. */
  progress?: number;
  onPress: () => void;
  /** Opens the item's own page without changing playback. */
  onTitlePress?: () => void;
  /** The row's More menu; without one, a play glyph stands in its place. */
  trailing?: ReactNode;
  /** With onToggleLike, a heart before the menu, as on a song. */
  liked?: boolean;
  onToggleLike?: () => void;
  isArabic?: boolean;
}) {
  const watched = Math.max(0, Math.min(1, progress));
  const titleText = (
    <Text numberOfLines={1} style={[styles.title, isArabic && styles.arabic, active && styles.activeText]}>{title}</Text>
  );
  return (
    <View style={[styles.row, active && styles.rowActive]}>
      <Pressable accessibilityRole="button" style={styles.main} onPress={onPress}>
        <Text style={[styles.index, active && styles.activeText]}>{index + 1}</Text>
        <View style={styles.info}>
          {onTitlePress ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open ${title}`}
              onPress={(event) => {
                event.stopPropagation();
                onTitlePress();
              }}
              style={({ pressed }) => pressed && styles.titlePressed}
            >
              {titleText}
            </Pressable>
          ) : titleText}
          {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, isArabic && styles.arabic]}>{subtitle}</Text> : null}
        </View>
        <View style={styles.meta}>
          {mediaType === 'video' ? <Text style={styles.type}>VIDEO</Text> : null}
          <Text style={styles.duration}>{formatDuration(durationMs)}</Text>
        </View>
        {onToggleLike ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike ' + title : 'Like ' + title}
            hitSlop={6}
            onPress={(event) => {
              event.stopPropagation();
              onToggleLike();
            }}
            style={styles.likeButton}
          >
            <Icon name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? COLORS.goldBright : COLORS.muted} />
          </Pressable>
        ) : null}
        {trailing ? null : <Text style={[styles.play, active && styles.activeText]}>{active && playing ? '❚❚' : '▶'}</Text>}
      </Pressable>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {watched > 0 ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${watched * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowActive: { backgroundColor: COLORS.learningSoft },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },
  index: { width: 24, textAlign: 'center', color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontVariant: ['tabular-nums'] },
  info: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  titlePressed: { opacity: 0.62 },
  subtitle: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 3 },
  meta: { alignItems: 'flex-end', gap: 2 },
  type: { color: COLORS.learning, fontFamily: TYPOGRAPHY.body, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  duration: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontVariant: ['tabular-nums'] },
  likeButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  play: { width: 22, textAlign: 'center', color: COLORS.learningBright, fontSize: 12 },
  progressTrack: { position: 'absolute', left: SPACING.md, right: SPACING.md, bottom: 0, height: 2, pointerEvents: 'none', backgroundColor: 'transparent' },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: COLORS.gold },
  trailing: { paddingRight: SPACING.sm },
  activeText: { color: COLORS.learningBright },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
