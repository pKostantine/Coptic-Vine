import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import { BuddedCross } from '@/components/vine/ui/Ornaments';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';

const MAX_FONT_SCALE = 1.3;

/** Covers without artwork wear one of the seasons' colours, chosen by the release. */
const COVER_FALLS: [string, string][] = [
  ['#2B5A30', '#14301B'],
  ['#8A2A5C', '#3A1030'],
  ['#4A1010', '#070202'],
  ['#1D4F8A', '#0B1D36'],
  ['#5E8A2E', '#2A4A22'],
  ['#9A6A12', '#3A2606'],
];

function coverFall(key: string): [string, string] {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVER_FALLS[hash % COVER_FALLS.length];
}

interface ReleaseTileProps {
  /** Keys the fallback colour, so a release keeps its colour wherever it appears. */
  id: string;
  title: string;
  /** Under the title, in gold: the artist, or "2026 · Album". */
  subtitle: string | null;
  artworkUri: string | null;
  /** The tile's width; its cover is square. */
  width: number | `${number}%`;
  arabic?: boolean;
  onPress: () => void;
  /** The gold play button on the cover's corner. */
  onPlay?: () => void;
  playLabel?: string;
  /** After the text: a heart, a chevron. */
  trailing?: ReactNode;
  /** Two lines for the title (an artist's grid) rather than one (a rail). */
  wrapTitle?: boolean;
}

/**
 * A release on a shelf (Coptic Vine design, "Music"): its cover with a gold
 * play button on the corner, its name, and the artist in gold beneath.
 */
export default function ReleaseTile({
  id, title, subtitle, artworkUri, width, arabic = false, onPress, onPlay, playLabel, trailing, wrapTitle = false,
}: ReleaseTileProps) {
  const [from, to] = coverFall(id);
  return (
    <View style={[styles.tile, { width }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        onPress={onPress}
        style={({ pressed }) => [styles.coverPress, pressed && styles.pressed]}
      >
        <View style={styles.cover}>
          {artworkUri ? (
            <Image source={{ uri: artworkUri }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} />
          ) : (
            <>
              <LinearGradient colors={[from, to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.coverCross} pointerEvents="none">
                <BuddedCross size={54} />
              </View>
            </>
          )}
        </View>
        <View style={[styles.text, arabic && styles.rowReverse]}>
          <View style={styles.titles}>
            <Text style={[styles.title, arabic && styles.arabic]} numberOfLines={wrapTitle ? 2 : 1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{subtitle}</Text> : null}
          </View>
          {trailing}
        </View>
      </Pressable>
      {onPlay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playLabel ?? `Play ${title}`}
          hitSlop={6}
          onPress={onPlay}
          style={({ pressed }) => [styles.play, arabic ? styles.playLeft : styles.playRight, pressed && styles.pressed]}
        >
          <Icon name="play" size={15} color={COLORS.greenDeep} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { minWidth: 0 },
  coverPress: { minWidth: 0 },
  pressed: { opacity: 0.8 },
  cover: {
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 14,
    boxShadow: '0px 10px 22px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    width: '100%',
  },
  coverCross: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, opacity: 0.55, position: 'absolute', right: 0, top: 0 },
  // The play button sits on the cover's corner, 8 in from the edges, beside the tile's own tap target.
  play: {
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    borderRadius: 17,
    boxShadow: '0px 6px 14px rgba(0, 0, 0, 0.4)',
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    width: 34,
  },
  playRight: { right: 8 },
  playLeft: { left: 8 },
  text: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 9 },
  rowReverse: { flexDirection: 'row-reverse' },
  titles: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '600', lineHeight: 17.5 },
  subtitle: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 2 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
});
