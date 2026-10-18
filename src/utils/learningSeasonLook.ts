import { DAY_BLOCK_THEMES, THEME_BY_INDICATOR_KEY, type SeasonThemeKey } from '../constants/seasonAppearance';

export interface LearningSeasonLook {
  /** The Books day block's season this tile wears the colours of. */
  theme: SeasonThemeKey;
  from: string;
  to: string;
  /** A pale tile (the Holy Fifty Days) sets its name in deep green. */
  light: boolean;
}

/**
 * Which season's colours a Learn & Study season takes, for a season whose
 * slug the calendar doesn't name a day by: read from its slug or title (the
 * platform names its seasons freely). The first rule that matches wins, so
 * "Nativity Fast & Kiahk" is the fast's rose before it is the feast's
 * scarlet, and a Holy Fifty Days feast is white before "feast" makes it gold.
 */
const RULES: [RegExp, SeasonThemeKey][] = [
  [/holy.?week|pascha|passion/, 'holyweek'],
  [/nativity.?fast|kiahk|kiahk|advent/, 'natfast'],
  [/nativity|christmas/, 'nativity'],
  [/theophany|epiphany/, 'theophany'],
  [/lent|jonah|paramoun|fast.?of.?the.?nineveh/, 'lent'],
  [/palm|hosanna|cross/, 'palm'],
  [/fifty|pentecost|resurrection|easter|khamasin|ascension|thomas/, 'resurrection'],
  [/apostle/, 'apostles'],
  [/mary|marian|theotokos|assumption|dormition/, 'marian'],
  [/nayrouz|new.?year|feast/, 'gold'],
];

export function learningSeasonLook(season: { slug?: string | null; title: string }): LearningSeasonLook {
  // A season slugged as the calendar names its day (ascension, thomas-sunday,
  // annunciation…) wears that day's colour on the Books page, so the two
  // never disagree: the Ascension white, as the rest of the Holy Fifty Days.
  const slug = season.slug?.trim().toLowerCase() ?? '';
  const calendarTheme = Object.prototype.hasOwnProperty.call(THEME_BY_INDICATOR_KEY, slug) ? THEME_BY_INDICATOR_KEY[slug] : undefined;
  const text = `${slug} ${season.title}`.toLowerCase();
  const theme = calendarTheme ?? RULES.find(([pattern]) => pattern.test(text))?.[1] ?? 'annual';
  const palette = DAY_BLOCK_THEMES[theme];
  // The design's tiles: Annual glows brighter than the day block; Holy Week falls from crimson to black.
  if (theme === 'annual') return { theme, from: '#3A7A3F', to: '#14301B', light: false };
  if (theme === 'holyweek') return { theme, from: '#5C1A1A', to: '#050101', light: false };
  return { theme, from: palette.from, to: palette.to, light: theme === 'resurrection' };
}
