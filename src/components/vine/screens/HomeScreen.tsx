'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import FillSvg from '../ui/FillSvg';

import { CanonSegments, CanonTimelineRow } from '@/components/canon/CanonParts';
import { dayProgressLabel, paschaAgpeyaNote } from '@/components/canon/canonText';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import { CornerVine, VineDivider, VineRule } from '@/components/vine/ui/Ornaments';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { SERVICES_BY_CATEGORY } from '@/constants/manifest';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useSpiritualCanon } from '@/context/SpiritualCanonContext';
import { useLiturgicalNow } from '@/hooks/useLiturgicalNow';
import { homeService, type HomeSynaxariumEvent } from '@/services/homeService';
import { getCopticDate, type CopticDate } from '@/utils/calendarService';
import { useIsCompactLandscape } from '../../../utils/useIsCompactLandscape';
import { useSidePadding } from '../../../utils/useSidePadding';
import { formatCopticDayMonth, formatCopticYear, formatDayMonthDate, formatMonthDaySpan } from '@/utils/localeFormat';
import { agpeyaHourAt } from '@/utils/agpeyaHours';
import { LECTIONARY_ROUTE_IDS, LECTIONARY_SERVICES, lectionaryHref, readingLinesFor, withPropheciesAsOneLine } from '@/utils/lectionaryOutline';
import { readingsServiceAt } from '@/utils/liturgicalDay';
import { getServiceReadingCitations, type LectionaryService, type ReadingCitation } from '@/utils/readingsService';
import { canonDayProgress, canonTaskRoute } from '@/utils/spiritualCanon';
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
 * "The Departure of Pope Athanasius the Second, the Twenty-Eighth Patriarch…"
 * reads as the saint, then who he was: the design sets the second part on its
 * own line, smaller. Only an English title with such a clause is split.
 */
function splitSaintTitle(title: string): { main: string; detail: string | null } {
  const match = /^(.+?), the (.+)$/.exec(title);
  if (!match) return { main: title, detail: null };
  return { main: match[1], detail: match[2].charAt(0).toUpperCase() + match[2].slice(1) };
}

/** How Home is laid out (Coptic Vine design, "Home v2"). */
type HomeLayout =
  /** A phone held upright: one column, scrolled. */
  | 'column'
  /** A phone on its side: the seal and Pray now stay put on the left, the cards scroll on the right. */
  | 'landscape'
  /** An upright iPad, or a narrow desktop window: the seal beside Pray now, then the canon beside the readings and the saints. */
  | 'grid'
  /** An iPad on its side, or the desktop: the seal and Pray now · the canon · the readings and the saints. */
  | 'columns';

/**
 * Home (Coptic Vine design, "Home v2"): the seal over the day — its Coptic
 * date large, as the Church keeps it, the civil date and the year beneath —
 * then what to pray now, the day's spiritual canon as a timeline, and the
 * day's readings and saints. The Coptic day is the liturgical one, which
 * begins the evening before (utils/liturgicalDay.ts), so from Vespers on
 * Home already shows the next day's date, readings and saints. Home always
 * shows the live day, whatever date the Books screen has been moved to.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layoutMode = useLayoutMode();
  const contentWidth = useContentWidth();
  const compactLandscape = useIsCompactLandscape();
  const { preferences } = useReadingPreferences();
  const canon = useSpiritualCanon();
  const live = useLiturgicalNow();
  const arabic = preferences.appLanguage === 'ar';

  const layout: HomeLayout = compactLandscape
    ? 'landscape'
    : layoutMode === 'phone'
      ? 'column'
      : contentWidth < 1000 ? 'grid' : 'columns';
  const wide = layout === 'grid' || layout === 'columns';

  // The liturgical day, as the Gregorian date it is kept on, and the next.
  const dayIso = live.liturgicalIso;
  const day = useMemo(() => new Date(`${dayIso}T00:00:00Z`), [dayIso]);
  const nextDay = useMemo(() => addUtcDays(day, 1), [day]);
  const nextIso = isoDate(nextDay);
  const hour = agpeyaHourAt(live.now.getHours());

  const [nextCoptic, setNextCoptic] = useState<{ key: string; value: CopticDate | null } | null>(null);
  // A service or day picked on the cards holds for that liturgical day; until then the clock picks.
  const [readingsChoice, setReadingsChoice] = useState<{ key: string; service: LectionaryService } | null>(null);
  const [synaxChoice, setSynaxChoice] = useState<{ key: string; day: 'today' | 'tomorrow' } | null>(null);
  const readingsService = readingsChoice?.key === dayIso ? readingsChoice.service : readingsServiceAt(live.now, live.evening);
  const synaxDay = synaxChoice?.key === dayIso ? synaxChoice.day : 'today';
  const [synax, setSynax] = useState<{ key: string; today: HomeSynaxariumEvent[]; tomorrow: HomeSynaxariumEvent[] } | null>(null);
  // Each service's readings, kept with the day they were read for; null
  // citations mean the day's could not be loaded (the outline still shows).
  const [readings, setReadings] = useState<{ key: string; citations: Record<LectionaryService, ReadingCitation[]> | null } | null>(null);

  useEffect(() => {
    let active = true;
    void getCopticDate(nextDay).then((value) => { if (active) setNextCoptic({ key: nextIso, value }); });
    return () => { active = false; };
  }, [nextDay, nextIso]);

  useEffect(() => {
    let active = true;
    getServiceReadingCitations(day)
      .then((citations) => { if (active) setReadings({ key: dayIso, citations }); })
      .catch(() => { if (active) setReadings({ key: dayIso, citations: null }); });
    return () => { active = false; };
  }, [day, dayIso]);

  useEffect(() => {
    let active = true;
    Promise.all([homeService.getSynaxariumEvents(dayIso), homeService.getSynaxariumEvents(nextIso)])
      .then(([today, tomorrow]) => { if (active) setSynax({ key: dayIso, today, tomorrow }); })
      .catch(() => { if (active) setSynax({ key: dayIso, today: [], tomorrow: [] }); });
    return () => { active = false; };
  }, [dayIso, nextIso]);

  const coptic = live.coptic;
  const tomorrowCoptic = nextCoptic?.key === nextIso ? nextCoptic.value : null;
  /** "Paope 9 · October 18–19": a liturgical day and the evening and the day it spans. */
  const spanLine = (date: Date, copticDay: CopticDate | null) => {
    const span = formatMonthDaySpan(addUtcDays(date, -1), date, arabic);
    return copticDay ? `${formatCopticDayMonth(copticDay.monthName, copticDay.day, arabic)} · ${span}` : span;
  };

  const dayReadings = readings?.key === dayIso ? readings : null;
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

  const synaxLoaded = synax?.key === dayIso;
  const events = synaxLoaded ? (synaxDay === 'today' ? synax.today : synax.tomorrow) : [];
  const synaxDate = synaxDay === 'today' ? day : nextDay;
  const synaxCoptic = synaxDay === 'today' ? coptic : tomorrowCoptic;

  // ── The hero: the seal, the Coptic day, the civil date and the year. ──
  const copticTitle = coptic ? formatCopticDayMonth(coptic.monthName, coptic.day, arabic) : ' ';
  const civilLine = (
    <Text style={[styles.civil, layout === 'landscape' && styles.civilRow, arabic && styles.arabicCentered]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
      {formatDayMonthDate(live.today, arabic)}
      {coptic ? <Text style={styles.civilYear}>{` · ${formatCopticYear(coptic.year, arabic)}`}</Text> : null}
    </Text>
  );
  const seal = (size: number) => (
    <View style={{ height: size, width: size }}>
      {/* The seal's shadow, cast by a circle the seal's own size behind it.
          On the image itself it was clipped to the image's square box on the
          web, which drew a dark square behind the logo. */}
      <View style={[styles.sealShadow, { borderRadius: size / 2, height: size - 4, left: 2, top: 2, width: size - 4 }]} pointerEvents="none" />
      <Image
        accessible
        accessibilityLabel="Coptic Vine"
        source={require('../../../../assets/images/coptic-vine-seal-screen.png')}
        style={{ height: size, resizeMode: 'contain', width: size }}
      />
    </View>
  );
  const hero = layout === 'landscape' ? (
    <View style={styles.heroRow}>
      {seal(66)}
      <View style={styles.flex}>
        <Text style={[styles.copticDay, styles.copticDayRow, arabic && styles.arabic]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{copticTitle}</Text>
        {civilLine}
      </View>
    </View>
  ) : (
    <View style={[styles.hero, { paddingTop: wide ? 6 : insets.top + 24 }]}>
      {seal(layoutMode === 'desktop' ? 230 : wide ? 210 : 184)}
      <Text style={[styles.copticDay, wide && styles.copticDayWide, arabic && styles.arabicCentered]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{copticTitle}</Text>
      {civilLine}
      <View style={styles.heroDivider} pointerEvents="none">
        <VineDivider width={210} height={28} />
      </View>
    </View>
  );

  // ── Pray now: the Agpeya's hour, and the Church's service at this time of day. ──
  const compact = layout === 'landscape';
  const prayRow = (kicker: string, title: string, onPress: (() => void) | null) => (
    <View style={[styles.prayRow, compact && styles.prayRowCompact]}>
      <View style={styles.flex}>
        <Text style={[styles.prayKicker, arabic && styles.arabicTight]} numberOfLines={1}>{kicker}</Text>
        <Text style={[styles.prayTitle, wide && styles.prayTitleWide, compact && styles.prayTitleCompact, arabic && styles.arabic]} numberOfLines={2}>{title}</Text>
      </View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr('Pray', 'Prier', 'صلِّ')}: ${title}`}
          onPress={onPress}
          style={({ pressed }) => [styles.prayButton, compact && styles.prayButtonCompact, pressed && styles.pressed]}
        >
          <Text style={[styles.prayButtonText, compact && styles.prayButtonTextCompact, arabic && styles.arabicTight]}>{tr('Pray', 'Prier', 'صلِّ')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
  const hourName = tr(hour.prayer.english, hour.prayer.french, hour.prayer.arabic);
  const serviceHref = live.service.href;
  const prayCard = (
    <View style={[styles.prayCard, compact && styles.prayCardCompact]}>
      <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} locations={[0, 0.78]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.corner, compact && styles.cornerCompact]} pointerEvents="none">
        <CornerVine width={compact ? 70 : 88} height={compact ? 50 : 62} />
      </View>
      <Text style={[styles.eyebrow, styles.prayEyebrow, arabic && styles.arabicTight]}>{tr('Pray now', 'Prier maintenant', 'صلِّ الآن')}</Text>
      <View style={[styles.prayRows, compact && styles.prayRowsCompact]}>
        {prayRow(tr('Agpeya', 'Agpia', 'الأجبية'), hourName, () => router.push(`/agpeya/${hour.id}` as never))}
        {prayRow(tr('Service', 'Office', 'الخدمة'), live.service.title, serviceHref ? () => router.push(serviceHref as never) : null)}
      </View>
    </View>
  );

  // ── The framed cards: no outlines, depth from their fills (Coptic Vine design, "no line"). ──
  const cardFill = <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />;
  /** A card's head; with `open`, a button into the card's own page, named for where it goes. */
  const cardHead = (eyebrow: string, title: string, sub: ReactNode, action?: ReactNode, open?: { label: string; onPress: () => void }) => {
    const text = (
      <>
        <View style={styles.eyebrowRow}>
          <Text style={[styles.eyebrow, arabic && styles.arabicTight]} numberOfLines={1}>{eyebrow}</Text>
          <VineRule height={16} />
        </View>
        <Text style={[styles.cardTitle, arabic && styles.arabic]} accessibilityRole="header">{title}</Text>
        <Text style={[styles.cardSub, arabic && styles.arabic]}>{sub}</Text>
      </>
    );
    return (
      <View style={styles.cardHead}>
        {open ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${open.label}`} onPress={open.onPress} style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>{text}</Pressable>
        ) : (
          <View style={styles.flex}>{text}</View>
        )}
        {action}
      </View>
    );
  };
  const roundButton = (label: string, icon: 'create-outline' | 'search-outline', onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <Icon name={icon} size={19} color={COLORS.gold} />
    </Pressable>
  );
  /** A pill of options across a card: the services, today and tomorrow. */
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
  const tile = (key: string, label: string, onPress: () => void, body: ReactNode) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.flex}>{body}</View>
      <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={17} color={COLORS.gold} />
    </Pressable>
  );

  // The day's spiritual canon (context/SpiritualCanonContext.tsx): its head
  // opens the week; each task ticks off on the timeline, and the Agpeya's
  // hours and the Bible open from their rows.
  const canonTasks = canon.tasksFor(canon.today);
  const canonPascha = canon.items.some((item) => item.kind === 'agpeya') && canon.agpeyaOn(canon.today) !== 'all';
  const canonProgress = canonDayProgress(canonTasks);
  const canonComplete = canonProgress.total > 0 && canonProgress.done === canonProgress.total;
  const canonCard = (
    <View style={styles.card}>
      {cardFill}
      {cardHead(
        tr('Spiritual Canon', 'Canon spirituel', 'القانون الروحي'),
        tr('Today’s Canon', 'Canon du jour', 'قانون اليوم'),
        canonProgress.total ? dayProgressLabel(canonProgress.done, canonProgress.total) : formatDayMonthDate(live.today, arabic),
        canon.loaded && canon.items.length ? roundButton(tr('Edit your canon', 'Modifier votre canon', 'عدّل قانونك'), 'create-outline', () => router.push('/canon/edit' as never)) : undefined,
        { label: tr('Open your canon', 'Ouvrir votre canon', 'افتح قانونك'), onPress: () => router.push('/canon' as never) },
      )}
      {canon.loaded && canonTasks.length ? <View style={styles.segmentsGap}><CanonSegments tasks={canonTasks} /></View> : null}
      <View style={styles.timeline}>
        {!canon.loaded ? (
          <Text style={[styles.empty, arabic && styles.arabic]}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
        ) : !canon.items.length ? (
          <View style={styles.canonInvite}>
            <Text style={[styles.canonInviteText, arabic && styles.arabicCentered]}>
              {tr(
                'Set down your rule of prayer — hours of the Agpeya, Bible reading and your own — and tick it off each day.',
                'Notez votre règle de prière — heures de l’Agpia, lecture de la Bible et le reste — et cochez-la chaque jour.',
                'دوّن قانون صلاتك — ساعات الأجبية وقراءة الكتاب المقدس وما تختاره — وعلّمه كل يوم.',
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/canon/edit' as never)}
              style={({ pressed }) => [styles.prayButton, styles.inviteButton, pressed && styles.pressed]}
            >
              <Icon name="add" size={16} color={COLORS.greenDeep} />
              <Text style={[styles.prayButtonText, arabic && styles.arabicTight]}>{tr('Set up your canon', 'Établir votre canon', 'ضع قانونك')}</Text>
            </Pressable>
          </View>
        ) : canonTasks.length ? (
          canonTasks.map((task, index) => (
            <CanonTimelineRow
              key={task.key}
              task={task}
              arabic={arabic}
              first={index === 0}
              last={index === canonTasks.length - 1}
              onToggle={(done) => canon.setTaskDone(canon.today, task.key, done)}
              onOpen={() => router.push(canonTaskRoute(task) as never)}
            />
          ))
        ) : (
          <Text style={[styles.empty, arabic && styles.arabic]}>{tr('Nothing in your canon today.', 'Rien dans votre canon aujourd’hui.', 'لا شيء في قانونك اليوم.')}</Text>
        )}
        {canon.loaded && canonPascha ? <Text style={[styles.canonNote, arabic && styles.arabicCentered]}>{paschaAgpeyaNote()}</Text> : null}
        {canonComplete ? (
          <Text style={[styles.canonGlory, arabic && styles.arabicCentered]}>
            {tr('Glory to God! Today’s canon is complete.', 'Gloire à Dieu ! Le canon du jour est accompli.', 'المجد لله! اكتمل قانون اليوم.')}
          </Text>
        ) : null}
      </View>
    </View>
  );

  // The card's head opens the Lectionary; each reading opens its service at
  // that reading (lectionaryHref).
  const readingsTitle = tr('Liturgical Readings', 'Lectures liturgiques', 'القراءات الليتورجية');
  const readingsCard = (
    <View style={styles.card}>
      {cardFill}
      {cardHead(tr('Lectionary', 'Lectionnaire', 'القطمارس'), readingsTitle, spanLine(day, coptic), undefined, { label: tr('Open the Lectionary', 'Ouvrir le lectionnaire', 'افتح القطمارس'), onPress: () => router.push('/lectionary' as never) })}
      <View style={styles.segmentRow}>
        {segment(serviceReadings.map(({ service, title }) => ({ key: service, label: title })), shownReadings.service, (service) => setReadingsChoice({ key: dayIso, service }))}
      </View>
      <View style={styles.tiles}>
        {shownReadings.lines.map((line) => tile(
          line.key,
          `${shownReadings.title}: ${line.label}${line.value ? `, ${line.value}` : ''}`,
          () => router.push(lectionaryHref(shownReadings.service, line) as never),
          <>
            <Text style={[styles.tileKind, arabic && styles.tileKindArabic]} numberOfLines={1}>{arabic ? line.label : line.label.toUpperCase()}</Text>
            <Text style={[styles.tileValue, !line.value && styles.tileMissing, arabic && styles.arabic]}>{line.value ?? '—'}</Text>
          </>,
        ))}
      </View>
    </View>
  );

  const synaxCard = (
    <View style={styles.card}>
      {cardFill}
      {cardHead(tr('Synaxarium', 'Synaxaire', 'السنكسار'), tr('Commemorated Saints', 'Saints commémorés', 'تذكارات القديسين'), spanLine(synaxDate, synaxCoptic))}
      <View style={styles.segmentRow}>
        {segment(
          [
            { key: 'today' as const, label: tr('Today', 'Aujourd’hui', 'اليوم') },
            { key: 'tomorrow' as const, label: tr('Tomorrow', 'Demain', 'غدًا') },
          ],
          synaxDay,
          (choice) => setSynaxChoice({ key: dayIso, day: choice }),
        )}
        {roundButton(tr('Search the Synaxarium', 'Rechercher dans le Synaxaire', 'ابحث في السنكسار'), 'search-outline', () => router.push('/synaxarium'))}
      </View>
      <View style={styles.tiles}>
        {!synaxLoaded ? (
          <Text style={[styles.empty, arabic && styles.arabic]}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
        ) : events.length ? (
          events.map((event) => {
            const title = arabic ? event.titleArabic || event.titleEnglish || '' : event.titleEnglish || event.titleArabic || '';
            const { main, detail } = arabic || preferences.appLanguage === 'fr' ? { main: title, detail: null } : splitSaintTitle(title);
            return tile(
              event.entryKey,
              title,
              () => router.push(`/synaxarium?day=${isoDate(synaxDate)}` as never),
              <>
                <Text style={[styles.saintName, arabic && styles.arabic]}>{main}</Text>
                {detail ? <Text style={styles.saintDetail}>{detail}</Text> : null}
              </>,
            );
          })
        ) : (
          <Text style={[styles.empty, arabic && styles.arabic]}>{tr('No saints listed.', 'Aucun saint indiqué.', 'لا توجد تذكارات مدرجة.')}</Text>
        )}
      </View>
    </View>
  );

  // The page runs to both edges; its content keeps clear of the notch.
  const sidePadding = useSidePadding(layout === 'landscape' ? 16 : wide ? 36 : 16);

  let page: ReactNode;
  if (layout === 'landscape') {
    // The seal, the date and Pray now stay put; the cards scroll beside them.
    page = (
      <View style={[styles.landscape, sidePadding, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.landscapeLeft}>
          {hero}
          {prayCard}
        </View>
        <NowPlayingAwareScrollView style={styles.flex} showsVerticalScrollIndicator={false} contentContainerStyle={styles.landscapeCards}>
          {canonCard}
          {readingsCard}
          {synaxCard}
        </NowPlayingAwareScrollView>
      </View>
    );
  } else {
    const body = layout === 'columns' ? (
      <View style={styles.columns}>
        <View style={[styles.column, styles.columnNarrow]}>
          {hero}
          {prayCard}
        </View>
        <View style={styles.column}>{canonCard}</View>
        <View style={styles.column}>
          {readingsCard}
          {synaxCard}
        </View>
      </View>
    ) : layout === 'grid' ? (
      <>
        <View style={[styles.columns, styles.gridTop]}>
          <View style={styles.column}>{hero}</View>
          <View style={styles.column}>{prayCard}</View>
        </View>
        <View style={[styles.columns, styles.gridGap]}>
          <View style={styles.column}>{canonCard}</View>
          <View style={styles.column}>
            {readingsCard}
            {synaxCard}
          </View>
        </View>
      </>
    ) : (
      <View style={styles.stack}>
        {hero}
        {prayCard}
        {canonCard}
        {readingsCard}
        {synaxCard}
      </View>
    );
    page = (
      <NowPlayingAwareScrollView
        // Keyed by layout: a turn of the device mounts the page afresh rather than
        // restyling its views in place, which iOS laid out wrongly (a column of zero width).
        key={layout}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, wide && { paddingTop: insets.top + 28 }, sidePadding]}
      >
        <HeroGlow landscape={false} />
        {body}
      </NowPlayingAwareScrollView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head>
        <title>{tr('Coptic Vine', 'Coptic Vine', 'كوبتك فاين')}</title>
      </Head>
      {layout === 'landscape' ? <HeroGlow landscape /> : null}
      {page}
      <BottomTabBar active="home" />
    </SafeAreaView>
  );
}

/**
 * The green glow behind the seal: a radial light over a green-to-black fall.
 * On a phone on its side it rises from the top left, behind the seal there.
 */
function HeroGlow({ landscape }: { landscape: boolean }) {
  return (
    <View style={styles.glow} pointerEvents="none">
      <LinearGradient colors={[COLORS.greenMid, COLORS.greenDeep, '#000000']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <FillSvg>
        <Defs>
          <RadialGradient id="homeGlow" cx={landscape ? '10%' : '50%'} cy={landscape ? '0%' : '18%'} rx="120%" ry="75%" fx={landscape ? '10%' : '50%'} fy={landscape ? '0%' : '18%'}>
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
  flex: { flex: 1, minWidth: 0 },
  glow: { height: 560, left: 0, position: 'absolute', right: 0, top: 0 },
  content: { paddingBottom: 28 },

  // One column on a phone; three, or two over two, on an iPad and the desktop.
  stack: { alignSelf: 'center', gap: 14, maxWidth: 640, width: '100%' },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28 },
  column: { flex: 1, gap: 16, minWidth: 0 },
  // The seal's column a little narrower than the two cards' (0.9 : 1 : 1).
  columnNarrow: { flex: 0.9 },
  gridTop: { alignItems: 'center', gap: 22 },
  gridGap: { gap: 22, marginTop: 22 },
  // A phone on its side: a 290pt column that stays put, the cards scrolling beside it.
  landscape: { flex: 1, flexDirection: 'row', gap: 20 },
  landscapeLeft: { gap: 12, width: 290 },
  landscapeCards: { gap: 12, paddingBottom: 20 },

  hero: { alignItems: 'center', paddingBottom: 2 },
  heroRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  sealShadow: { backgroundColor: '#14301A', boxShadow: '0px 18px 36px rgba(0, 0, 0, 0.55)', position: 'absolute' },
  copticDay: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 34, fontWeight: '700', lineHeight: 40, marginTop: 14, textAlign: 'center' },
  copticDayWide: { fontSize: 38, lineHeight: 44 },
  copticDayRow: { fontSize: 24, lineHeight: 28, marginTop: 0, textAlign: 'left' },
  civil: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '500', marginTop: 6, textAlign: 'center' },
  civilRow: { fontSize: 12.5, marginTop: 3, textAlign: 'left' },
  civilYear: { color: COLORS.goldBright, fontWeight: '600' },
  heroDivider: { alignItems: 'center', marginTop: 12 },

  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  eyebrow: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase' },

  prayCard: { borderRadius: 24, boxShadow: '0px 14px 34px rgba(0, 0, 0, 0.4)', overflow: 'hidden', padding: 18 },
  prayCardCompact: { paddingHorizontal: 16, paddingVertical: 15 },
  corner: { opacity: 0.38, position: 'absolute', right: 8, top: 8 },
  cornerCompact: { right: 6, top: 6 },
  prayEyebrow: { color: COLORS.goldBright },
  prayRows: { gap: 8, marginTop: 12 },
  prayRowsCompact: { gap: 6, marginTop: 9 },
  prayRow: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.24)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingBottom: 12, paddingLeft: 14, paddingRight: 12, paddingTop: 12 },
  prayRowCompact: { paddingBottom: 9, paddingLeft: 12, paddingRight: 10, paddingTop: 9 },
  prayKicker: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
  prayTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700', lineHeight: 24, marginTop: 4 },
  prayTitleWide: { fontSize: 23, lineHeight: 26.5 },
  prayTitleCompact: { fontSize: 18, lineHeight: 21, marginTop: 2 },
  prayButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, flexDirection: 'row', gap: 6, height: 38, justifyContent: 'center', paddingHorizontal: 18 },
  prayButtonCompact: { height: 34, paddingHorizontal: 15 },
  prayButtonText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  prayButtonTextCompact: { fontSize: 14 },
  inviteButton: { alignSelf: 'center' },

  card: { backgroundColor: COLORS.surface, borderRadius: 22, overflow: 'hidden', padding: 18 },
  cardHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  cardTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 23, fontWeight: '700', lineHeight: 26.5, marginTop: 8 },
  cardSub: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, marginTop: 4 },
  roundButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  segmentsGap: { marginTop: 14 },
  timeline: { marginTop: 12 },
  segmentRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 14 },
  segment: { backgroundColor: COLORS.black, borderColor: COLORS.border, borderRadius: 99, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 4, padding: 4 },
  segmentOption: { alignItems: 'center', borderRadius: 99, flex: 1, paddingHorizontal: 6, paddingVertical: 8 },
  segmentOptionActive: { backgroundColor: COLORS.gold },
  segmentText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: COLORS.greenDeep },

  tiles: { gap: 6, marginTop: 12 },
  tile: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.28)', borderRadius: 14, flexDirection: 'row', gap: 12, paddingBottom: 11, paddingLeft: 14, paddingRight: 12, paddingTop: 11 },
  tileKind: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  tileKindArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'left', writingDirection: 'rtl' },
  tileValue: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '600', marginTop: 3 },
  tileMissing: { color: 'rgba(255, 255, 255, 0.35)' },
  saintName: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '500', lineHeight: 21 },
  saintDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 2 },

  canonInvite: { alignItems: 'center', gap: 14, paddingBottom: 4, paddingTop: 6 },
  canonInviteText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  canonNote: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingTop: 8, textAlign: 'center' },
  canonGlory: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.title, fontSize: 15, fontStyle: 'italic', paddingTop: 8, textAlign: 'center' },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, paddingVertical: 10 },
  pressed: { opacity: 0.7 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
