'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import LearningArtwork from '@/components/learning/LearningArtwork';
import MusicArtwork from '@/components/music/MusicArtwork';
import MusicTrackActionsMenu from '@/components/music/MusicTrackActionsMenu';
import type { MusicQueueItem } from '@/context/MusicPlayerContext';
import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { learningService } from '@/services/learningService';
import { musicService } from '@/services/musicService';
import type { MusicConsumerAsset } from '@/types/musicConsumer';
import type { UnifiedSearchResult } from '@/types/unifiedSearch';
import { formatMusicTrackPerformers } from '@/utils/musicCredits';

import { tr } from '../../utils/appText';
import { splitMatches } from './searchMatches';

const MAX_FONT_SCALE = 1.3;

/** Honorifics a person's initial skips, so "Cantor Ibrahim Ayad" is "I", as the design draws him. */
const HONORIFICS = new Set(['cantor', 'chantre', 'fr', 'father', 'abouna', 'deacon', 'hegumen', 'المعلم', 'الشماس', 'أبونا', 'القس']);

function personInitial(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.toLowerCase().replace(/\./g, '') ?? '';
  const word = words.length > 1 && HONORIFICS.has(first) ? words[1] : words[0];
  return word?.charAt(0).toUpperCase() || '♪';
}

/** A line of a result with the search's words drawn in gold. */
export function MatchText({
  text,
  query,
  style,
  numberOfLines = 1,
}: {
  text: string;
  query: string;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={style} numberOfLines={numberOfLines} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {splitMatches(text, query).map((part, index) => (
        part.match ? <Text key={index} style={styles.mark}>{part.text}</Text> : part.text
      ))}
    </Text>
  );
}

/** A person's photo in a circle, or their initial in gold on vine green (the design's "av"). */
function PersonAvatar({ uri, name }: { uri: string | null; name: string }) {
  return (
    <View style={styles.avatar}>
      {uri ? (
        <Image source={{ uri }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} />
      ) : (
        <>
          <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.initial} maxFontSizeMultiplier={1}>{personInitial(name)}</Text>
        </>
      )}
    </View>
  );
}

function releaseTypeLabel(type: string): string {
  if (type === 'album') return tr('Album', 'Album', 'ألبوم');
  if (type === 'ep') return 'EP';
  return tr('Single', 'Single', 'أغنية');
}

/** "4 releases", "1 album": what an artist, cantor or album holds; nothing while unknown or none. */
function countLine(result: UnifiedSearchResult, count: number | null): string | null {
  if (!count) return null;
  const many = count !== 1;
  switch (result.kind) {
    case 'music_artist':
      return tr(`${count} ${many ? 'releases' : 'release'}`, `${count} ${many ? 'parutions' : 'parution'}`, `${count} إصدار`);
    case 'learning_cantor':
      return tr(`${count} ${many ? 'albums' : 'album'}`, `${count} ${many ? 'albums' : 'album'}`, `${count} ألبوم`);
    case 'learning_album':
      return tr(`${count} ${many ? 'recordings' : 'recording'}`, `${count} ${many ? 'enregistrements' : 'enregistrement'}`, `${count} تسجيل`);
    default:
      return null;
  }
}

/** The muted line under a result's name, or null when the result has nothing to add. */
function resultDetail(result: UnifiedSearchResult, count: number | null): string | null {
  switch (result.kind) {
    case 'music_release':
      return [releaseTypeLabel(result.metadata.releaseType), result.metadata.releaseDate?.slice(0, 4), result.metadata.primaryArtist?.displayName ?? result.subtitle]
        .filter(Boolean)
        .join(' · ');
    case 'music_track':
      return formatMusicTrackPerformers({ artists: result.metadata.artists }) || null;
    case 'learning_album':
      return [countLine(result, count), result.metadata.cantorName || result.subtitle].filter(Boolean).join(' · ') || null;
    case 'learning_lesson':
      return [result.metadata.lessonSetTitle, result.metadata.cantorName].filter(Boolean).join(' · ') || null;
    case 'learning_hymn':
      return result.subtitle;
    // An artist's or cantor's search body is their biography, too long for a
    // row; their line is what they hold. A season is its own name.
    case 'music_artist':
    case 'learning_cantor':
      return countLine(result, count);
    default:
      return null;
  }
}

interface SearchResultRowProps {
  result: UnifiedSearchResult;
  query: string;
  arabic: boolean;
  /** The track or lesson now playing. */
  active: boolean;
  /** For an artist: whether you follow them. */
  following?: boolean;
  /** For an artist without a photo: their latest release's cover. */
  fallbackArt?: MusicConsumerAsset | null;
  /** For an artist, cantor or album: how many releases, albums or recordings it holds, once known. */
  count?: number | null;
  /** For a track: in your Liked Tracks. For a lesson: in My Learning. */
  saved?: boolean;
  /** A track's actions-menu item. */
  queueItem?: MusicQueueItem;
  onPress: () => void;
  /** A track's name opens its own page. */
  onTitlePress?: () => void;
  /** A track's heart, a lesson's bookmark. */
  onToggleSaved?: () => void;
}

/**
 * One search result on a card of its own (Coptic Vine design, "Search
 * results"): the person's medallion or the cover, the name with the search's
 * words in gold over a muted line, and a chevron — or, for a track, the heart
 * and its menu, and for a lesson, the bookmark that adds it to Will Learn.
 */
export default function SearchResultRow({
  result, query, arabic, active, following = false, fallbackArt = null, count = null, saved = false, queueItem, onPress, onTitlePress, onToggleSaved,
}: SearchResultRowProps) {
  const detail = resultDetail(result, count);
  const followingLabel = tr('Following', 'Abonné', 'تتابعه');
  const track = result.kind === 'music_track';
  const lesson = result.kind === 'learning_lesson';
  const titleStyle = [styles.title, active && styles.titleActive, arabic && styles.arabic];
  // The detail line often carries Latin names (performers, cantors), so it is
  // only held to the left, not forced right-to-left, or they would clip from their start.
  const detailStyle = [styles.detail, arabic && styles.arabicAlign];

  let artwork: ReactNode;
  switch (result.kind) {
    case 'music_artist':
      artwork = <PersonAvatar uri={musicService.resolveAsset(result.metadata.profileImageAsset ?? fallbackArt)} name={result.title} />;
      break;
    case 'learning_cantor':
      artwork = <PersonAvatar uri={learningService.resolveAsset(result.metadata.profileImageAsset)} name={result.title} />;
      break;
    case 'music_release':
      artwork = <MusicArtwork asset={result.metadata.coverAsset} size={54} radius={10} label={result.title} />;
      break;
    case 'music_track':
      artwork = <MusicArtwork asset={result.metadata.coverAsset} size={46} radius={10} label={result.metadata.releaseTitle ?? result.title} />;
      break;
    case 'learning_album':
      artwork = <LearningArtwork asset={result.metadata.coverAsset} size={54} radius={10} label={result.title} />;
      break;
    case 'learning_lesson':
      artwork = <LearningArtwork asset={result.metadata.coverAsset} size={46} radius={10} label={result.title} />;
      break;
    default:
      artwork = <LearningArtwork asset={null} size={54} radius={10} label={result.title} />;
  }

  const title = <MatchText text={result.title} query={query} style={titleStyle} />;

  // The row's own tap (open or play) and its heart, bookmark or menu are
  // siblings, never one button inside another.
  return (
    <View style={styles.row}>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[result.title, following ? followingLabel : null, detail].filter(Boolean).join(', ')}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {artwork}

        <View style={styles.text}>
          {track && onTitlePress ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={tr(`Open ${result.title}`, `Ouvrir ${result.title}`, `افتح ${result.title}`)}
              onPress={(event) => {
                event.stopPropagation();
                onTitlePress();
              }}
              style={({ pressed }) => pressed && styles.titlePressed}
            >
              {title}
            </Pressable>
          ) : title}

          {/* "Following" leads an artist's line in gold: "Following · 6 releases". */}
          {following ? (
            <Text style={detailStyle} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              <Text style={styles.following}>{followingLabel}</Text>
              {detail ? ` · ${detail}` : null}
            </Text>
          ) : detail ? (
            <MatchText text={detail} query={query} style={detailStyle} />
          ) : null}
        </View>

        {!track && !lesson ? (
          <Icon name="chevron-forward" size={17} color={COLORS.gold} style={styles.chevron} />
        ) : null}
      </Pressable>

      {(track || lesson) && onToggleSaved ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={track
            ? (saved ? tr('Unlike track', 'Ne plus aimer le titre', 'إلغاء الإعجاب') : tr('Like track', 'Aimer le titre', 'إعجاب'))
            : (saved ? tr('In Will Learn', 'Dans À apprendre', 'في سأتعلم') : tr('Add to Will Learn', 'Ajouter à À apprendre', 'أضف إلى سأتعلم'))}
          aria-selected={saved}
          // My Learning has no way to take a lesson back out, so a saved
          // lesson's bookmark stays filled rather than pretending to toggle.
          disabled={lesson && saved}
          hitSlop={4}
          onPress={onToggleSaved}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
        >
          <Icon
            name={track ? (saved ? 'heart' : 'heart-outline') : (saved ? 'bookmark' : 'bookmark-outline')}
            size={19}
            color={saved ? COLORS.gold : COLORS.muted}
          />
        </Pressable>
      ) : null}

      {track && queueItem ? <MusicTrackActionsMenu item={queueItem} isArabic={arabic} size={34} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 8,
  },
  main: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  pressed: { opacity: 0.8 },
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.greenDeep,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 50,
  },
  initial: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 20, fontWeight: '700' },
  text: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600' },
  titleActive: { color: COLORS.gold },
  titlePressed: { opacity: 0.65 },
  detail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 2 },
  mark: { color: COLORS.goldBright },
  following: { color: COLORS.gold, fontWeight: '700' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicAlign: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left' },
  iconButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  iconPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  chevron: { marginRight: 4 },
});
