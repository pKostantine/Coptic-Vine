'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Href, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { createContext, forwardRef, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import FillSvg from '../ui/FillSvg';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import Icon, { type IconName } from '../ui/Icon';
import { BuddedCross, VineRule } from '../ui/Ornaments';
import { CRIMSON_GLOW, VINE_GLOW, type PageGlowPalette } from '../../../constants/seasonAppearance';
import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { appText, tr } from '../../../utils/appText';
import { goBack } from '../../../utils/navigation';
import { useLayoutMode } from '../../../utils/useLayoutMode';
import { motionDuration, useReducedMotion } from '../../../utils/useReducedMotion';

const MAX_FONT_SCALE = 1.25;
/** On a phone-width page the content never grows past this; past it, it centres. */
export const BOOK_PAGE_MAX_WIDTH = 680;
/** The desktop's left column, beside the page's sections (the design's 420px). */
const DESKTOP_ASIDE_WIDTH = 420;
/** A single-column page on the iPad or desktop (Bible, Holy Week). */
const SINGLE_COLUMN_WIDTH = 720;

/**
 * The page's side gutter: 16 on a phone, none inside the iPad's and the
 * desktop's columns, which set their own margins. The page's pieces read it.
 */
const GutterContext = createContext(16);

/** The gutter the page's own pieces sit in (see GutterContext). */
export function usePageGutter(): number {
  return useContext(GutterContext);
}

/** Sets the gutter for a page built outside BookPage (the Music and Learn tabs' wide layouts set none). */
export function PageGutterProvider({ gutter, children }: { gutter: number; children: ReactNode }) {
  return <GutterContext.Provider value={gutter}>{children}</GutterContext.Provider>;
}

export interface BookPageAction {
  icon: IconName;
  label: string;
  onPress: () => void;
}

interface BookPageProps {
  title: { english: string; arabic: string; french?: string };
  /** The small gold line over the title: "The Praises", "Pascha". */
  kicker?: string;
  /** Under the title: "Genesis – Daniel", Holy Week's dates. */
  subtitle?: string;
  arabic: boolean;
  backHref: Href;
  /** Holy Week's pages glow crimson; every other book, vine green. */
  glow?: 'green' | 'crimson';
  /** The round button opposite Back. Bookmarks unless given another; null for none. */
  action?: BookPageAction | null;
  /** Sets the content in the page's 16pt gutter with 12pt between its pieces (for content that doesn't set its own margins). */
  padded?: boolean;
  /**
   * What the page shows first, under its title — the day or hour card. On a
   * phone it heads the page; on the iPad and desktop it stays under the title
   * in the left column, beside the sections.
   */
  aside?: ReactNode;
  /**
   * On the iPad and desktop: `split` sets the title and aside in a left
   * column beside the sections; `single` keeps one centred column (the
   * Bible, Holy Week).
   */
  wide?: 'split' | 'single';
  children: ReactNode;
}

/**
 * The frame every book's own page shares (Coptic Vine design system, "BookHero"): a glow
 * falling from the top of the page, round gold Back and Bookmarks buttons,
 * the book's medallion with its name beneath, then the page's own sections —
 * each a heading drawn out into a vine over a list of rows. The Books tab
 * stays at the foot, as it does on the Books screen. On the iPad and desktop
 * the title moves left, over the page's card, beside its sections.
 */
const BookPage = forwardRef<ScrollView, BookPageProps>(function BookPage(
  { title, kicker, subtitle, arabic, backHref, glow = 'green', action, padded = false, aside, wide = 'split', children },
  ref,
) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const trailing = action === undefined
    ? { icon: 'bookmark-outline' as const, label: tr('Open bookmarks', 'Ouvrir les signets', 'افتح العلامات'), onPress: () => router.push('/bookmarks') }
    : action;

  const layout = useLayoutMode();
  const wideLayout = layout !== 'phone';

  const nav = (
    <View style={[styles.nav, wideLayout ? styles.navWide : { paddingTop: insets.top + 4 }]}>
      <RoundButton
        icon="chevron-back"
        label={tr('Back', 'Retour', 'رجوع')}
        onPress={() => goBack(router, backHref)}
      />
      {trailing ? <RoundButton icon={trailing.icon} label={trailing.label} onPress={trailing.onPress} /> : null}
    </View>
  );

  const hero = (
    <View style={[styles.hero, wideLayout && styles.heroWide]}>
      <View style={styles.medallion}>
        <BuddedCross size={30} />
      </View>
      {kicker ? (
        <Text style={[styles.kicker, wideLayout && styles.textLeft, arabic && styles.kickerArabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {arabic ? kicker : kicker.toUpperCase()}
        </Text>
      ) : null}
      <Text style={[styles.title, wideLayout && styles.textLeft, arabic && styles.titleArabic]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {appText(title)}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, wideLayout && styles.textLeft, arabic && styles.subtitleArabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  const content = padded ? <View style={[styles.padded, wideLayout && styles.paddedWide]}>{children}</View> : children;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head>
        <title>{`Coptic Vine ${title.english}`}</title>
      </Head>
      <NowPlayingAwareScrollView
        ref={ref}
        // No tab bar sits under this scroll view any more, so the page itself
        // has to clear the home indicator.
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 28 + insets.bottom },
          wideLayout && [styles.contentWide, { paddingTop: insets.top + 28 }],
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind={glow} tall={wideLayout} />
        {wideLayout ? (
          <GutterContext.Provider value={0}>
            {nav}
            {wide === 'single' ? (
              <View style={styles.single}>
                {hero}
                {aside}
                {content}
              </View>
            ) : (
              <View style={styles.columns}>
                <View style={layout === 'desktop' ? styles.asideDesktop : styles.column2}>
                  {hero}
                  {aside}
                </View>
                <View style={styles.column2}>{content}</View>
              </View>
            )}
          </GutterContext.Provider>
        ) : (
          <View style={styles.column}>
            {nav}
            {hero}
            {aside ? <PageGutter>{aside}</PageGutter> : null}
            {content}
          </View>
        )}
      </NowPlayingAwareScrollView>
    </SafeAreaView>
  );
});

export default BookPage;

/** A round gold icon button in the page's top row. */
function RoundButton({ icon, label, onPress }: BookPageAction) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={COLORS.gold} />
    </Pressable>
  );
}

/**
 * The light falling from the top of the page: green for the books, crimson
 * for Holy Week, or any other glow's colours — the Books tab's follow the
 * season of the day it shows (SEASON_GLOWS in seasonAppearance.ts). When the
 * colours change the new glow fades in over the old one, as the day block's
 * do; with Reduce Motion it simply changes.
 */
export function PageGlow({ kind, tall = false }: { kind: 'green' | 'crimson' | PageGlowPalette; tall?: boolean }) {
  const palette = kind === 'green' ? VINE_GLOW : kind === 'crimson' ? CRIMSON_GLOW : kind;
  const [layers, setLayers] = useState<{ current: PageGlowPalette; previous: PageGlowPalette | null; turn: number }>({ current: palette, previous: null, turn: 0 });

  if (layers.current !== palette) {
    // Recorded during render so the old glow stays underneath while the new
    // one fades in over it.
    setLayers({ current: palette, previous: layers.current, turn: layers.turn + 1 });
  }

  return (
    <View style={[styles.glow, tall && styles.glowTall]} pointerEvents="none">
      {layers.previous ? <GlowArt palette={layers.previous} /> : null}
      {/* A glow that never changes is drawn bare; each change mounts a fresh layer that fades itself in. */}
      {layers.previous ? (
        <GlowFadeIn key={layers.turn}>
          <GlowArt palette={layers.current} />
        </GlowFadeIn>
      ) : (
        <GlowArt palette={layers.current} />
      )}
    </View>
  );
}

function GlowFadeIn({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: motionDuration(220, reduced), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [opacity, reduced]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

/** One glow drawn: its fall, and its light over it. */
function GlowArt({ palette }: { palette: PageGlowPalette }) {
  // Unique per layer: on web the pages of a stack share one document.
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { cx, cy, rx, ry } = palette.light;
  return (
    <FillSvg>
      <Defs>
        <SvgLinearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          {palette.fall.map(([offset, color]) => <Stop key={offset} offset={offset} stopColor={color} />)}
        </SvgLinearGradient>
        <RadialGradient id={`${id}r`} cx={cx} cy={cy} rx={rx} ry={ry} fx={cx} fy={cy}>
          {palette.stops.map(([offset, color, opacity]) => <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />)}
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}l)`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}r)`} />
    </FillSvg>
  );
}

/** Sets a piece of the page (a day card, the search bar) in the page's 16pt gutter. */
export function PageGutter({ children }: { children: ReactNode }) {
  return <View style={{ paddingHorizontal: usePageGutter() }}>{children}</View>;
}

/** A section's name, the vine drawn out from it to the edge of the page. */
/**
 * A section's title with the vine run out beside it. The book pages set it at
 * 19pt; the tabs' own pages (Music, Learn, the Library, Account, Downloads)
 * at 21pt with more room around it, and a search's results a little tighter.
 */
export function SectionHeading({ title, arabic, trailing, size = 'book' }: {
  title: string;
  arabic: boolean;
  trailing?: ReactNode;
  size?: 'book' | 'page' | 'results';
}) {
  return (
    <View style={[styles.section, size === 'page' && styles.sectionPage, size === 'results' && styles.sectionResults, { paddingHorizontal: usePageGutter() }]}>
      <Text style={[styles.sectionTitle, size !== 'book' && styles.sectionTitlePage, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>
        {title}
      </Text>
      <VineRule />
      {trailing}
    </View>
  );
}

/** A section's rows, each on a card of its own. */
export function RowList({ children }: { children: ReactNode }) {
  return <View style={[styles.rows, { marginHorizontal: usePageGutter() }]}>{children}</View>;
}

interface BookRowProps {
  title: string;
  arabic: boolean;
  onPress: () => void;
  /** A gold outline icon before the title: the hour a service is prayed at, what a book is. */
  icon?: IconName;
  /** A muted line under the title: "Evening", "Before every hour". */
  detail?: string;
  /** Muted, before the chevron: a book's chapter count. */
  count?: string;
  bookmarked?: boolean;
  /** Warm what the row opens (the Bible's chapter lists). */
  onPrefetch?: () => void;
}

/** One entry in a book page's list: its icon, its name over a short line, and the chevron. */
export function BookRow({ title, arabic, onPress, icon, detail, count, bookmarked, onPrefetch }: BookRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      onPressIn={onPrefetch}
      onHoverIn={onPrefetch}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {icon ? (
        <View style={styles.rowIcon}>
          <Icon name={icon} size={24} color={COLORS.gold} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, arabic && styles.arabicTitle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        {detail ? (
          <Text style={[styles.rowDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {detail}
          </Text>
        ) : null}
      </View>
      {bookmarked ? <Icon name="bookmark" size={14} color={COLORS.gold} /> : null}
      {count !== undefined ? (
        <Text style={[styles.count, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {count}
        </Text>
      ) : null}
      <Icon name="chevron-forward" size={17} color={COLORS.gold} />
    </Pressable>
  );
}

interface ReadingRowProps {
  /** What is read: "Psalm", "Pauline". */
  kind: string;
  /** Its citation, or null while unknown. */
  value: string | null;
  arabic: boolean;
  onPress: () => void;
  /** Wide enough for the longest kind in its list ("Prophecy 2"). */
  kindWidth?: number;
}

/** A reading in the Lectionary: what is read, then where — opening the service that reads it. */
export function ReadingRow({ kind, value, arabic, onPress, kindWidth = 74 }: ReadingRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${kind}, ${value}` : kind}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.readingRow, pressed && styles.rowPressed]}
    >
      <Text style={[styles.kind, { width: kindWidth }, arabic && styles.kindArabic]} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>
        {arabic ? kind : kind.toUpperCase()}
      </Text>
      <Text style={[styles.reading, !value && styles.readingMissing, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {value ?? '—'}
      </Text>
      <Icon name="chevron-forward" size={17} color={COLORS.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  column: { alignSelf: 'center', maxWidth: BOOK_PAGE_MAX_WIDTH, width: '100%' },
  padded: { gap: 12, paddingHorizontal: 16 },
  paddedWide: { paddingHorizontal: 0 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTitle: { fontFamily: TYPOGRAPHY.arabic, fontSize: 18, textAlign: 'left', writingDirection: 'rtl' },
  pressed: { opacity: 0.7 },

  glow: { height: 520, left: 0, position: 'absolute', right: 0, top: 0 },
  glowTall: { height: 600 },
  // The iPad's and desktop's page: 36pt margins, the nav row across the top, then the columns.
  contentWide: { paddingHorizontal: 36 },
  navWide: { paddingBottom: 8, paddingHorizontal: 0 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28 },
  column2: { flex: 1, minWidth: 0 },
  asideDesktop: { width: DESKTOP_ASIDE_WIDTH },
  single: { alignSelf: 'center', maxWidth: SINGLE_COLUMN_WIDTH, width: '100%' },
  heroWide: { alignItems: 'flex-start', paddingHorizontal: 0 },
  textLeft: { textAlign: 'left' },
  nav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  roundButton: {
    alignItems: 'center',
    borderColor: COLORS.goldLine,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  hero: { alignItems: 'center', paddingBottom: 22, paddingHorizontal: 24 },
  // 52pt inside its hairline, 54 across.
  medallion: {
    alignItems: 'center',
    backgroundColor: COLORS.goldSoft,
    borderColor: 'rgba(227, 181, 59, 0.35)',
    borderRadius: 27,
    borderWidth: 1,
    boxShadow: '0px 0px 30px rgba(227, 181, 59, 0.22)',
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 2.2, marginTop: 12, textAlign: 'center' },
  kickerArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13.5, letterSpacing: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 36, fontWeight: '700', lineHeight: 38, marginTop: 6, textAlign: 'center' },
  titleArabic: { fontFamily: TYPOGRAPHY.arabic, lineHeight: 52, writingDirection: 'rtl' },
  subtitle: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, marginTop: 8, textAlign: 'center' },
  subtitleArabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },

  section: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 10, marginTop: 26 },
  sectionTitle: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700' },
  sectionPage: { marginBottom: 12, marginTop: 28 },
  sectionResults: { marginBottom: 10, marginTop: 22 },
  sectionTitlePage: { fontSize: 21 },

  rows: { gap: 8 },
  // A row is 60pt with its name alone, 70 beside an icon. Its hairline is
  // kept but clear: the cards carry no outline, only their surface.
  row: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: COLORS.surfaceSoft },
  rowIcon: { alignItems: 'flex-start', height: 40, justifyContent: 'center', width: 32 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 18, fontWeight: '700' },
  rowDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 2 },
  count: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5 },

  readingRow: { gap: 12 },
  kind: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.4 },
  kindArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'left', writingDirection: 'rtl' },
  reading: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 16.5, fontWeight: '600' },
  readingMissing: { color: 'rgba(255, 255, 255, 0.35)' },
});
