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

/** The shelf's sizes: a phone's rail and grid, and the iPad's and desktop's larger grid. */
const SIZES = {
  regular: { play: 34, playIcon: 15, playInset: 8, heart: 18, title: 13.5, titleLine: 17.5, subtitle: 12 },
  large: { play: 42, playIcon: 18, playInset: 12, heart: 20, title: 15, titleLine: 19.5, subtitle: 13 },
};
/** The name sits this far under the cover. */
const TEXT_GAP = 9;

interface ReleaseTileProps {
  /** Keys the fallback colour, so a release keeps its colour wherever it appears. */
  id: string;
  title: string;
  /** Under the title, in gold: the artist, or "2026 · Album". */
  subtitle: string | null;
  artworkUri: string | null;
  /** The tile's width; its cover is square. */
  width: number;
  arabic?: boolean;
  onPress: () => void;
  /** The gold play button on the cover's corner. */
  onPlay?: () => void;
  playLabel?: string;
  /** Pause on the cover's button while this release plays. */
  playing?: boolean;
  /** The heart after the name, on a shelf that saves likes. */
  liked?: boolean;
  onToggleLike?: () => void;
  likeLabel?: string;
  /** After the text, inside the tile's own tap target: a chevron. */
  trailing?: ReactNode;
  /** Two lines for the title (an artist's grid) rather than one (a rail). */
  wrapTitle?: boolean;
  /** The iPad's and desktop's grid: a larger name, heart and play button. */
  large?: boolean;
  /** A gold badge on the cover's corner: "New". */
  badge?: string;
}

/**
 * A release on a shelf (Coptic Vine design, "Music"): its cover with a gold
 * play button on the corner, its name with a heart beside it, and the artist
 * in gold beneath.
 */
export default function ReleaseTile({
  id, title, subtitle, artworkUri, width, arabic = false, onPress, onPlay, playLabel, playing = false,
  liked = false, onToggleLike, likeLabel, trailing, wrapTitle = false, large = false, badge,
}: ReleaseTileProps) {
  const [from, to] = coverFall(id);
  const size = large ? SIZES.large : SIZES.regular;
  const titleLines = large ? 3 : wrapTitle ? 2 : 1;
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
                <BuddedCross size={Math.round(width * 0.4)} />
              </View>
            </>
          )}
          {badge ? (
            <View style={[styles.badge, arabic ? styles.badgeRight : styles.badgeLeft]}>
              <Text style={[styles.badgeText, arabic && styles.arabicBadge]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{arabic ? badge : badge.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.text, arabic && styles.rowReverse]}>
          <View style={styles.titles}>
            <Text style={[styles.title, { fontSize: size.title, lineHeight: size.titleLine }, arabic && styles.arabic]} numberOfLines={titleLines} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { fontSize: size.subtitle }, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{subtitle}</Text> : null}
          </View>
          {trailing}
          {/* Room for the heart, which is a button of its own beside this one: a button in a button is invalid on web. */}
          {onToggleLike ? <View style={{ width: size.heart }} /> : null}
        </View>
      </Pressable>
      {onPlay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playLabel ?? `Play ${title}`}
          hitSlop={6}
          onPress={onPlay}
          style={({ pressed }) => [
            styles.play,
            { borderRadius: size.play / 2, height: size.play, top: width - size.playInset - size.play, width: size.play },
            arabic ? { left: size.playInset } : { right: size.playInset },
            pressed && styles.pressed,
          ]}
        >
          <Icon name={playing ? 'pause' : 'play'} size={size.playIcon} color={COLORS.greenDeep} />
        </Pressable>
      ) : null}
      {onToggleLike ? (
        <Pressable
          accessibilityRole="button"
          aria-selected={liked}
          accessibilityLabel={likeLabel ?? title}
          hitSlop={8}
          onPress={onToggleLike}
          style={({ pressed }) => [styles.heart, { top: width + TEXT_GAP + 1 }, arabic ? styles.heartLeft : styles.heartRight, pressed && styles.pressed]}
        >
          <Icon name={liked ? 'heart' : 'heart-outline'} size={size.heart} color={liked ? COLORS.gold : COLORS.muted} />
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
  badge: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, height: 22, justifyContent: 'center', paddingHorizontal: 9, position: 'absolute', top: 10 },
  badgeLeft: { left: 10 },
  badgeRight: { right: 10 },
  badgeText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  arabicBadge: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
  // The play button sits on the cover's lower corner, beside the tile's own tap target.
  play: {
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    boxShadow: '0px 6px 14px rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    position: 'absolute',
  },
  heart: { position: 'absolute' },
  heartRight: { right: 0 },
  heartLeft: { left: 0 },
  text: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, marginTop: TEXT_GAP },
  rowReverse: { flexDirection: 'row-reverse' },
  titles: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontWeight: '600' },
  subtitle: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, marginTop: 2 },
  // Right-aligned, but in the direction of its own words: a Latin title reads from its start and is cut at its end.
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right' },
});
