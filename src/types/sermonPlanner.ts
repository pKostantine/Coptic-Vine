// Apple Books' five: yellow (gold), green, blue, pink (rose) and purple.
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

export interface SermonPlan {
  version: 1;
  documentKey: string;
  serviceDate: string;
  generalNotes: string;
  highlights: SermonHighlight[];
  highlightDeletions: Record<string, string>;
  updatedAt: string;
}

export interface SermonReadingReference {
  id: string;
  label: string;
  sectionId: string;
  verseId: string;
  kind: 'scripture' | 'synaxarium';
}
