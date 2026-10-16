'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import FillSvg from '../ui/FillSvg';

import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import { CrownOrnament, VineDivider } from '@/components/vine/ui/Ornaments';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { SERVICES_BY_CATEGORY } from '@/constants/manifest';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { homeService, type HomeSynaxariumEvent } from '@/services/homeService';
import { getCopticDate, type CopticDate } from '@/utils/calendarService';
import { useIsCompactLandscape } from '../../../utils/useIsCompactLandscape';
import { useSidePadding } from '../../../utils/useSidePadding';
import { localDateAtUtcMidnight } from '@/utils/dateUtils';
import { formatCopticDayMonth, formatDayMonthDate } from '@/utils/localeFormat';
import { agpeyaHourAt } from '@/utils/agpeyaHours';
import { LECTIONARY_ROUTE_IDS, LECTIONARY_SERVICES, lectionaryHref, readingLinesFor, withPropheciesAsOneLine } from '@/utils/lectionaryOutline';
import { getServiceReadingCitations, type LectionaryService, type ReadingCitation } from '@/utils/readingsService';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { appText, entryLabel, tr } from '../../../utils/appText';

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The service whose readings are being prayed at this hour, and so the one
 * the readings card opens on: Vespers in the evening, Matins early in the
 * morning, otherwise the Liturgy.
 */
export function readingsServiceAt(hours: number): LectionaryService {
  if (hours >= 17) return 'Vespers';
  if (hours < 9) return 'Matins';
  return 'Liturgy';
}

/**
 * "The Departure of Pope Athanasius the Second, the Twenty-Eighth Patriarch…"
 * reads as the saint, then who he was: the design sets the second part on its
 * own line, smaller. Only an English title with such a clause is split.
 */
function splitSaintTitle(title: string): { main: string; detail: string | null } {
  const match = /^(.+?), the (.+)$/.exec(title);
  if (!match) return { main: title, detail: null };
  return { main: match[1], detail: match[2].charAt(0).toUpperCase() + match[2].slice(1) };
}

/**
 * Home (Coptic Vine design system, "HomeHero"): the seal on a green glow with
 * the day beneath it, the Agpeya hour to pray now,
 * then two framed cards under a gold crown — the day's readings, one service
 * at a time, and the saints of today and tomorrow. Home always shows the
 * live day, whatever date the Books screen has been moved to.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const { preferences } = useReadingPreferences();
  const [now, setNow] = useState(() => new Date());
  const arabic = preferences.appLanguage === 'ar';

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Stable within a day, so the cards don't re-query every minute the clock ticks.
  const liveIso = isoDate(localDateAtUtcMidnight(now));
  const liveDate = useMemo(() => new Date(`${liveIso}T00:00:00Z`), [liveIso]);
  const livePeriod = now.getHours() >= 17 ? 'evening' as const : 'morning' as const;
  const tomorrow = useMemo(() => addUtcDays(liveDate, 1), [liveDate]);
  const tomorrowIso = isoDate(tomorrow);
  const hour = agpeyaHourAt(now.getHours());
  // The readings are the rite's: from the evening, the next morning's.
  const readingsDate = livePeriod === 'evening' ? tomorrow : liveDate;
  const readingsIso = isoDate(readingsDate);

  // Today's and tomorrow's Coptic dates, by their Gregorian day.
  const [coptic, setCoptic] = useState<Record<string, CopticDate>>({});
  const [readingsService, setReadingsService] = useState<LectionaryService>(() => readingsServiceAt(new Date().getHours()));
  const [synaxDay, setSynaxDay] = useState<'today' | 'tomorrow'>('today');
  const [todayEvents, setTodayEvents] = useState<HomeSynaxariumEvent[]>([]);
  const [tomorrowEvents, setTomorrowEvents] = useState<HomeSynaxariumEvent[]>([]);
  const [synaxLoading, setSynaxLoading] = useState(true);
  // Each service's readings, kept with the day they were read for; null
  // citations mean the day's could not be loaded (the outline still shows).
  const [readings, setReadings] = useState<{ key: string; citations: Record<LectionaryService, ReadingCitation[]> | null } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getCopticDate(liveDate), getCopticDate(tomorrow)]).then(([today, next]) => {
      if (!active) return;
      const dates: Record<string, CopticDate> = {};
      if (today) dates[liveIso] = today;
      if (next) dates[tomorrowIso] = next;
      setCoptic(dates);
    });
    return () => { active = false; };
  }, [liveDate, liveIso, tomorrow, tomorrowIso]);

  useEffect(() => {
    let active = true;
    getServiceReadingCitations(readingsDate)
      .then((citations) => { if (active) setReadings({ key: readingsIso, citations }); })
      .catch(() => { if (active) setReadings({ key: readingsIso, citations: null }); });
    return () => { active = false; };
  }, [readingsDate, readingsIso]);

  useEffect(() => {
    let active = true;
    setSynaxLoading(true);
    Promise.all([homeService.getSynaxariumEvents(liveIso), homeService.getSynaxariumEvents(tomorrowIso)])
      .then(([today, next]) => {
        if (!active) return;
        setTodayEvents(today);
        setTomorrowEvents(next);
      })
      .catch(() => {
        if (!active) return;
        setTodayEvents([]);
        setTomorrowEvents([]);
      })
      .finally(() => { if (active) setSynaxLoading(false); });
    return () => { active = false; };
  }, [liveIso, tomorrowIso]);

  const events = synaxDay === 'today' ? todayEvents : tomorrowEvents;
  const synaxDate = synaxDay === 'today' ? liveDate : tomorrow;
  const dayReadings = readings?.key === readingsIso ? readings : null;
  const readingsTitle = livePeriod === 'evening'
    ? tr('Tomorrow’s Readings', 'Lectures de demain', 'قراءات الغد')
    : tr('Today’s Readings', 'Lectures du jour', 'قراءات اليوم');
  // Each service's readings as the Lectionary lists them, a Lenten Matins'
  // several prophecies on one line here. Still loading shows an ellipsis; a
  // day whose readings could not be loaded, a dash.
  const serviceReadings = LECTIONARY_SERVICES.map((service) => {
    const entry = SERVICES_BY_CATEGORY.lectionary.find((candidate) => candidate.id === LECTIONARY_ROUTE_IDS[service]);
    return {
      service,
      title: entry ? entryLabel(entry) : service,
      lines: withPropheciesAsOneLine(readingLinesFor(service, dayReadings?.citations?.[service], arabic))
        .map((line) => ({ ...line, label: appText(line.label), value: line.value ?? (dayReadings ? null : '…') })),
    };
  });
  const shownReadings = serviceReadings.find((entry) => entry.service === readingsService) ?? serviceReadings[0];
  // "CATHOLIQUE", "ÉVANGILE" and "PROPHECIES" run wider than the English kinds; the column makes room for them.
  const readingKindWidth = serviceReadings.some(({ lines }) => lines.some((line) => line.label.length > 8)) ? 104 : 84;
  // The iPad and the desktop set Home in three columns (Coptic Vine, "Layout and spacing").
  const wideLayout = layout !== 'phone';
  const card = [styles.card, wideLayout && styles.cardWide];

  /** "Wednesday, 30 September · Tout 20" — the Coptic day after the Gregorian, once it is known. */
  const dayLine = (date: Date, copticStyle?: object) => {
    const day = coptic[isoDate(date)];
    return (
      <>
        {formatDayMonthDate(date, arabic)}
        {day ? <Text style={copticStyle}>{` · ${formatCopticDayMonth(day.monthName, day.day, arabic)}`}</Text> : null}
      </>
    );
  };

  const heroBlock = (
    <>
      <View style={[styles.hero, { paddingTop: wideLayout ? 30 : insets.top + 30 }]}>
        <View style={styles.halo}>
          {/* The seal's shadow, cast by a circle the seal's own size behind
              it. On the image itself it was clipped to the image's square
              box on the web, which drew a dark square behind the logo. */}
          <View style={styles.sealShadow} pointerEvents="none" />
          <Image
            accessible
            accessibilityLabel="Coptic Vine"
            source={require('../../../../assets/images/coptic-vine-seal-screen.png')}
            style={styles.logo}
          />
        </View>
        {/* No tagline under the seal, though the boards draw "Pray. Read. Learn.": it was taken off on purpose. */}
        <Text style={[styles.heroDate, arabic && styles.arabicCentered]} maxFontSizeMultiplier={1.3}>
          {dayLine(liveDate, styles.heroCoptic)}
        </Text>
      </View>

      <View style={styles.heroDivider} pointerEvents="none">
        <VineDivider width={250} height={32} />
      </View>
    </>
  );
  const prayCard = (
    <>
      <View style={[card, styles.pray]}>
        <View style={styles.flex}>
          <Text style={[styles.prayKicker, arabic && styles.arabic]}>{tr('Pray now · Agpeya', 'Prier maintenant · Agpia', 'صلِّ الآن · الأجبية')}</Text>
          <Text style={[styles.prayTitle, arabic && styles.arabic]} numberOfLines={2}>{tr(hour.prayer.english, hour.prayer.french, hour.prayer.arabic)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr('Pray', 'Prier', 'صلِّ')}: ${tr(hour.prayer.english, hour.prayer.french, hour.prayer.arabic)}`}
          onPress={() => router.push(`/agpeya/${hour.id}` as never)}
          style={({ pressed }) => [styles.prayButton, pressed && styles.pressed]}
        >
          <Icon name="play" size={16} color={COLORS.greenDeep} />
          <Text style={[styles.prayButtonText, arabic && styles.arabicTight]}>{tr('Pray', 'Prier', 'صلِّ')}</Text>
        </Pressable>
      </View>
    </>
  );

  /** The crown and gradient both framed cards share. */
  const frame = (
    <>
      <LinearGradient colors={['#173A1F', COLORS.greenDeep]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Crown wide={wideLayout} />
    </>
  );
  /** A pill of options across a framed card: the services, today and tomorrow. */
  const segment = <T extends string>(options: { key: T; label: string }[], selected: T, onSelect: (key: T) => void) => (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = selected === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.key)}
            style={[styles.segmentOption, active && styles.segmentOptionActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive, arabic && styles.arabicTight]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // The card's head opens the Lectionary; each reading opens its service at
  // that reading (lectionaryHref).
  const readingsCard = (
    <View style={card}>
      {frame}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${readingsTitle}. ${tr('Open the Lectionary', 'Ouvrir le lectionnaire', 'افتح القطمارس')}`}
        onPress={() => router.push('/lectionary' as never)}
        style={({ pressed }) => [styles.framedHead, pressed && styles.pressed]}
      >
        <Text style={[styles.framedKicker, arabic && styles.arabicTight]}>{tr('Lectionary', 'Lectionnaire', 'القطمارس')}</Text>
        <Text style={[styles.framedTitle, arabic && styles.arabicCentered]}>{readingsTitle}</Text>
        <Text style={[styles.framedDate, arabic && styles.arabicCentered]}>{dayLine(readingsDate)}</Text>
      </Pressable>
      <View style={styles.segmentRow}>
        {segment(serviceReadings.map(({ service, title }) => ({ key: service, label: title })), shownReadings.service, setReadingsService)}
      </View>
      <View style={styles.readingRows}>
        {shownReadings.lines.map((line, index) => (
          <Pressable
            key={line.key}
            accessibilityRole="button"
            accessibilityLabel={`${shownReadings.title}: ${line.label}${line.value ? `, ${line.value}` : ''}`}
            onPress={() => router.push(lectionaryHref(shownReadings.service, line) as never)}
            style={({ pressed }) => [styles.readingRow, index === 0 && styles.readingRowFirst, pressed && styles.pressed]}
          >
            <Text style={[styles.readingKind, { width: readingKindWidth }, arabic && styles.readingKindArabic]} numberOfLines={1}>{arabic ? line.label : line.label.toUpperCase()}</Text>
            <Text style={[styles.readingValue, !line.value && styles.readingMissing, arabic && styles.arabic]}>{line.value ?? '—'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const synaxCard = (
    <View style={card}>
      {frame}
      <View style={styles.framedHead}>
        <Text style={[styles.framedKicker, arabic && styles.arabicTight]}>{tr('Synaxarium', 'Synaxaire', 'السنكسار')}</Text>
        <Text style={[styles.framedTitle, arabic && styles.arabicCentered]} accessibilityRole="header">{tr('Saints Commemorated', 'Saints commémorés', 'تذكارات القديسين')}</Text>
        <Text style={[styles.framedDate, arabic && styles.arabicCentered]}>{dayLine(synaxDate)}</Text>
      </View>
      <View style={styles.segmentRow}>
        {segment(
          [
            { key: 'today' as const, label: tr('Today', 'Aujourd’hui', 'اليوم') },
            { key: 'tomorrow' as const, label: tr('Tomorrow', 'Demain', 'غدًا') },
          ],
          synaxDay,
          setSynaxDay,
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Search the Synaxarium', 'Rechercher dans le Synaxaire', 'ابحث في السنكسار')}
          onPress={() => router.push('/synaxarium')}
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
        >
          <Icon name="search-outline" size={20} color={COLORS.gold} />
        </Pressable>
      </View>

      <View style={styles.saints}>
        {synaxLoading ? (
          <Text style={[styles.empty, arabic && styles.arabic]}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
        ) : events.length ? (
          events.map((event, index) => {
            const title = arabic ? event.titleArabic || event.titleEnglish || '' : event.titleEnglish || event.titleArabic || '';
            const { main, detail } = arabic || preferences.appLanguage === 'fr' ? { main: title, detail: null } : splitSaintTitle(title);
            return (
              <View key={event.entryKey} style={[styles.saint, index === events.length - 1 && styles.saintLast]}>
                <View style={styles.saintDot} />
                <View style={styles.flex}>
                  <Text style={[styles.saintName, arabic && styles.arabic]}>{main}</Text>
                  {detail ? <Text style={styles.saintDetail}>{detail}</Text> : null}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={[styles.empty, arabic && styles.arabic]}>{tr('No saints listed.', 'Aucun saint indiqué.', 'لا توجد تذكارات مدرجة.')}</Text>
        )}
      </View>
    </View>
  );

  // The page runs to both edges; its content keeps clear of the notch.
  const sidePadding = useSidePadding(wideLayout ? 36 : 0);
  // Three columns want 1000pt: a phone on its side and an upright iPad set
  // the readings over the Synaxarium beside the seal instead.
  const contentWidth = useContentWidth();
  const twoColumns = useIsCompactLandscape() || contentWidth < 1000;

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head>
        <title>{tr('Coptic Vine', 'Coptic Vine', 'كوبتك فاين')}</title>
      </Head>

      <NowPlayingAwareScrollView
        // Keyed by layout: a turn of the phone mounts the page afresh rather than
        // restyling its views in place, which iOS laid out wrongly (a column of zero width).
        key={`${layout}-${twoColumns}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, wideLayout && [styles.contentWide, { paddingTop: insets.top + 28 }], sidePadding]}
      >
        <HeroGlow />
        {wideLayout && twoColumns ? (
          // Too narrow for three columns: the seal and the prayer beside the
          // readings and the Synaxarium.
          <View style={styles.columns}>
            <View style={styles.columnNarrow}>
              {heroBlock}
              {prayCard}
            </View>
            <View style={[styles.columnWide, styles.stack]}>
              {readingsCard}
              {synaxCard}
            </View>
          </View>
        ) : wideLayout ? (
          // iPad and desktop: the seal and the prayer, the readings, the Synaxarium.
          <View style={styles.columns}>
            <View style={styles.columnNarrow}>
              {heroBlock}
              {prayCard}
            </View>
            <View style={styles.columnWide}>{readingsCard}</View>
            <View style={styles.columnWide}>{synaxCard}</View>
          </View>
        ) : (
          <View style={styles.column}>
            {heroBlock}
            {prayCard}
            {readingsCard}
            {synaxCard}
          </View>
        )}
      </NowPlayingAwareScrollView>

      <BottomTabBar active="home" />
    </SafeAreaView>
  );
}

/** The crown's own proportions, 300 by 58. */
const CROWN_ASPECT = 58 / 300;
/** On the iPad and desktop the crown keeps this width, centred on the wider card. */
const WIDE_CROWN_WIDTH = 340;

/**
 * The vine crown over a framed card. On a phone it spans the card, 8pt in
 * from either side, its tendrils falling beside the kicker; wider cards keep
 * it at 340pt in the middle.
 */
function Crown({ wide }: { wide: boolean }) {
  const [width, setWidth] = useState(0);
  const crownWidth = wide ? WIDE_CROWN_WIDTH : width;
  return (
    <View style={styles.crown} pointerEvents="none" onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      {crownWidth > 0 ? <CrownOrnament width={crownWidth} height={Math.round(crownWidth * CROWN_ASPECT)} /> : null}
    </View>
  );
}

/** The green glow behind the seal: a radial light over a green-to-black fall. */
function HeroGlow() {
  return (
    <View style={styles.glow} pointerEvents="none">
      <LinearGradient colors={[COLORS.greenMid, COLORS.greenDeep, '#000000']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <FillSvg>
        <Defs>
          <RadialGradient id="homeGlow" cx="50%" cy="18%" rx="120%" ry="75%" fx="50%" fy="18%">
            <Stop offset="0" stopColor="#346E3A" stopOpacity="0.85" />
            <Stop offset="0.28" stopColor="#224C28" stopOpacity="0.7" />
            <Stop offset="0.55" stopColor="#14301B" stopOpacity="0.45" />
            <Stop offset="0.85" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeGlow)" />
      </FillSvg>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  column: { alignSelf: 'center', maxWidth: 640, width: '100%' },
  contentWide: { paddingHorizontal: 36 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28 },
  // The seal's column a little narrower than the two cards' (0.9 : 1 : 1).
  columnNarrow: { flex: 0.9, minWidth: 0 },
  columnWide: { flex: 1, minWidth: 0 },
  stack: { gap: 28 },
  cardWide: { marginHorizontal: 0 },
  flex: { flex: 1, minWidth: 0 },
  glow: { height: 560, left: 0, position: 'absolute', right: 0, top: 0 },
  hero: { alignItems: 'center', paddingHorizontal: 24 },
  halo: { alignItems: 'center', height: 212, justifyContent: 'center', width: 212 },
  logo: { height: 188, resizeMode: 'contain', width: 188 },
  // The seal fills 184 of its 188 points inside a gold rim; the shadow circle
  // hides behind it, in the seal's own deep green.
  sealShadow: {
    backgroundColor: '#14301A',
    borderRadius: 92,
    boxShadow: '0px 16px 30px rgba(0, 0, 0, 0.55)',
    height: 184,
    position: 'absolute',
    width: 184,
  },
  heroDate: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, marginTop: 24, textAlign: 'center' },
  heroCoptic: { color: COLORS.goldBright, fontWeight: '600' },
  heroDivider: { alignItems: 'center', marginBottom: 22, marginTop: 20 },
  // No outlines on the cards: depth comes from their fills (Coptic Vine design,
  // "no line"). The design's hairline is only made transparent, so its 1pt stays.
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginBottom: 14,
    marginHorizontal: 16,
    overflow: 'hidden',
    padding: 1,
  },
  pray: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingBottom: 15, paddingLeft: 19, paddingRight: 15, paddingTop: 15 },
  prayKicker: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12 },
  prayTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700', marginTop: 2 },
  prayButton: {
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  prayButtonText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.title, fontSize: 15, fontWeight: '700' },

  // The framed cards: under the vine crown, their head centred.
  crown: { alignItems: 'center', left: 8, opacity: 0.85, position: 'absolute', right: 8, top: 8 },
  framedHead: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 44 },
  framedKicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 1.7, textAlign: 'center', textTransform: 'uppercase' },
  framedTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 25, fontWeight: '700', lineHeight: 30, marginTop: 10, textAlign: 'center' },
  framedDate: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 6, textAlign: 'center' },
  segmentRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 6, marginHorizontal: 18, marginTop: 16 },
  segment: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.border,
    borderRadius: 99,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  segmentOption: { alignItems: 'center', borderRadius: 99, flex: 1, paddingHorizontal: 6, paddingVertical: 8 },
  segmentOptionActive: { backgroundColor: COLORS.gold },
  segmentText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: COLORS.greenDeep },
  roundButton: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },

  readingRows: { paddingBottom: 12, paddingHorizontal: 18, paddingTop: 2 },
  readingRow: { alignItems: 'baseline', borderTopColor: 'rgba(255, 255, 255, 0.07)', borderTopWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 9 },
  readingRowFirst: { borderTopWidth: 0 },
  readingKind: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.7 },
  readingKindArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'left', writingDirection: 'rtl' },
  readingValue: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  readingMissing: { color: 'rgba(255, 255, 255, 0.35)' },

  saints: { paddingBottom: 12, paddingHorizontal: 18, paddingTop: 2 },
  saint: { borderBottomColor: 'rgba(255, 255, 255, 0.07)', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 13 },
  saintLast: { borderBottomWidth: 0 },
  saintDot: { backgroundColor: COLORS.gold, borderRadius: 3, height: 6, marginTop: 8, width: 6 },
  saintName: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, lineHeight: 22 },
  saintDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 2 },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, paddingVertical: 13 },
  pressed: { opacity: 0.7 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
