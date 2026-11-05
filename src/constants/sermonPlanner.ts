import { SERMON_HIGHLIGHT_COLORS, type SermonHighlightColor, type SermonPartKind, type SermonPlanState } from '@/types/sermonPlanner';

/**
 * The Sermon Planner's look (Claude Design, "Sermon Planner"): the reader's
 * black, vine-green surfaces, gold for the one accent, and five highlight
 * colours that each mean something.
 */
export const SERMON_COLORS = {
  gold: '#E3B53B',
  onGold: '#14301B',
  /** The plan's panel; the plans list's cards. */
  surface: '#0B1C10',
  /** A part's card; a selected chip. */
  raised: '#12291B',
  /** The tray of highlights still to place, under the plan. */
  tray: '#08130B',
  /** Preach mode's parts list. */
  rail: '#050A06',
  line: 'rgba(255, 255, 255, 0.08)',
  fill: 'rgba(255, 255, 255, 0.06)',
  muted: 'rgba(205, 216, 203, 0.72)',
  written: '#8FD69A',
  text: '#FFFFFF',
} as const;

export interface SermonLabel {
  english: string;
  arabic: string;
  /** Where the toolbar has little room: "Cross-ref". */
  short: string;
  shortArabic: string;
  /** The dot and the line under a highlight. */
  swatch: string;
  /** The wash over the highlighted words. */
  wash: string;
}

/** The colours in the toolbar's order: Key verse, Illustration, Cross-reference, Application, Question. */
export const SERMON_HIGHLIGHT_COLORS_ORDER = SERMON_HIGHLIGHT_COLORS;

/** Each colour's meaning. */
export const SERMON_HIGHLIGHT_LABELS: Record<SermonHighlightColor, SermonLabel> = {
  gold: { english: 'Key verse', arabic: 'آية رئيسية', short: 'Key verse', shortArabic: 'آية رئيسية', swatch: '#E3B53B', wash: 'rgba(227, 181, 59, 0.26)' },
  green: { english: 'Illustration', arabic: 'مثال', short: 'Illustration', shortArabic: 'مثال', swatch: '#5FAE68', wash: 'rgba(95, 174, 104, 0.26)' },
  blue: { english: 'Cross-reference', arabic: 'شاهد', short: 'Cross-ref', shortArabic: 'شاهد', swatch: '#5D8FE6', wash: 'rgba(93, 143, 230, 0.28)' },
  rose: { english: 'Application', arabic: 'تطبيق', short: 'Application', shortArabic: 'تطبيق', swatch: '#D9578C', wash: 'rgba(217, 87, 140, 0.28)' },
  purple: { english: 'Question', arabic: 'سؤال', short: 'Question', shortArabic: 'سؤال', swatch: '#9A72C8', wash: 'rgba(154, 114, 200, 0.30)' },
};

/** A tint of a highlight's colour for the quote card in Preach mode ("Luke 1:34 · Question"). */
export const SERMON_LABEL_TEXT: Record<SermonHighlightColor, string> = {
  gold: '#F2D98A',
  green: '#A9DDB0',
  blue: '#AFC8F5',
  rose: '#F0A9C6',
  purple: '#C9B5EA',
};

export const SERMON_PART_NAMES: Record<SermonPartKind, { english: string; arabic: string }> = {
  opening: { english: 'Opening', arabic: 'المقدمة' },
  point: { english: 'Point', arabic: 'النقطة' },
  application: { english: 'Application', arabic: 'التطبيق' },
  closing: { english: 'Closing', arabic: 'الختام' },
};

/** What an empty part's title says until it has one. */
export const SERMON_PART_PLACEHOLDERS: Record<SermonPartKind, { english: string; arabic: string }> = {
  opening: { english: 'Add an opening', arabic: 'أضف مقدمة' },
  point: { english: 'Add a point', arabic: 'أضف نقطة' },
  application: { english: 'Add an application', arabic: 'أضف تطبيقاً' },
  closing: { english: 'Add a closing', arabic: 'أضف ختاماً' },
};

export const SERMON_STATE_NAMES: Record<SermonPlanState, { english: string; arabic: string }> = {
  notStarted: { english: 'Not started', arabic: 'لم تبدأ' },
  draft: { english: 'Draft', arabic: 'مسودة' },
  ready: { english: 'Ready', arabic: 'جاهزة' },
  preached: { english: 'Preached', arabic: 'أُلقيت' },
};

/** Each state's tag: its fill and its ink. */
export const SERMON_STATE_TAGS: Record<SermonPlanState, { fill: string; ink: string }> = {
  notStarted: { fill: 'rgba(255, 255, 255, 0.07)', ink: SERMON_COLORS.muted },
  draft: { fill: 'rgba(227, 181, 59, 0.16)', ink: SERMON_COLORS.gold },
  ready: { fill: 'rgba(93, 143, 230, 0.2)', ink: '#9DBDF3' },
  preached: { fill: 'rgba(95, 174, 104, 0.18)', ink: SERMON_COLORS.written },
};

/** The toolbar's palette in the page (textHighlights.ts), named in the planner's language. */
export function sermonHighlightPalette(arabic: boolean) {
  return Object.fromEntries(Object.entries(SERMON_HIGHLIGHT_LABELS).map(([color, label]) => [
    color,
    { wash: label.wash, swatch: label.swatch, label: arabic ? label.shortArabic : label.short },
  ]));
}
