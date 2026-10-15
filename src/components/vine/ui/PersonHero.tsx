import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import Icon from './Icon';
import { personInitial } from './PersonMedallion';

const MAX_FONT_SCALE = 1.3;
/** The iPad's and desktop's page margin: the hero sets its own, so its glow can run to the page's edges. */
const WIDE_MARGIN = 36;

interface PersonHeroProps {
  name: string;
  /** The small gold line over the name: "Artist", "Cantor". */
  kicker: string;
  imageUri: string | null;
  bio?: string | null;
  /** A smaller photo and name (the cantor). */
  compact?: boolean;
  arabic?: boolean;
  /** On the iPad and desktop the photo sits beside the name instead of over it, both larger. */
  wide?: boolean;
  onBack: () => void;
  backLabel: string;
  /** Under the name: the follow and share buttons, the links. */
  children?: ReactNode;
}

/**
 * The head of an artist's or cantor's page (Coptic Vine design, "Artist" and
 * "Cantor"): their photo glowing out of the page's top, a round back button
 * over it, then the photo itself, the kicker, their name and a short bio.
 */
export default function PersonHero({ name, kicker, imageUri, bio, compact = false, arabic = false, wide = false, onBack, backLabel, children }: PersonHeroProps) {
  const insets = useSafeAreaInsets();
  // The artist's photo and name are the larger: 136 and 29 on a phone, 210 and 44 beside each other; the cantor's 104 and 26, 150 and 40.
  const photoSize = wide ? (compact ? 150 : 210) : compact ? 104 : 136;
  const alignText = wide ? styles.textStart : styles.textCenter;

  return (
    <View>
      <View style={[styles.glow, wide && styles.glowWide]} pointerEvents="none">
        {imageUri ? (
          <Image source={{ uri: imageUri }} contentFit="cover" blurRadius={42} style={styles.glowImage} />
        ) : (
          <LinearGradient colors={[COLORS.greenMid, COLORS.greenDeep]} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={['rgba(0, 0, 0, 0.05)', 'rgba(0, 0, 0, 0.45)', '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      </View>

      <View style={[styles.bar, { paddingTop: insets.top + (wide ? 28 : 2) }, wide && styles.barWide]}>
        <Pressable accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={6} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="chevron-back" size={20} color={COLORS.gold} />
        </Pressable>
      </View>

      <View style={[styles.head, wide && styles.headWide]}>
        <View style={[styles.photo, { borderRadius: photoSize / 2, height: photoSize, width: photoSize }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} />
          ) : (
            <>
              <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={[styles.initial, { fontSize: Math.round(photoSize * 0.4) }]} maxFontSizeMultiplier={1}>{personInitial(name)}</Text>
            </>
          )}
        </View>
        <View style={[styles.text, wide && styles.textWide]}>
          <Text style={[styles.kicker, compact && styles.kickerCompact, wide && styles.kickerWide, alignText, arabic && styles.arabicKicker]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {arabic ? kicker : kicker.toUpperCase()}
          </Text>
          <Text style={[styles.name, compact && styles.nameCompact, wide && (compact ? styles.nameWideCompact : styles.nameWide), alignText, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {name}
          </Text>
          {bio ? (
            <Text style={[styles.bio, wide && styles.bioWide, alignText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {bio}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { height: 500, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  glowWide: { height: 520 },
  // The photo, blurred, bleeding past the edges so the blur has no hard rim.
  glowImage: { bottom: -60, left: -60, opacity: 0.62, position: 'absolute', right: -60, top: -60 },
  bar: { flexDirection: 'row', paddingHorizontal: 16 },
  barWide: { marginBottom: 10, paddingHorizontal: WIDE_MARGIN },
  back: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.32)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  pressed: { opacity: 0.7 },
  head: { alignItems: 'center', paddingHorizontal: 20 },
  headWide: { alignItems: 'center', flexDirection: 'row', gap: 36, paddingHorizontal: WIDE_MARGIN, paddingTop: 6 },
  photo: { alignItems: 'center', backgroundColor: COLORS.greenDeep, boxShadow: '0px 18px 40px rgba(0, 0, 0, 0.55)', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontWeight: '700' },
  text: { alignItems: 'center', alignSelf: 'stretch' },
  // Beside the photo the words sit level with its middle, whichever is the taller.
  textWide: { alignItems: 'flex-start', alignSelf: 'center', flex: 1, minWidth: 0 },
  textCenter: { textAlign: 'center' },
  textStart: { textAlign: 'left' },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8, marginTop: 18 },
  kickerCompact: { marginTop: 14 },
  kickerWide: { marginTop: 0 },
  arabicKicker: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0 },
  name: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 29, fontWeight: '700', lineHeight: 34, marginTop: 6 },
  nameCompact: { fontSize: 26, lineHeight: 30 },
  nameWide: { fontSize: 44, lineHeight: 50 },
  nameWideCompact: { fontSize: 40, lineHeight: 46 },
  bio: { color: '#E2E9DF', fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 560 },
  bioWide: { fontSize: 15, lineHeight: 22.5 },
  // A name or bio keeps the direction of its own words: a Latin one, read in Arabic, ends with its own full stop.
  arabic: { fontFamily: TYPOGRAPHY.arabic },
});
