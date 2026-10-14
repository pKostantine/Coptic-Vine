'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import { CrownOrnament, VineDivider } from '@/components/vine/ui/Ornaments';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { SERVICES_BY_CATEGORY } from '@/constants/manifest';
import { getSeasonIndicatorFullName } from '@/constants/seasonNames';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { homeService, type HomeSynaxariumEvent } from '@/services/homeService';
import { getCopticDate, getDayOverview, type CopticDate } from '@/utils/calendarService';
import { localDateAtUtcMidnight } from '@/utils/dateUtils';
import { formatCopticDayMonth, formatDayMonthDate } from '@/utils/localeFormat';
import { agpeyaHourAt } from '@/utils/agpeyaHours';
import { LECTIONARY_ROUTE_IDS, LECTIONARY_SERVICES, lectionaryHref, readingLinesFor, withPropheciesAsOneLine } from '@/utils/lectionaryOutline';
import { getServiceReadingCitations, getSundayMessageForDate, type LectionaryService, type ReadingCitation } from '@/utils/readingsService';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { appText, entryLabel, tr } from '../../../utils/appText';

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** This Sunday's message on a Sunday morning and from Saturday evening; otherwise last Sunday's. */
function sundayForHome(rawDate: Date, period: 'morning' | 'evening') {
  const weekday = rawDate.getUTCDay();
  if (weekday === 6 && period === 'evening') return { date: addUtcDays(rawDate, 1), relation: 'this' as const };
  if (weekday === 0) return { date: rawDate, relation: period === 'morning' ? 'this' as const : 'last' as const };
  return { date: addUtcDays(rawDate, -weekday), relation: 'last' as const };
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
 * Home (Coptic Vine design system, "HomeHero"): the seal on a green glow with the day beneath it,
 * the Agpeya hour to pray now, the Sunday message under a gold crown, and the
 * saints of today and tomorrow. Home always shows the live day, whatever date
 * the Books screen has been moved to.
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
  const sunday = useMemo(() => sundayForHome(liveDate, livePeriod), [liveDate, livePeriod]);
  const sundayIso = isoDate(sunday.date);
  const tomorrow = useMemo(() => addUtcDays(liveDate, 1), [liveDate]);
  const hour = agpeyaHourAt(now.getHours());
  // The readings are the rite's: from the evening, the next morning's.
  const readingsDate = livePeriod === 'evening' ? tomorrow : liveDate;
  const readingsIso = isoDate(readingsDate);

  const [coptic, setCoptic] = useState<CopticDate | null>(null);
  const [sundayMessage, setSundayMessage] = useState<string | null>(null);
  const [sundayName, setSundayName] = useState<string | null>(null);
  const [sundayLoading, setSundayLoading] = useState(true);
  const [synaxDay, setSynaxDay] = useState<'today' | 'tomorrow'>('today');
  const [todayEvents, setTodayEvents] = useState<HomeSynaxariumEvent[]>([]);
  const [tomorrowEvents, setTomorrowEvents] = useState<HomeSynaxariumEvent[]>([]);
  const [synaxLoading, setSynaxLoading] = useState(true);
  // Each service's readings, kept with the day they were read for; null
  // citations mean the day's could not be loaded (the outline still shows).
  const [readings, setReadings] = useState<{ key: string; citations: Record<LectionaryService, ReadingCitation[]> | null } | null>(null);

  useEffect(() => {
    let active = true;
    void getCopticDate(liveDate).then((value) => { if (active) setCoptic(value); });
    return () => { active = false; };
  }, [liveDate]);

  useEffect(() => {
    let active = true;
    setSundayLoading(true);
    getSundayMessageForDate(sunday.date)
      .then((message) => { if (active) setSundayMessage(message); })
      .catch(() => { if (active) setSundayMessage(null); })
      .finally(() => { if (active) setSundayLoading(false); });
    void getDayOverview(sundayIso).then((overview) => {
      if (active) setSundayName(overview?.indicatorKey ? getSeasonIndicatorFullName(overview.indicatorKey) : null);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the Sunday's date, not the Date instance
  }, [sundayIso]);

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
    Promise.all([homeService.getSynaxariumEvents(liveIso), homeService.getSynaxariumEvents(isoDate(tomorrow))])
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
  }, [liveIso, tomorrow]);

  const sundayTitle = sunday.relation === 'this'
    ? tr("This Sunday's Message", 'Message de ce dimanche', 'رسالة هذا الأحد')
    : tr("Last Sunday's Message", 'Message de dimanche dernier', 'رسالة الأحد الماضي');
  const sundayDate = formatDayMonthDate(sunday.date, arabic);
  const events = synaxDay === 'today' ? todayEvents : tomorrowEvents;
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
  // "CATHOLIQUE", "ÉVANGILE" and "PROPHECIES" run wider than the English kinds; the column makes room for them.
  const readingKindWidth = serviceReadings.some(({ lines }) => lines.some((line) => line.label.length > 8)) ? 100 : 74;
  // The iPad sets Home in two columns, the desktop in three (Coptic Vine, "Layout and spacing").
  const wideLayout = layout !== 'phone';
  const card = [styles.card, wideLayout && styles.cardWide];

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
        <Text style={[styles.heroDate, arabic && styles.arabic]} maxFontSizeMultiplier={1.3}>
          {formatDayMonthDate(liveDate, arabic)}
          {coptic ? <Text style={styles.heroCoptic}>{` · ${formatCopticDayMonth(coptic.monthName, coptic.day, arabic)}`}</Text> : null}
        </Text>
      </View>

      <View style={styles.heroDivider} pointerEvents="none">
        <VineDivider width={250} height={32} />
      </View>
    </>
  );
  const prayCard = (
    <>
      <View style={[card, styles.pray, arabic && styles.rowReverse]}>
        <View style={styles.flex}>
          <Text style={[styles.prayKicker, arabic && styles.arabic]}>{tr('Pray now · Agpeya', 'Prier maintenant · Agpia', 'صلِّ الآن · الأجبية')}</Text>
          <Text style={[styles.prayTitle, arabic && styles.arabic]} numberOfLines={1}>{tr(hour.prayer.english, hour.prayer.french, hour.prayer.arabic)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr('Pray', 'Prier', 'صلِّ')}: ${tr(hour.prayer.english, hour.prayer.french, hour.prayer.arabic)}`}
          onPress={() => router.push(`/agpeya/${hour.id}` as never)}
          style={({ pressed }) => [styles.prayButton, arabic && styles.rowReverse, pressed && styles.pressed]}
        >
          <Icon name="play" size={16} color={COLORS.greenDeep} />
          <Text style={[styles.prayButtonText, arabic && styles.arabicTight]}>{tr('Pray', 'Prier', 'صلِّ')}</Text>
        </Pressable>
      </View>
    </>
  );
  // Each reading opens its service at that reading (lectionaryHref); the
  // service's name opens the service, the card's title the Lectionary.
  const readingsCard = (
    <View style={[card, styles.readings]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${readingsTitle}. ${tr('Open the Lectionary', 'Ouvrir le lectionnaire', 'افتح القطمارس')}`}
        onPress={() => router.push('/lectionary' as never)}
        style={({ pressed }) => [styles.readingsHeader, arabic && styles.rowReverse, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text style={[styles.prayKicker, arabic && styles.arabic]}>{tr('Lectionary', 'Lectionnaire', 'القطمارس')}</Text>
          <Text style={[styles.readingsTitle, arabic && styles.arabic]} numberOfLines={1}>{readingsTitle}</Text>
          <Text style={[styles.readingsDate, arabic && styles.arabic]}>{formatDayMonthDate(readingsDate, arabic)}</Text>
        </View>
        <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.gold} />
      </Pressable>
      {serviceReadings.map(({ service, title, lines }) => (
        <View key={service} style={styles.readingService}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${tr('Open', 'Ouvrir', 'افتح')} ${title}`}
            onPress={() => router.push(lectionaryHref(service) as never)}
            style={({ pressed }) => [styles.readingServiceHeader, arabic && styles.rowReverse, pressed && styles.pressed]}
          >
            <Text style={[styles.readingServiceTitle, arabic && styles.arabic]} numberOfLines={1}>{title}</Text>
            <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={14} color={COLORS.gold} />
          </Pressable>
          {lines.map((line, index) => (
            <Pressable
              key={line.key}
              accessibilityRole="button"
              accessibilityLabel={`${title}: ${line.label}${line.value ? `, ${line.value}` : ''}`}
              onPress={() => router.push(lectionaryHref(service, line) as never)}
              style={({ pressed }) => [styles.readingRow, index === lines.length - 1 && styles.readingRowLast, arabic && styles.rowReverse, pressed && styles.pressed]}
            >
              <Text style={[styles.readingKind, { width: readingKindWidth }, arabic && styles.readingKindArabic]} numberOfLines={1}>{arabic ? line.label : line.label.toUpperCase()}</Text>
              <Text style={[styles.readingValue, !line.value && styles.readingMissing, arabic && styles.arabic]} numberOfLines={1}>{line.value ?? '—'}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
  const messageCard = (
    <>
      <View style={[card, styles.message]}>
        <LinearGradient colors={['#173A1F', COLORS.greenDeep]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.crown} pointerEvents="none">
          <CrownOrnament width={300} height={58} />
        </View>
        <View style={styles.messageBody}>
          <Text style={[styles.messageKicker, arabic && styles.arabicTight]}>{sundayTitle}</Text>
          <Text style={[styles.messageTitle, arabic && styles.arabicCentered]}>{sundayName ?? sundayDate}</Text>
          {sundayName ? <Text style={[styles.messageDate, arabic && styles.arabicCentered]}>{sundayDate}</Text> : null}
          <Text style={[styles.messageText, arabic && styles.arabicCentered]}>
            {sundayLoading
              ? tr('Loading message…', 'Chargement du message…', 'جارٍ تحميل الرسالة…')
              : sundayMessage ?? tr('A message has not been added for this Sunday yet.', 'Aucun message n’a encore été ajouté pour ce dimanche.', 'لم تتم إضافة رسالة لهذا الأحد بعد.')}
          </Text>
        </View>
      </View>
    </>
  );
  const synaxCard = (
    <>
      <View style={card}>
        <View style={[styles.synaxHeader, arabic && styles.rowReverse]}>
          <View style={styles.flex}>
            <Text style={[styles.synaxTitle, arabic && styles.arabic]}>{tr('Synaxarium', 'Synaxaire', 'السنكسار')}</Text>
            <Text style={[styles.synaxSubtitle, arabic && styles.arabic]}>{tr('Saints commemorated', 'Saints commémorés', 'تذكارات القديسين')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Search the Synaxarium', 'Rechercher dans le Synaxaire', 'ابحث في السنكسار')}
            onPress={() => router.push('/synaxarium')}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Icon name="search-outline" size={20} color={COLORS.gold} />
          </Pressable>
        </View>

        <View style={[styles.segment, arabic && styles.rowReverse]}>
          {(['today', 'tomorrow'] as const).map((option) => {
            const active = synaxDay === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSynaxDay(option)}
                style={[styles.segmentOption, active && styles.segmentOptionActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive, arabic && styles.arabicTight]}>
                  {option === 'today' ? tr('Today', 'Aujourd’hui', 'اليوم') : tr('Tomorrow', 'Demain', 'غدًا')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.saints}>
          {synaxLoading ? (
            <Text style={[styles.empty, arabic && styles.arabic]}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
          ) : events.length ? (
            events.map((event, index) => {
              const title = arabic ? event.titleArabic || event.titleEnglish || '' : event.titleEnglish || event.titleArabic || '';
              const { main, detail } = arabic || preferences.appLanguage === 'fr' ? { main: title, detail: null } : splitSaintTitle(title);
              return (
                <View key={event.entryKey} style={[styles.saint, index === events.length - 1 && styles.saintLast, arabic && styles.rowReverse]}>
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
    </>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head>
        <title>{tr('Coptic Vine', 'Coptic Vine', 'كوبتك فاين')}</title>
      </Head>

      <NowPlayingAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, wideLayout && [styles.contentWide, { paddingTop: insets.top + 28 }]]}
      >
        <HeroGlow />
        {layout === 'desktop' ? (
          // Desktop: the seal and the prayer, the message, the Synaxarium.
          <View style={[styles.columns, arabic && styles.rowReverse]}>
            <View style={styles.columnNarrow}>
              {heroBlock}
              {prayCard}
              {readingsCard}
            </View>
            <View style={styles.columnWide}>{messageCard}</View>
            <View style={styles.columnWide}>{synaxCard}</View>
          </View>
        ) : layout === 'tablet' ? (
          // iPad: the seal and the prayer on the left, the message and the Synaxarium on the right.
          <View style={[styles.columns, arabic && styles.rowReverse]}>
            <View style={styles.columnWide}>
              {heroBlock}
              {prayCard}
              {readingsCard}
            </View>
            <View style={styles.columnWide}>
              {messageCard}
              {synaxCard}
            </View>
          </View>
        ) : (
          <View style={styles.column}>
            {heroBlock}
            {prayCard}
            {readingsCard}
            {messageCard}
            {synaxCard}
          </View>
        )}
      </NowPlayingAwareScrollView>

      <BottomTabBar active="home" />
    </SafeAreaView>
  );
}

/** The green glow behind the seal: a radial light over a green-to-black fall. */
function HeroGlow() {
  return (
    <View style={styles.glow} pointerEvents="none">
      <LinearGradient colors={[COLORS.greenMid, COLORS.greenDeep, '#000000']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="homeGlow" cx="50%" cy="18%" rx="120%" ry="75%" fx="50%" fy="18%">
            <Stop offset="0" stopColor="#346E3A" stopOpacity="0.85" />
            <Stop offset="0.28" stopColor="#224C28" stopOpacity="0.7" />
            <Stop offset="0.55" stopColor="#14301B" stopOpacity="0.45" />
            <Stop offset="0.85" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  column: { alignSelf: 'center', maxWidth: 640, width: '100%' },
  contentWide: { paddingHorizontal: 36 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28 },
  columnNarrow: { flex: 0.9, minWidth: 0 },
  columnWide: { flex: 1, minWidth: 0 },
  cardWide: { marginHorizontal: 0 },
  flex: { flex: 1, minWidth: 0 },
  rowReverse: { flexDirection: 'row-reverse' },
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
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  pray: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingBottom: 14, paddingLeft: 18, paddingRight: 14, paddingTop: 14 },
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
  readings: { paddingBottom: 10 },
  readingsHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 4, paddingHorizontal: 18, paddingTop: 14 },
  readingsTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700', marginTop: 2 },
  readingsDate: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 2 },
  readingService: { paddingHorizontal: 18, paddingTop: 8 },
  readingServiceHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingBottom: 2, paddingTop: 4 },
  readingServiceTitle: { color: COLORS.gold, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 14.5, fontWeight: '700' },
  readingRow: { alignItems: 'center', borderBottomColor: 'rgba(255, 255, 255, 0.07)', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 8 },
  readingRowLast: { borderBottomWidth: 0 },
  readingKind: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  readingKindArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
  readingValue: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600' },
  readingMissing: { color: 'rgba(255, 255, 255, 0.35)' },
  message: { borderColor: 'rgba(227, 181, 59, 0.3)' },
  crown: { alignItems: 'center', left: 8, opacity: 0.85, position: 'absolute', right: 8, top: 8 },
  messageBody: { alignItems: 'center', paddingBottom: 22, paddingHorizontal: 22, paddingTop: 44 },
  messageKicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 1.7, textAlign: 'center', textTransform: 'uppercase' },
  messageTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 25, fontWeight: '700', lineHeight: 30, marginTop: 10, textAlign: 'center' },
  messageDate: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 6, textAlign: 'center' },
  messageText: { color: '#DFE6EC', fontFamily: TYPOGRAPHY.body, fontSize: 15, lineHeight: 24, marginTop: 14, textAlign: 'center' },
  synaxHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingTop: 18 },
  synaxTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700' },
  synaxSubtitle: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 2 },
  roundButton: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  segment: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.border,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 4,
  },
  segmentOption: { alignItems: 'center', borderRadius: 99, flex: 1, paddingVertical: 8 },
  segmentOptionActive: { backgroundColor: COLORS.gold },
  segmentText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: COLORS.greenDeep },
  saints: { paddingBottom: 8, paddingHorizontal: 18, paddingTop: 2 },
  saint: { borderBottomColor: 'rgba(255, 255, 255, 0.07)', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 13 },
  saintLast: { borderBottomWidth: 0 },
  saintDot: { backgroundColor: COLORS.gold, borderRadius: 3, height: 6, marginTop: 8, width: 6 },
  saintName: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, lineHeight: 22 },
  saintDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 2 },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, paddingVertical: 13 },
  pressed: { opacity: 0.7 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
