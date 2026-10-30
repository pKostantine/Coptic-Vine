'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import LearningSeasonTile from '@/components/learning/LearningSeasonTile';
import LearningSectionNav from '@/components/learning/LearningSectionNav';
import { inDaysText, seasonStartText } from '@/components/learning/seasonTimingText';
import { useLearningSeasonSchedule } from '@/components/learning/useLearningSeasonSchedule';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import PersonMedallion from '@/components/vine/ui/PersonMedallion';
import TabHeader from '@/components/vine/ui/TabHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { learningService } from '@/services/learningService';
import type { LearningHomePayload, LearningItemLibraryPayload, LearningSeasonSummary } from '@/types/learningPlatform';
import type { LearningSeasonTiming } from '@/utils/learningSeasonDates';
import { learningSeasonLook } from '@/utils/learningSeasonLook';
import { useSidePadding } from '@/utils/useSidePadding';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

/** The cantors' medallions and the gap between them: a phone's rail, the iPad's and desktop's row. */
const MEDALLION = { phone: { size: 92, gap: 16 }, wide: { size: 140, gap: 28 } };

/**
 * Learn & Study's Discover page (Coptic Vine design, "Learn"): the seasons
 * the Church is in now and the next two to come, by the calendar, then the
 * cantors as medallions; and, for someone part-way through, what they were
 * learning. The iPad and desktop set the five seasons in one row and the
 * cantors in a row of larger medallions; By Cantor's chevron to the full list
 * shows only when the cantors run past the row.
 */
export default function LearningHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const width = useContentWidth();
  const { user } = useAuth();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const wide = layout !== 'phone';
  // Drawn at once from the session's copies when the tab is opened again, while they are read afresh.
  const [home, setHome] = useState<LearningHomePayload | null>(() => learningService.peekHome(locale));
  const [library, setLibrary] = useState<LearningItemLibraryPayload | null>(() => learningService.peekItemLibrary(locale));
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the load below.
  const [attempt, setAttempt] = useState(0);

  // The seasons and cantors show as soon as they come, without waiting for
  // the listener's own My Learning, which only adds Continue Learning below
  // them (and, failing, leaves that out rather than the whole page).
  useEffect(() => {
    let active = true;
    learningService.getHome(locale)
      .then((homePayload) => {
        if (!active) return;
        setError(null);
        setHome(homePayload);
      })
      .catch((cause) => {
        // With the session's copy on screen, a failed refresh leaves it there.
        if (active && !learningService.peekHome(locale)) setError(cause instanceof Error ? cause.message : 'Unable to load Learn & Study.');
      });
    learningService.getItemLibrary(locale)
      .then((libraryPayload) => { if (active) setLibrary(libraryPayload); })
      .catch(() => {});
    return () => { active = false; };
  }, [locale, user?.id, attempt]);

  const continueLearning = library?.items.filter((item) => item.state === 'learning').slice(0, 4) ?? [];
  const gutter = wide ? 0 : 16;
  // The page's content is inset from a phone's notch on its side; the tiles share what is left.
  const available = width - (wide ? 72 : 32) - insets.left - insets.right;
  const slugs = useMemo(() => home?.seasons.map((season) => season.slug) ?? null, [home]);
  const schedule = useLearningSeasonSchedule(slugs);
  const seasonsBySlug = useMemo(() => new Map((home?.seasons ?? []).map((season) => [season.slug, season])), [home]);
  const pick = (picked: string[]) => picked.map((slug) => seasonsBySlug.get(slug)).filter((season): season is LearningSeasonSummary => Boolean(season));
  const nowSeasons = schedule ? pick(schedule.now) : [];
  const comingSeasons = schedule ? pick(schedule.comingUp) : [];
  const medallion = wide ? MEDALLION.wide : MEDALLION.phone;
  const cantorCount = home?.cantors.length ?? 0;
  const cantorsOverflow = cantorCount * medallion.size + Math.max(0, cantorCount - 1) * medallion.gap > available;

  const browseAll = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Icon name="chevron-forward" size={18} color={COLORS.gold} />
    </Pressable>
  );

  // The page runs to both edges; its content keeps clear of the notch.
  const sidePadding = useSidePadding(wide ? 36 : 0);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head>
        <title>{tr('Learn & Study — Coptic Vine', 'Apprendre — Coptic Vine', 'تعلّم وادرس — كوبتك فاين')}</title>
      </Head>

      <NowPlayingAwareScrollView
        // Keyed by layout: a turn of the phone mounts the page afresh rather than
        // restyling its views in place, which iOS laid out wrongly (a column of zero width).
        key={layout}
        contentContainerStyle={[styles.content, wide && [styles.contentWide, { paddingTop: insets.top + 28 }], sidePadding]}
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind="green" tall={wide} />
        <PageGutterProvider gutter={gutter}>
          <TabHeader title={tr('Learn & Study', 'Apprendre', 'تعلّم وادرس')} arabic={arabic} wide={wide} nav={<LearningSectionNav active="home" flush={wide} />} />

          {!home && !error ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
          {error ? (
            <LoadFailure
              error={error}
              layout="inline"
              onRetry={() => {
                setError(null);
                setAttempt((count) => count + 1);
              }}
            />
          ) : null}

          {home ? (
            <>
              <SectionHeading size="page"
                title={tr('Seasons', 'Temps liturgiques', 'المواسم')}
                arabic={arabic}
                trailing={browseAll(tr('All seasons', 'Tous les temps', 'كل المواسم'), () => router.push('/learn/seasons'))}
              />
              {schedule ? (
                <SeasonRows
                  now={nowSeasons}
                  comingUp={comingSeasons}
                  timings={schedule.timings}
                  available={available}
                  gutter={gutter}
                  wide={wide}
                  arabic={arabic}
                  onOpen={(season) => router.push({ pathname: '/learn/season/[id]', params: { id: season.id } })}
                />
              ) : (
                <ActivityIndicator color={COLORS.gold} style={styles.loader} />
              )}

              <SectionHeading size="page"
                title={tr('By Cantor', 'Par chantre', 'حسب المعلّم')}
                arabic={arabic}
                trailing={cantorsOverflow ? browseAll(tr('All cantors', 'Tous les chantres', 'كل المعلّمين'), () => router.push('/learn/cantors')) : undefined}
              />
              {home.cantors.length ? (
                wide ? (
                  <View style={styles.peopleWide}>
                    {home.cantors.map((cantor) => (
                      <PersonMedallion
                        key={cantor.id}
                        name={cantor.displayName}
                        imageUri={learningService.resolveAsset(cantor.profileImageAsset)}
                        size={medallion.size}
                        arabic={arabic}
                        onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: cantor.id } })}
                      />
                    ))}
                  </View>
                ) : (
                  <NowPlayingAwareScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.people, { paddingHorizontal: gutter }]}>
                    {home.cantors.map((cantor) => (
                      <PersonMedallion
                        key={cantor.id}
                        name={cantor.displayName}
                        imageUri={learningService.resolveAsset(cantor.profileImageAsset)}
                        size={medallion.size}
                        arabic={arabic}
                        onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: cantor.id } })}
                      />
                    ))}
                  </NowPlayingAwareScrollView>
                )
              ) : (
                <Text style={[styles.empty, { marginHorizontal: gutter }, arabic && styles.arabic]}>{tr('No cantors yet.', 'Aucun chantre pour l’instant.', 'لا يوجد معلّمون بعد.')}</Text>
              )}

              {continueLearning.length ? (
                <>
                  <SectionHeading size="page"
                    title={tr('Continue Learning', 'Continuer l’apprentissage', 'أكمل التعلّم')}
                    arabic={arabic}
                    trailing={browseAll(tr('Open My Learning', 'Ouvrir Mon apprentissage', 'افتح تعلّمي'), () => router.push('/learn/library'))}
                  />
                  <View style={[styles.continueList, { paddingHorizontal: gutter }]}>
                    {continueLearning.map((item, index) => (
                      <Pressable
                        accessibilityRole="button"
                        key={item.itemKind + ':' + item.itemId}
                        style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
                        onPress={() => item.itemKind === 'lesson'
                          ? router.push({ pathname: '/learn/lesson/[id]', params: { id: item.itemId, setId: item.containerId } })
                          : router.push({ pathname: '/learn/album/[id]', params: { id: item.containerId } })}
                      >
                        <View style={styles.continueNumber}><Text style={styles.continueNumberText}>{index + 1}</Text></View>
                        <View style={styles.continueInfo}>
                          <Text numberOfLines={1} style={[styles.continueTitle, arabic && styles.arabic]}>{item.title}</Text>
                          <Text numberOfLines={1} style={[styles.continueMeta, arabic && styles.arabic]}>
                            {item.subtitle || item.cantorName}
                          </Text>
                        </View>
                        <View style={styles.resume}><Icon name="play" size={14} color={COLORS.greenDeep} /></View>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </PageGutterProvider>
      </NowPlayingAwareScrollView>

      <BottomTabBar active="learn" />
    </SafeAreaView>
  );
}

interface SeasonRowsProps {
  now: LearningSeasonSummary[];
  comingUp: LearningSeasonSummary[];
  timings: ReadonlyMap<string, LearningSeasonTiming>;
  /** The width the tiles share, inside the page's margins. */
  available: number;
  gutter: number;
  wide: boolean;
  arabic: boolean;
  onOpen: (season: LearningSeasonSummary) => void;
}

/**
 * Discover's seasons: Now, the seasons holding the day, then Coming up, the
 * next two with their day count and Coptic start. A phone sets Now's tiles
 * across one row and Coming up's two beneath; the iPad and desktop set all
 * of them in one row, each group under its own label.
 */
function SeasonRows({ now, comingUp, timings, available, gutter, wide, arabic, onOpen }: SeasonRowsProps) {
  const gap = wide ? 14 : 10;
  const groupGap = 16;
  const groups = [now, comingUp].filter((group) => group.length);
  const tileCount = now.length + comingUp.length;
  // The iPad and desktop share one row among every tile; a phone's rows each share theirs.
  const rowTileWidth = (count: number) => Math.floor((available - gap * (count - 1)) / count);
  const wideTileWidth = Math.floor((available - gap * (tileCount - groups.length) - groupGap * (groups.length - 1)) / Math.max(1, tileCount));
  const label = (text: string) => (
    <Text style={[styles.seasonLabel, arabic && styles.seasonLabelArabic]} maxFontSizeMultiplier={1.25}>{arabic ? text : text.toUpperCase()}</Text>
  );
  const group = (title: string, seasons: LearningSeasonSummary[], kind: 'now' | 'upcoming') => {
    const tileWidth = wide ? wideTileWidth : rowTileWidth(seasons.length);
    return (
      <View key={kind} style={[styles.seasonGroup, !wide && { paddingHorizontal: gutter }, wide && { width: tileWidth * seasons.length + gap * (seasons.length - 1) }]}>
        {label(title)}
        <View style={[styles.seasonTiles, { gap }]}>
          {seasons.map((season) => {
            const timing = timings.get(season.slug);
            return (
              <View key={season.id} style={{ width: tileWidth }}>
                <LearningSeasonTile
                  title={season.title}
                  slug={season.slug}
                  look={learningSeasonLook(season)}
                  kind={kind}
                  countdown={kind === 'upcoming' && timing?.next ? inDaysText(timing.next.days, arabic, true) : undefined}
                  detail={kind === 'upcoming' ? seasonStartText(timing, arabic) : undefined}
                  arabic={arabic}
                  large={wide}
                  onPress={() => onOpen(season)}
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  };
  const rendered = [
    now.length ? group(tr('Now', 'Maintenant', 'الآن'), now, 'now') : null,
    comingUp.length ? group(tr('Coming up', 'À venir', 'قريبًا'), comingUp, 'upcoming') : null,
  ];
  return <View style={[styles.seasons, wide && styles.seasonsWide]}>{rendered}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  contentWide: { paddingHorizontal: 36 },
  loader: { marginVertical: 32 },
  pressed: { opacity: 0.7 },
  people: { gap: 16 },
  // The iPad's and desktop's cantors: 140pt medallions, 28pt apart, wrapping when there are many.
  peopleWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  seasons: { gap: 16 },
  seasonsWide: { flexDirection: 'row', gap: 16 },
  seasonGroup: { gap: 8 },
  seasonTiles: { flexDirection: 'row', flexGrow: 1 },
  seasonLabel: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.84 },
  seasonLabelArabic: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0, textAlign: 'left', writingDirection: 'rtl' },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  continueList: { gap: 8 },
  continueCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 66,
    paddingHorizontal: 14,
  },
  continueNumber: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  continueNumberText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 14, fontWeight: '700' },
  continueInfo: { flex: 1, minWidth: 0 },
  continueTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  continueMeta: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 3 },
  resume: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
