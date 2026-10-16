/**
 * Highlights made together -- one Pencil stroke, one selection across many
 * verses -- are one highlight to the reader, as in Apple Books: one colour,
 * one note, one removal. They are still stored a verse at a time (one record
 * per verse and language, the anchor every build of the app reads), tied by
 * a group id that rides in each record's own id (`<group>~<index>`), so a
 * build that knows nothing of groups keeps them whole when it saves them
 * back.
 *
 * Shared by the Sermon Planner and the Bible reader; pure and import-free.
 */

export interface GroupableHighlight {
  id: string;
  groupId?: string;
  color: string;
  style?: 'underline';
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** The group a highlight belongs to: its own id for one made before groups. */
export function highlightGroupId(highlight: Pick<GroupableHighlight, 'id' | 'groupId'>): string {
  if (highlight.groupId) return highlight.groupId;
  const mark = highlight.id.lastIndexOf('~');
  return mark > 0 ? highlight.id.slice(0, mark) : highlight.id;
}

/** A segment's place in its group, from its id; 0 for one made before groups. */
export function highlightSegmentIndex(highlight: Pick<GroupableHighlight, 'id'>): number {
  const mark = highlight.id.lastIndexOf('~');
  const index = mark > 0 ? Number(highlight.id.slice(mark + 1)) : 0;
  return Number.isInteger(index) && index >= 0 ? index : 0;
}

/** A new group's id: `<prefix>-<time>-<random>`, short enough that every segment id stays under 120 characters. */
export function newHighlightGroupId(prefix: string, now = Date.now()): string {
  return `${prefix}-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function highlightSegmentId(groupId: string, index: number): string {
  return `${groupId}~${index}`;
}

export interface HighlightGroup<T extends GroupableHighlight> {
  groupId: string;
  /** The first segment: it carries the group's note. */
  lead: T;
  /** In reading order. */
  segments: T[];
}

/** The groups in a list, in the order their first segments were made. */
export function groupHighlights<T extends GroupableHighlight>(highlights: readonly T[]): HighlightGroup<T>[] {
  const byGroup = new Map<string, T[]>();
  for (const highlight of highlights) {
    const groupId = highlightGroupId(highlight);
    const segments = byGroup.get(groupId);
    if (segments) segments.push(highlight);
    else byGroup.set(groupId, [highlight]);
  }
  return [...byGroup.entries()].map(([groupId, segments]) => {
    const ordered = [...segments].sort((a, b) => highlightSegmentIndex(a) - highlightSegmentIndex(b) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return { groupId, lead: ordered[0], segments: ordered };
  });
}

export interface HighlightCreation<A> {
  /** One per verse and language, in reading order. */
  anchors: A[];
  color: string;
  style?: 'underline';
  /** Segments the new highlight takes the place of: the ones it covers or touches, or the one being resized. Their whole groups go. */
  replaces?: string[];
}

export interface HighlightListChange<T> {
  highlights: T[];
  deletions: Record<string, string>;
  /** The new group's first segment, if one was made. */
  lead: T | null;
}

/**
 * Makes a group from a creation: the groups it replaces taken out (their
 * removal recorded, so another device's older copies don't bring them back),
 * their notes carried onto the new group's lead, and the earliest of their
 * creation times kept, so a merged highlight keeps its place in the list.
 */
export function applyHighlightCreation<T extends GroupableHighlight, A>(
  current: readonly T[],
  deletions: Readonly<Record<string, string>>,
  creation: HighlightCreation<A>,
  make: (anchor: A, details: { id: string; groupId: string; color: string; style?: 'underline'; note: string; createdAt: string; updatedAt: string }) => T,
  options: { prefix: string; now?: Date; groupId?: string },
): HighlightListChange<T> {
  const now = (options.now ?? new Date()).toISOString();
  const replacedIds = new Set(creation.replaces ?? []);
  const replacedGroups = new Set(current.filter((highlight) => replacedIds.has(highlight.id)).map(highlightGroupId));
  const replaced = current.filter((highlight) => replacedGroups.has(highlightGroupId(highlight)));
  const kept = current.filter((highlight) => !replacedGroups.has(highlightGroupId(highlight)));
  if (!creation.anchors.length) return { highlights: [...current], deletions: { ...deletions }, lead: null };

  const notes = [...new Set(groupHighlights(replaced).map((group) => String(group.lead.note || '').trim()).filter(Boolean))];
  const createdAt = replaced.reduce((earliest, highlight) => (Date.parse(highlight.createdAt) < Date.parse(earliest) ? highlight.createdAt : earliest), now);
  const groupId = options.groupId ?? newHighlightGroupId(options.prefix, Date.parse(now));
  const made = creation.anchors.map((anchor, index) => make(anchor, {
    id: highlightSegmentId(groupId, index),
    groupId,
    color: creation.color,
    style: creation.style,
    note: index === 0 ? notes.join('\n\n') : '',
    createdAt,
    updatedAt: now,
  }));

  const nextDeletions: Record<string, string> = { ...deletions };
  for (const highlight of replaced) nextDeletions[highlight.id] = now;
  for (const highlight of made) delete nextDeletions[highlight.id];
  return { highlights: [...kept, ...made], deletions: nextDeletions, lead: made[0] ?? null };
}

/** Recolours (or restyles) the whole group a segment belongs to; a note goes on the group's lead. */
export function applyHighlightGroupUpdate<T extends GroupableHighlight>(
  current: readonly T[],
  segmentId: string,
  patch: { color?: string; style?: 'underline' | null; note?: string },
  now = new Date(),
): T[] {
  const target = current.find((highlight) => highlight.id === segmentId);
  if (!target) return [...current];
  const groupId = highlightGroupId(target);
  const group = groupHighlights(current).find((entry) => entry.groupId === groupId);
  const leadId = group?.lead.id;
  const updatedAt = now.toISOString();
  return current.map((highlight) => {
    if (highlightGroupId(highlight) !== groupId) return highlight;
    const next: T = { ...highlight, updatedAt };
    if (patch.color !== undefined) next.color = patch.color;
    if (patch.style !== undefined) {
      if (patch.style) next.style = patch.style;
      else delete next.style;
    }
    if (patch.note !== undefined && highlight.id === leadId) next.note = patch.note;
    return next;
  });
}

/** Removes the whole group a segment belongs to, recording each removal. */
export function applyHighlightGroupRemoval<T extends GroupableHighlight>(
  current: readonly T[],
  deletions: Readonly<Record<string, string>>,
  segmentId: string,
  now = new Date(),
): { highlights: T[]; deletions: Record<string, string> } {
  const target = current.find((highlight) => highlight.id === segmentId);
  if (!target) return { highlights: [...current], deletions: { ...deletions } };
  const groupId = highlightGroupId(target);
  const deletedAt = now.toISOString();
  const nextDeletions: Record<string, string> = { ...deletions };
  const highlights = current.filter((highlight) => {
    if (highlightGroupId(highlight) !== groupId) return true;
    nextDeletions[highlight.id] = deletedAt;
    return false;
  });
  return { highlights, deletions: nextDeletions };
}
