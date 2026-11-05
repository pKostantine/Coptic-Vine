/**
 * The five highlight colours, kept under the names they have always been
 * stored by. In the Sermon Planner each colour means something (see
 * SERMON_HIGHLIGHT_LABELS): gold a key verse, green an illustration, blue a
 * cross-reference, rose an application and purple a question.
 */
export const SERMON_HIGHLIGHT_COLORS = ['gold', 'green', 'blue', 'rose', 'purple'] as const;

export type SermonHighlightColor = (typeof SERMON_HIGHLIGHT_COLORS)[number];
export type SermonHighlightLanguage = 'english' | 'coptic' | 'arabic';

export interface SermonHighlightAnchor {
  sectionId: string;
  verseId: string;
  language: SermonHighlightLanguage;
  startOffset: number;
  endOffset: number;
  quote: string;
}

export interface SermonHighlight extends SermonHighlightAnchor {
  /** `<groupId>~<index>` for a highlight made with others (utils/highlightGroups.ts). */
  id: string;
  /** The highlight it was made with: one stroke or selection across verses is one highlight. */
  groupId?: string;
  color: SermonHighlightColor;
  /** Underlined in the colour rather than washed with it. */
  style?: 'underline';
  /** On a group's first segment, the group's note. */
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** The parts an outline is made of, in the order a sermon usually takes them. */
export const SERMON_PART_KINDS = ['opening', 'point', 'application', 'closing'] as const;
export type SermonPartKind = (typeof SERMON_PART_KINDS)[number];

export interface SermonPart {
  id: string;
  kind: SermonPartKind;
  title: string;
  body: string;
  /** The highlights placed in this part, by group (utils/highlightGroups.ts), in the order placed. */
  highlightIds: string[];
}

/**
 * What the preacher has said of a plan. Not started is never stored: a plan
 * marked as a draft that nothing has been written in yet reads as not started.
 */
export type SermonPlanStatus = 'draft' | 'ready' | 'preached';
export type SermonPlanState = 'notStarted' | SermonPlanStatus;

/**
 * One sermon, for one day. A day can hold several (a Liturgy and a meeting),
 * each its own row: the plans made before there could be several, one per
 * day under the document key `liturgy.sermon_planner`, keep theirs, and every
 * plan made since is keyed `sermon-plan:<id>` (see sermonPlanDocumentKey).
 */
export interface SermonPlan {
  version: 2;
  id: string;
  documentKey: string;
  serviceDate: string;
  /** What it is called: the day's feast, "Weekday Liturgy", or the preacher's own ("Youth meeting"). */
  title: string;
  status: SermonPlanStatus;
  /** "The one sentence": the sermon's big idea. */
  bigIdea: string;
  parts: SermonPart[];
  /** How long it took to preach, once preached in Preach mode. */
  preachedSeconds: number | null;
  highlights: SermonHighlight[];
  highlightDeletions: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** A plan as the list of plans shows it, without its highlights' text. */
export interface SermonPlanSummary {
  id: string;
  documentKey: string;
  serviceDate: string;
  title: string;
  state: SermonPlanState;
  writtenParts: number;
  totalParts: number;
  preachedSeconds: number | null;
  highlightCount: number;
  updatedAt: string;
}
