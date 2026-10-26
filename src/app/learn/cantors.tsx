'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import { personInitial } from '@/components/vine/ui/PersonMedallion';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { learningService } from '@/services/learningService';
import type { LearningCantorSummary } from '@/types/learningPlatform';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

const MAX_FONT_SCALE = 1.3;
const GRID_GAP = 12;
/** The grid's widest column, centred on the iPad and desktop. */
const MAX_GRID_WIDTH = 880;

/** The name's lines kept even, "Cantor" over "Gad Lewis", as PersonMedallion sets them (iOS has no equivalent). */
const BALANCED_WRAP: TextStyle | null = Platform.OS === 'web' ? ({ textWrap: 'balance' } as unknown as TextStyle) : null;

/** "3 releases", "1 release", "No releases yet"; in Arabic with the noun each count takes. */
function releaseCountText(count: number, arabic: boolean): string {
  if (arabic) {
    if (count === 0) return 'لا إصدارات بعد';
    if (count === 1) return 'إصدار واحد';
    if (count === 2) return 'إصداران';
    return `${toEasternArabicDigits(count)} ${count <= 10 ? 'إصدارات' : 'إصدارًا'}`;
  }
  if (count === 0) return tr('No releases yet', 'Aucune parution', '');
  return count === 1 ? tr('1 release', '1 parution', '') : tr(`${count} releases`, `${count} parutions`, '');
}

/**
 * Every cantor (Coptic Vine design, "Cantors", from By Cantor ›): their
 * portraits in a grid, two across a phone, each with how many albums and
 * lesson sets they have released.
 */
export default function LearningCantorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const wide = useLayoutMode() !== 'phone';
  const width = useContentWidth();
  const [cantors, setCantors] = useState<LearningCantorSummary[] | null>(null);
  // Each cantor's releases, counted from their page as it loads: albums and lesson sets.
  const [releases, setReleases] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the load below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    learningService.getHome(locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setCantors(payload.cantors);
        for (const cantor of payload.cantors) {
          learningService.getCantor(cantor.id, locale)
            .then((detail) => {
              if (active) setReleases((counts) => ({ ...counts, [cantor.id]: detail.albums.length + detail.lessonSets.length }));
            })
            // A count that can't be read is left off; the card still opens the cantor.
            .catch(() => {});
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load cantors.'); });
    return () => { active = false; };
  }, [locale, attempt]);

  const gridWidth = Math.min(MAX_GRID_WIDTH, width - 32 - insets.left - insets.right);
  const columns = wide ? Math.max(2, Math.min(4, Math.floor((gridWidth + GRID_GAP) / (190 + GRID_GAP)))) : 2;
  const cardWidth = Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns);

  return (
    <BleedPage background={<PageGlow kind="green" tall={wide} />} footer={<BottomTabBar active="learn" />}>
      <Head><title>{tr('Cantors — Learn & Study', 'Chantres — Apprendre', 'المعلّمون — تعلّم وادرس')}</title></Head>
      <SubPageHeader title={tr('Cantors', 'Chantres', 'المعلّمون')} arabic={arabic} onBack={() => goBack(router, '/learn')} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.grid, { width: gridWidth }]}>
          {error ? (
            <LoadFailure
              error={error}
              layout="inline"
              onRetry={() => {
                setError(null);
                setAttempt((count) => count + 1);
              }}
            />
          ) : !cantors ? (
            <ActivityIndicator color={COLORS.gold} style={styles.loader} />
          ) : cantors.length ? (
            cantors.map((cantor) => (
              <CantorCard
                key={cantor.id}
                cantor={cantor}
                releases={releases[cantor.id]}
                width={cardWidth}
                arabic={arabic}
                onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: cantor.id } })}
              />
            ))
          ) : (
            <Text style={[styles.empty, arabic && styles.arabic]}>{tr('No cantors yet.', 'Aucun chantre pour l’instant.', 'لا يوجد معلّمون بعد.')}</Text>
          )}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

function CantorCard({ cantor, releases, width, arabic, onPress }: {
  cantor: LearningCantorSummary;
  releases: number | undefined;
  width: number;
  arabic: boolean;
  onPress: () => void;
}) {
  const imageUri = learningService.resolveAsset(cantor.profileImageAsset);
  const count = releases === undefined ? '' : releaseCountText(releases, arabic);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[cantor.displayName, count].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.disc}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} />
        ) : (
          <>
            <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.initial} maxFontSizeMultiplier={1}>{personInitial(cantor.displayName)}</Text>
          </>
        )}
      </View>
      <Text style={[styles.name, BALANCED_WRAP, arabic && styles.arabicCentered]} numberOfLines={3} textBreakStrategy="balanced" maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {cantor.displayName}
      </Text>
      <Text style={[styles.count, arabic && styles.arabicCentered]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingBottom: 32, paddingTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  loader: { marginVertical: 32, width: '100%' },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  card: { alignItems: 'center', borderRadius: 22, overflow: 'hidden', paddingBottom: 18, paddingHorizontal: 12, paddingTop: 20 },
  pressed: { opacity: 0.75 },
  disc: {
    alignItems: 'center',
    backgroundColor: COLORS.greenDeep,
    borderRadius: 54,
    boxShadow: '0px 8px 18px rgba(0, 0, 0, 0.45)',
    height: 108,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 108,
  },
  initial: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 40, fontWeight: '700' },
  name: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700', lineHeight: 21.25, marginTop: 14, textAlign: 'center' },
  // Kept a line tall while the count loads, so the cards don't shift when it comes.
  count: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 16, marginTop: 4, minHeight: 16, textAlign: 'center' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic },
});
