'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import SeasonIcon from '@/components/learning/SeasonIcon';
import { seasonCountdownText } from '@/components/learning/seasonTimingText';
import { useLearningSeasonSchedule } from '@/components/learning/useLearningSeasonSchedule';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { learningService } from '@/services/learningService';
import type { LearningSeasonSummary } from '@/types/learningPlatform';
import type { LearningSeasonTiming } from '@/utils/learningSeasonDates';
import { learningSeasonLook } from '@/utils/learningSeasonLook';
import { goBack } from '@/utils/navigation';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

const MAX_FONT_SCALE = 1.3;

/**
 * Every season to learn, in the Church year's fixed order (Coptic Vine
 * design, "Seasons"): each one's icon on a roundel in its colours, Now on
 * the seasons that hold the liturgical day, and each dated season's Coptic
 * start and day count. The order never changes with the date; only the Now
 * chips and the counts do.
 */
export default function LearningSeasonsScreen() {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const wide = useLayoutMode() !== 'phone';
  const [seasons, setSeasons] = useState<LearningSeasonSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the load below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    learningService.getHome(locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setSeasons(payload.seasons);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load seasons.'); });
    return () => { active = false; };
  }, [locale, attempt]);

  const slugs = useMemo(() => seasons?.map((season) => season.slug) ?? null, [seasons]);
  const schedule = useLearningSeasonSchedule(slugs);
  const title = tr('Seasons', 'Temps liturgiques', 'المواسم');

  return (
    <BleedPage background={<PageGlow kind="green" tall={wide} />} footer={<BottomTabBar active="learn" />}>
      <Head><title>{tr('Seasons — Learn & Study', 'Temps liturgiques — Apprendre', 'المواسم — تعلّم وادرس')}</title></Head>
      <SubPageHeader title={title} arabic={arabic} onBack={() => goBack(router, '/learn')} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <Text style={[styles.intro, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr('Follow the Church year and study the hymns that belong to each season.', 'Suivez l’année liturgique et étudiez les hymnes propres à chaque temps.', 'تصفّح الألحان والدروس بحسب الموسم الكنسي.')}
          </Text>
          {error ? (
            <LoadFailure
              error={error}
              layout="inline"
              onRetry={() => {
                setError(null);
                setAttempt((count) => count + 1);
              }}
            />
          ) : !seasons || !schedule ? (
            <ActivityIndicator color={COLORS.gold} style={styles.loader} />
          ) : (
            <View style={styles.list}>
              {seasons.map((season) => (
                <SeasonRow
                  key={season.id}
                  season={season}
                  timing={schedule.timings.get(season.slug)}
                  arabic={arabic}
                  onPress={() => router.push({ pathname: '/learn/season/[id]', params: { id: season.id } })}
                />
              ))}
            </View>
          )}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

function SeasonRow({ season, timing, arabic, onPress }: {
  season: LearningSeasonSummary;
  timing: LearningSeasonTiming | undefined;
  arabic: boolean;
  onPress: () => void;
}) {
  const look = learningSeasonLook(season);
  const countdown = seasonCountdownText(timing, arabic);
  const nowLabel = tr('Now', 'Maintenant', 'الآن');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[season.title, timing?.now ? nowLabel : countdown].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.disc}>
        <LinearGradient colors={[look.from, look.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* In a view of its own: on the web a bare drawing paints beneath the roundel's gradient. */}
        <View>
          <SeasonIcon slug={season.slug} size={24} color={look.light ? COLORS.greenDeep : COLORS.white} />
        </View>
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{season.title}</Text>
        {countdown ? <Text style={[styles.countdown, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{countdown}</Text> : null}
      </View>
      {timing?.now ? (
        <View style={styles.now}>
          <Text style={[styles.nowText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{arabic ? nowLabel : nowLabel.toUpperCase()}</Text>
        </View>
      ) : null}
      {/* In a view of its own: on the web a bare icon paints beneath the card's gradient. */}
      <View>
        <Icon name="chevron-forward" size={18} color={COLORS.gold} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', maxWidth: 640, width: '100%' },
  intro: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20.3, marginBottom: 14 },
  loader: { marginVertical: 32 },
  list: { gap: 8 },
  row: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    overflow: 'hidden',
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 14,
    paddingTop: 12,
  },
  pressed: { opacity: 0.75 },
  disc: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  text: { flex: 1, gap: 4, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700', lineHeight: 20.4 },
  countdown: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13 },
  now: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, height: 22, justifyContent: 'center', paddingHorizontal: 9 },
  nowText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 0.88 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
