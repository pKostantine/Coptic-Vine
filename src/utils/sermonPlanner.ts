import type { DocumentSection } from '@/components/vine/documentHtml';
import {
  SERMON_HIGHLIGHT_COLORS,
  SERMON_PART_KINDS,
  type SermonHighlight,
  type SermonHighlightAnchor,
  type SermonHighlightColor,
  type SermonHighlightLanguage,
  type SermonPart,
  type SermonPartKind,
  type SermonPlan,
  type SermonPlanState,
  type SermonPlanStatus,
  type SermonPlanSummary,
} from '@/types/sermonPlanner';
import { groupHighlights, highlightGroupId } from '@/utils/highlightGroups';

const MAX_HIGHLIGHTS = 1000;
const MAX_HIGHLIGHT_DELETIONS = 1000;
const MAX_NOTE_LENGTH = 100_000;
const MAX_PARTS = 40;
const MAX_TITLE_LENGTH = 200;

/** The one plan a day had before a day could hold several (see SermonPlan). */
export const LEGACY_SERMON_DOCUMENT_KEY = 'liturgy.sermon_planner';
const DOCUMENT_KEY_PREFIX = 'sermon-plan:';
const LEGACY_PLAN_PREFIX = 'day-';

function cleanText(value: unknown, maxLength = MAX_NOTE_LENGTH): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function isHighlightLanguage(value: unknown): value is SermonHighlightLanguage {
  return value === 'english' || value === 'coptic' || value === 'arabic';
}

function isHighlightColor(value: unknown): value is SermonHighlightColor {
  return SERMON_HIGHLIGHT_COLORS.includes(value as SermonHighlightColor);
}

export function isSermonHighlightAnchor(value: unknown): value is SermonHighlightAnchor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const anchor = value as Partial<SermonHighlightAnchor>;
  return typeof anchor.sectionId === 'string'
    && typeof anchor.verseId === 'string'
    && isHighlightLanguage(anchor.language)
    && Number.isInteger(Number(anchor.startOffset))
    && Number.isInteger(Number(anchor.endOffset))
    && Number(anchor.startOffset) >= 0
    && Number(anchor.endOffset) > Number(anchor.startOffset)
    && typeof anchor.quote === 'string';
}

function cleanIsoDate(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function normalizeHighlightDeletions(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id, deletedAt]) => id.length > 0 && id.length <= 120 && typeof deletedAt === 'string' && !Number.isNaN(Date.parse(deletedAt)))
      .sort(([, left], [, right]) => Date.parse(String(right)) - Date.parse(String(left)))
      .slice(0, MAX_HIGHLIGHT_DELETIONS),
  );
}

export function normalizeSermonHighlight(value: unknown): SermonHighlight | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const highlight = value as Partial<SermonHighlight>;
  const metadata = value as Partial<Pick<SermonHighlight, 'id' | 'color' | 'note' | 'createdAt' | 'updatedAt'>>;
  const startOffset = Number(highlight.startOffset);
  const endOffset = Number(highlight.endOffset);
  const now = new Date().toISOString();
  if (
    typeof metadata.id !== 'string'
    || !isSermonHighlightAnchor(highlight)
  ) return null;

  const extras = value as Partial<Pick<SermonHighlight, 'groupId' | 'style'>>;
  return {
    id: metadata.id.slice(0, 120),
    ...(typeof extras.groupId === 'string' && extras.groupId && extras.groupId.length <= 120 ? { groupId: extras.groupId } : {}),
    ...(extras.style === 'underline' ? { style: 'underline' as const } : {}),
    sectionId: highlight.sectionId.slice(0, 512),
    verseId: highlight.verseId.slice(0, 640),
    language: highlight.language,
    startOffset,
    endOffset,
    quote: cleanText(highlight.quote, 5_000),
    color: isHighlightColor(metadata.color) ? metadata.color : 'gold',
    note: cleanText(metadata.note),
    createdAt: cleanIsoDate(metadata.createdAt, now),
    updatedAt: cleanIsoDate(metadata.updatedAt, now),
  };
}

// ─── Plans and their keys ───────────────────────────────────────────────────

function randomId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** A new plan's id. */
export function newSermonPlanId(): string {
  return randomId('p');
}

/** The row a plan is kept in: `sermon-plan:<id>`, or a day's one plan from before there could be several. */
export function sermonPlanDocumentKey(planId: string): string {
  return isLegacySermonPlanId(planId) ? LEGACY_SERMON_DOCUMENT_KEY : `${DOCUMENT_KEY_PREFIX}${planId}`;
}

/** The id of the plan a row holds; null for a row that isn't a sermon plan's. */
export function sermonPlanIdFor(documentKey: string, serviceDate: string): string | null {
  if (documentKey === LEGACY_SERMON_DOCUMENT_KEY) return `${LEGACY_PLAN_PREFIX}${serviceDate}`;
  if (documentKey.startsWith(DOCUMENT_KEY_PREFIX)) return documentKey.slice(DOCUMENT_KEY_PREFIX.length) || null;
  return null;
}

/** A day's one plan from before a day could hold several: `day-2027-04-07`. */
export function isLegacySermonPlanId(planId: string): boolean {
  return /^day-\d{4}-\d{2}-\d{2}$/.test(planId);
}

function newPart(kind: SermonPartKind): SermonPart {
  return { id: randomId(kind[0]), kind, title: '', body: '', highlightIds: [] };
}

/** A part of the given kind, ready to be written. */
export function createSermonPart(kind: SermonPartKind): SermonPart {
  return newPart(kind);
}

/** The outline a new plan starts with: Opening, three Points, Application, Closing. */
export function defaultSermonParts(): SermonPart[] {
  return [newPart('opening'), newPart('point'), newPart('point'), newPart('point'), newPart('application'), newPart('closing')];
}

export function emptySermonPlan(planId: string, serviceDate: string, title = ''): SermonPlan {
  return {
    version: 2,
    id: planId,
    documentKey: sermonPlanDocumentKey(planId),
    serviceDate,
    title,
    status: 'draft',
    bigIdea: '',
    parts: defaultSermonParts(),
    preachedSeconds: null,
    highlights: [],
    highlightDeletions: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizePart(value: unknown, index: number): SermonPart | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const part = value as Partial<SermonPart>;
  const kind = SERMON_PART_KINDS.includes(part.kind as SermonPartKind) ? part.kind as SermonPartKind : 'point';
  const id = typeof part.id === 'string' && part.id ? part.id.slice(0, 64) : `${kind[0]}${index}`;
  return {
    id,
    kind,
    title: cleanText(part.title, MAX_TITLE_LENGTH),
    body: cleanText(part.body),
    highlightIds: Array.isArray(part.highlightIds)
      ? [...new Set(part.highlightIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0 && entry.length <= 120))]
      : [],
  };
}

function isStatus(value: unknown): value is SermonPlanStatus {
  return value === 'draft' || value === 'ready' || value === 'preached';
}

/**
 * Reads a plan from anything stored: this build's own, or a day's plan as an
 * earlier build kept it (version 1: a day's highlights and its notes). Notes
 * from then open as the plan's Opening, so nothing written is lost.
 */
export function normalizeSermonPlan(value: unknown, planId: string, serviceDate: string): SermonPlan {
  const fallback = emptySermonPlan(planId, serviceDate);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const plan = value as Partial<SermonPlan> & { generalNotes?: unknown };
  const parts = Array.isArray(plan.parts)
    ? plan.parts.map(normalizePart).filter((part): part is SermonPart => Boolean(part)).slice(0, MAX_PARTS)
    : null;
  const legacyNotes = cleanText(plan.generalNotes).trim();
  const outline = parts ?? defaultSermonParts();
  if (!parts && legacyNotes) outline[0] = { ...outline[0], body: legacyNotes };
  const preached = Number(plan.preachedSeconds);
  return {
    ...fallback,
    title: cleanText(plan.title, MAX_TITLE_LENGTH),
    status: isStatus(plan.status) ? plan.status : 'draft',
    bigIdea: cleanText(plan.bigIdea, 2_000),
    parts: outline,
    preachedSeconds: Number.isFinite(preached) && preached > 0 ? Math.round(preached) : null,
    highlights: Array.isArray(plan.highlights)
      ? plan.highlights.map(normalizeSermonHighlight).filter((item): item is SermonHighlight => Boolean(item)).slice(0, MAX_HIGHLIGHTS)
      : [],
    highlightDeletions: normalizeHighlightDeletions(plan.highlightDeletions),
    createdAt: cleanIsoDate(plan.createdAt, fallback.createdAt),
    updatedAt: cleanIsoDate(plan.updatedAt, fallback.updatedAt),
  };
}

// ─── The row in sermon_plans ────────────────────────────────────────────────

/**
 * The plan's outline rides in the row's general_notes as JSON (tagged
 * `sermonPlan: 2`), beside the highlights and their removals in their own
 * columns, so a plan needs nothing of sermon_plans that wasn't there before.
 * Notes that aren't such JSON are a day's notes from before (version 1).
 */
interface SermonPlanEnvelope {
  sermonPlan: 2;
  title: string;
  status: SermonPlanStatus;
  bigIdea: string;
  parts: SermonPart[];
  preachedSeconds: number | null;
  createdAt: string;
}

export function encodeSermonPlanNotes(plan: SermonPlan): string {
  const envelope: SermonPlanEnvelope = {
    sermonPlan: 2,
    title: plan.title,
    status: plan.status,
    bigIdea: plan.bigIdea,
    parts: plan.parts,
    preachedSeconds: plan.preachedSeconds,
    createdAt: plan.createdAt,
  };
  return JSON.stringify(envelope);
}

/** What a row's general_notes holds: a plan's outline, or a day's notes from before. */
export function decodeSermonPlanNotes(notes: unknown): Partial<SermonPlanEnvelope> & { generalNotes?: string } {
  const text = typeof notes === 'string' ? notes : '';
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as Partial<SermonPlanEnvelope>;
      if (parsed && parsed.sermonPlan === 2) return parsed;
    } catch {
      // Notes that only begin with a brace are notes.
    }
  }
  return { generalNotes: text };
}

export interface SermonPlanRow {
  document_key: string;
  service_date: string;
  general_notes: string | null;
  highlights: unknown;
  highlight_deletions: unknown;
  updated_at: string;
}

/** The plan a sermon_plans row holds; null for a row that isn't one. */
export function sermonPlanFromRow(row: SermonPlanRow): SermonPlan | null {
  const planId = sermonPlanIdFor(row.document_key, row.service_date);
  if (!planId) return null;
  return normalizeSermonPlan({
    ...decodeSermonPlanNotes(row.general_notes),
    highlights: row.highlights,
    highlightDeletions: row.highlight_deletions,
    updatedAt: row.updated_at,
  }, planId, row.service_date);
}

// ─── Merging two copies ─────────────────────────────────────────────────────

/**
 * Two copies of one plan, this device's and the account's: each highlight
 * the newer of its two copies, a removal winning over an older copy, and the
 * outline the newer plan's.
 */
export function mergeSermonPlans(local: SermonPlan, cloud: SermonPlan): SermonPlan {
  const byId = new Map<string, SermonHighlight>();
  for (const highlight of [...local.highlights, ...cloud.highlights]) {
    const current = byId.get(highlight.id);
    if (!current || Date.parse(highlight.updatedAt) >= Date.parse(current.updatedAt)) {
      byId.set(highlight.id, highlight);
    }
  }
  const highlightDeletions: Record<string, string> = {};
  for (const deletions of [cloud.highlightDeletions, local.highlightDeletions]) {
    for (const [id, deletedAt] of Object.entries(deletions)) {
      const current = highlightDeletions[id];
      if (!current || Date.parse(deletedAt) >= Date.parse(current)) highlightDeletions[id] = deletedAt;
    }
  }
  const localIsNewer = Date.parse(local.updatedAt) >= Date.parse(cloud.updatedAt);
  const newer = localIsNewer ? local : cloud;
  return {
    ...newer,
    version: 2,
    id: local.id,
    documentKey: local.documentKey,
    serviceDate: local.serviceDate,
    highlights: [...byId.values()]
      .filter((highlight) => {
        const deletedAt = highlightDeletions[highlight.id];
        return !deletedAt || Date.parse(highlight.updatedAt) > Date.parse(deletedAt);
      })
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(0, MAX_HIGHLIGHTS),
    highlightDeletions: normalizeHighlightDeletions(highlightDeletions),
    createdAt: Date.parse(local.createdAt) <= Date.parse(cloud.createdAt) ? local.createdAt : cloud.createdAt,
    updatedAt: newer.updatedAt,
  };
}

export function createSermonHighlight(
  anchor: SermonHighlightAnchor,
  color: SermonHighlightColor = 'gold',
  details?: { id: string; groupId: string; style?: 'underline'; note: string; createdAt: string; updatedAt: string },
): SermonHighlight {
  const now = new Date().toISOString();
  const randomPart = Math.random().toString(36).slice(2, 10);
  return {
    sectionId: anchor.sectionId,
    verseId: anchor.verseId,
    language: anchor.language,
    startOffset: Number(anchor.startOffset),
    endOffset: Number(anchor.endOffset),
    quote: String(anchor.quote),
    id: details?.id ?? `sermon-${Date.now().toString(36)}-${randomPart}`,
    ...(details?.groupId ? { groupId: details.groupId } : {}),
    color,
    ...(details?.style === 'underline' ? { style: 'underline' as const } : {}),
    note: details?.note ?? '',
    createdAt: details?.createdAt ?? now,
    updatedAt: details?.updatedAt ?? now,
  };
}

export function isSermonHighlightColor(value: unknown): value is SermonHighlightColor {
  return isHighlightColor(value);
}

// ─── What a plan says of itself ─────────────────────────────────────────────

export function isSermonPartWritten(part: SermonPart): boolean {
  return part.body.trim().length > 0;
}

/** Not started until anything is written or highlighted; then the preacher's own Draft, Ready or Preached. */
export function sermonPlanState(plan: SermonPlan): SermonPlanState {
  if (plan.status !== 'draft') return plan.status;
  const started = plan.bigIdea.trim()
    || plan.highlights.length
    || plan.parts.some((part) => part.title.trim() || part.body.trim());
  return started ? 'draft' : 'notStarted';
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * About how long it will take to preach: two minutes a part to open up what
 * the outline only notes, and whatever is written out read at 130 words a
 * minute.
 */
export function estimatedSermonMinutes(plan: SermonPlan): number {
  const words = plan.parts.reduce((total, part) => total + wordCount(part.body), 0);
  return Math.max(1, Math.round(plan.parts.length * 2 + words / 130));
}

export function summarizeSermonPlan(plan: SermonPlan): SermonPlanSummary {
  return {
    id: plan.id,
    documentKey: plan.documentKey,
    serviceDate: plan.serviceDate,
    title: plan.title,
    state: sermonPlanState(plan),
    writtenParts: plan.parts.filter(isSermonPartWritten).length,
    totalParts: plan.parts.length,
    preachedSeconds: plan.preachedSeconds,
    highlightCount: groupHighlights(plan.highlights).length,
    updatedAt: plan.updatedAt,
  };
}

/** The highlights' groups placed in no part, in the order they were made. */
export function unplacedHighlightGroups(plan: SermonPlan) {
  const placed = new Set(plan.parts.flatMap((part) => part.highlightIds));
  return groupHighlights(plan.highlights).filter((group) => !placed.has(group.groupId));
}

/** Points numbered among themselves: Point 1, Point 2. */
export function sermonPointNumber(parts: readonly SermonPart[], partId: string): number | null {
  const points = parts.filter((part) => part.kind === 'point');
  const index = points.findIndex((part) => part.id === partId);
  return index >= 0 ? index + 1 : null;
}

/**
 * The parts after a highlight is made in place of others (one it took in, or
 * one being resized): each part that held one of them holds the new one, in
 * its place.
 */
export function partsWithReplacedHighlights(parts: readonly SermonPart[], replacedGroupIds: readonly string[], groupId: string): SermonPart[] {
  if (!replacedGroupIds.length) return [...parts];
  const replaced = new Set(replacedGroupIds);
  return parts.map((part) => {
    if (!part.highlightIds.some((id) => replaced.has(id))) return part;
    const highlightIds: string[] = [];
    for (const id of part.highlightIds) {
      const next = replaced.has(id) ? groupId : id;
      if (!highlightIds.includes(next)) highlightIds.push(next);
    }
    return { ...part, highlightIds };
  });
}

/** The groups the segments with these ids belong to. */
export function groupIdsOfSegments(highlights: readonly SermonHighlight[], segmentIds: readonly string[]): string[] {
  const wanted = new Set(segmentIds);
  return [...new Set(highlights.filter((highlight) => wanted.has(highlight.id)).map(highlightGroupId))];
}

// ─── Where a highlight is in the readings ───────────────────────────────────

/** Short names for the books, as a chip has room for: "Lk 1:35", "Ps 143:5". */
const BOOK_ABBREVIATIONS: [RegExp, string][] = [
  [/^genesis\b/i, 'Gen'], [/^exodus\b/i, 'Ex'], [/^leviticus\b/i, 'Lev'], [/^numbers\b/i, 'Num'],
  [/^deuteronomy\b/i, 'Deut'], [/^joshua\b/i, 'Josh'], [/^judges\b/i, 'Judg'], [/^ruth\b/i, 'Ruth'],
  [/^(1|i|first)\s+samuel\b/i, '1 Sam'], [/^(2|ii|second)\s+samuel\b/i, '2 Sam'],
  [/^(1|i|first)\s+kings\b/i, '1 Kgs'], [/^(2|ii|second)\s+kings\b/i, '2 Kgs'],
  [/^(1|i|first)\s+chronicles\b/i, '1 Chr'], [/^(2|ii|second)\s+chronicles\b/i, '2 Chr'],
  [/^ezra\b/i, 'Ezra'], [/^nehemiah\b/i, 'Neh'], [/^tobit\b/i, 'Tob'], [/^judith\b/i, 'Jdt'], [/^esther\b/i, 'Esth'],
  [/^job\b/i, 'Job'], [/^psalms?\b/i, 'Ps'], [/^proverbs\b/i, 'Prov'], [/^ecclesiastes\b/i, 'Eccl'],
  [/^song of (songs|solomon)\b/i, 'Song'], [/^wisdom\b/i, 'Wis'], [/^(sirach|ecclesiasticus)\b/i, 'Sir'],
  [/^isaiah\b/i, 'Isa'], [/^jeremiah\b/i, 'Jer'], [/^lamentations\b/i, 'Lam'], [/^baruch\b/i, 'Bar'],
  [/^ezekiel\b/i, 'Ezek'], [/^daniel\b/i, 'Dan'], [/^hosea\b/i, 'Hos'], [/^joel\b/i, 'Joel'], [/^amos\b/i, 'Amos'],
  [/^obadiah\b/i, 'Obad'], [/^jonah\b/i, 'Jonah'], [/^micah\b/i, 'Mic'], [/^nahum\b/i, 'Nah'],
  [/^habakkuk\b/i, 'Hab'], [/^zephaniah\b/i, 'Zeph'], [/^haggai\b/i, 'Hag'], [/^zechariah\b/i, 'Zech'],
  [/^malachi\b/i, 'Mal'], [/^(1|i|first)\s+maccabees\b/i, '1 Macc'], [/^(2|ii|second)\s+maccabees\b/i, '2 Macc'],
  [/^matthew\b/i, 'Mt'], [/^mark\b/i, 'Mk'], [/^luke\b/i, 'Lk'], [/^john\b/i, 'Jn'], [/^acts\b/i, 'Acts'],
  [/^romans\b/i, 'Rom'], [/^(1|i|first)\s+corinthians\b/i, '1 Cor'], [/^(2|ii|second)\s+corinthians\b/i, '2 Cor'],
  [/^galatians\b/i, 'Gal'], [/^ephesians\b/i, 'Eph'], [/^philippians\b/i, 'Phil'], [/^colossians\b/i, 'Col'],
  [/^(1|i|first)\s+thessalonians\b/i, '1 Thess'], [/^(2|ii|second)\s+thessalonians\b/i, '2 Thess'],
  [/^(1|i|first)\s+timothy\b/i, '1 Tim'], [/^(2|ii|second)\s+timothy\b/i, '2 Tim'], [/^titus\b/i, 'Titus'],
  [/^philemon\b/i, 'Phlm'], [/^hebrews\b/i, 'Heb'], [/^james\b/i, 'Jas'],
  [/^(1|i|first)\s+peter\b/i, '1 Pet'], [/^(2|ii|second)\s+peter\b/i, '2 Pet'],
  [/^(1|i|first)\s+john\b/i, '1 Jn'], [/^(2|ii|second)\s+john\b/i, '2 Jn'], [/^(3|iii|third)\s+john\b/i, '3 Jn'],
  [/^jude\b/i, 'Jude'], [/^revelation\b/i, 'Rev'],
];

/** "Luke 1:35" → "Lk 1:35"; a name it doesn't know is kept whole. */
export function abbreviateReference(reference: string): string {
  for (const [pattern, short] of BOOK_ABBREVIATIONS) {
    const match = pattern.exec(reference);
    if (match) return `${short}${reference.slice(match[0].length)}`;
  }
  return reference;
}

/**
 * Resolve a highlight's exact source reading without guessing from the most
 * recently seen unrelated hymn. Citation rows and their numbered verses live
 * together in hydrated reading sections; Synaxarium sections carry a group key.
 */
export function getSermonHighlightVerseReferences(sections: DocumentSection[]): Record<string, string> {
  const exactReference = (citation: string, chapter: string, verse: string) => {
    const match = citation.match(/^(.+?)\s+(\d+):/);
    if (!match) return citation;
    return `${match[1]} ${chapter || match[2]}:${verse}`;
  };
  const result: Record<string, string> = {};
  for (const section of sections) {
    let citation = section.sourceGroupKey === 'SYNAXARIUM' ? 'Synaxarium' : '';
    for (let index = 0; index < section.verses.length; index += 1) {
      const verse = section.verses[index];
      if (verse.type === 'readingReference') {
        citation = String(verse.english || verse.arabic || '').trim();
      }
      if (!citation) continue;
      const chapter = String(verse.bibleChapterNumber || '').trim();
      const number = String(verse.bibleVerseNumber || '').trim();
      result[`${section.id}::v${index}`] =
        number && verse.type !== 'readingReference' ? exactReference(citation, chapter, number) : citation;
    }
  }
  return result;
}
