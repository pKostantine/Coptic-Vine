'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import MusicArtwork from '@/components/music/MusicArtwork';
import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { musicService } from '@/services/musicService';
import type { MusicConsumerReleaseSummary } from '@/types/musicConsumer';

import { tr } from '../../utils/appText';
const MAX_FONT_SCALE = 1.3;

interface FeaturedReleaseProps {
  release: MusicConsumerReleaseSummary;
  arabic?: boolean;
  onOpen: () => void;
  onPlay: () => void;
  playing?: boolean;
  /** Its tracks are being fetched to play: the Play button spins. */
  loading?: boolean;
  liked?: boolean;
  onToggleLike?: () => void;
  likeBusy?: boolean;
}

/**
 * The newest release at the head of the Music tab (Coptic Vine design,
 * "Latest Releases"): its cover large on a wash of its own colours, its name,
 * the artist in gold, and Play and Like beneath.
 */
export default function FeaturedRelease({ release, arabic = false, onOpen, onPlay, playing = false, loading = false, liked = false, onToggleLike, likeBusy = false }: FeaturedReleaseProps) {
  const coverUri = musicService.resolveAsset(release.coverAsset);
  const artist = release.primaryArtist?.displayName
    ?? (release.releaseType === 'album' ? tr('Album', 'Album', 'ألبوم') : release.releaseType === 'ep' ? 'EP' : tr('Single', 'Single', 'أغنية'));
  return (
    <View style={styles.card}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} contentFit="cover" blurRadius={30} style={styles.wash} />
      ) : (
        <LinearGradient colors={['#2B5A30', '#0B1C10']} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={['rgba(11, 28, 16, 0.15)', 'rgba(11, 28, 16, 0.86)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.inner}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${release.title}, ${artist}`} onPress={onOpen} style={({ pressed }) => [styles.art, pressed && styles.pressed]}>
          <MusicArtwork asset={release.coverAsset} size={128} label={release.title} />
        </Pressable>
        <View style={styles.text}>
          <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={[styles.title, arabic && styles.arabicText]} numberOfLines={3} maxFontSizeMultiplier={MAX_FONT_SCALE}>{release.title}</Text>
            <Text style={[styles.artist, arabic && styles.arabicText]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{artist}</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${playing ? tr('Pause', 'Pause', 'إيقاف مؤقت') : tr('Play', 'Lire', 'تشغيل')}: ${release.title}`}
              onPress={onPlay}
              style={({ pressed }) => [styles.play, pressed && styles.pressed]}
            >
              {loading ? <ActivityIndicator size="small" color={COLORS.greenDeep} style={styles.playSpinner} /> : <Icon name={playing ? 'pause' : 'play'} size={16} color={COLORS.greenDeep} />}
              <Text style={[styles.playText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{playing ? tr('Pause', 'Pause', 'إيقاف') : tr('Play', 'Lire', 'تشغيل')}</Text>
            </Pressable>
            {onToggleLike ? (
              <Pressable
                accessibilityRole="button"
                aria-selected={liked}
                accessibilityLabel={liked ? tr('Unlike release', 'Retirer des favoris', 'إزالة الإعجاب') : tr('Like release', 'Ajouter aux favoris', 'إعجاب')}
                disabled={likeBusy}
                onPress={onToggleLike}
                style={({ pressed }) => [styles.like, pressed && styles.pressed]}
              >
                {likeBusy ? <ActivityIndicator size="small" color={COLORS.white} /> : <Icon name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? COLORS.gold : COLORS.white} />}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The spinner in the play icon's own 16pt box, so the label beside it never moves.
  playSpinner: { width: 16, height: 16, transform: [{ scale: 0.8 }] },
  card: { backgroundColor: COLORS.surface, borderRadius: 24, overflow: 'hidden' },
  // The cover, blurred, bleeding past the card's edges so the blur has no hard rim.
  wash: { bottom: -40, left: -40, opacity: 0.75, position: 'absolute', right: -40, top: -40 },
  inner: { alignItems: 'center', flexDirection: 'row', gap: 16, padding: 16 },
  art: { borderRadius: 16, boxShadow: '0px 14px 30px rgba(0, 0, 0, 0.55)' },
  pressed: { opacity: 0.8 },
  text: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  artist: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 14, marginTop: 5 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 14 },
  play: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, flexDirection: 'row', gap: 6, height: 38, paddingLeft: 13, paddingRight: 16 },
  playText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  like: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.13)', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  // Left-aligned as in every language, but in the direction of its own words: a Latin title reads from its start and is cut at its end.
  arabicText: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
