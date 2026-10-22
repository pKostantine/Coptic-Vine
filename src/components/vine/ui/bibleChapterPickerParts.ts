import type { AppLanguage } from '../../../utils/preferencesStorage';

/** The chapter picker's words (BibleChapterPicker.tsx), in the App Language. */
export function chapterPickerText(language: AppLanguage, isPsalms: boolean) {
  if (language === 'ar') {
    return {
      eyebrow: isPsalms ? 'المزامير' : 'الإصحاحات',
      close: 'إغلاق قائمة الإصحاحات',
      chapterLabel: (label: string) => `${isPsalms ? 'المزمور' : 'الإصحاح'} ${label}`,
    };
  }
  if (language === 'fr') {
    return {
      eyebrow: isPsalms ? 'Psaumes' : 'Chapitres',
      close: 'Fermer la liste des chapitres',
      chapterLabel: (label: string) => `${isPsalms ? 'Psaume' : 'Chapitre'} ${label}`,
    };
  }
  return {
    eyebrow: isPsalms ? 'Psalms' : 'Chapters',
    close: 'Close the chapter list',
    chapterLabel: (label: string) => `${isPsalms ? 'Psalm' : 'Chapter'} ${label}`,
  };
}

const TILE = 48;
const TILE_HEIGHT = 44;
const GAP = 8;
const PADDING = 16;
const MAX_CARD = 380;
const SCREEN_MARGIN = 16;

/**
 * Where the picker's card sits and how its grid falls: centred under the
 * controls, at most 380pt wide (16pt clear of each screen edge), its tiles
 * sharing each row's width, as tall as the screen allows below its top, and
 * scrolled so the open chapter's row shows, with the row before it.
 */
export function chapterPickerGrid({ width, height, top, bottomInset, chapters, current }: {
  width: number;
  height: number;
  top: number;
  bottomInset: number;
  chapters: number[];
  current: number;
}) {
  const cardWidth = Math.max(0, Math.min(MAX_CARD, width - SCREEN_MARGIN * 2));
  const perRow = Math.max(1, Math.floor((cardWidth - PADDING * 2 + GAP) / (TILE + GAP)));
  // The tiles share each row's width, so a row of numbers runs edge to edge; a
  // chapter with a name ("Bel and the Dragon") widens its own tile.
  const tile = Math.max(TILE, Math.floor((cardWidth - PADDING * 2 - (perRow - 1) * GAP) / perRow));
  const index = Math.max(0, chapters.indexOf(current));
  const row = Math.floor(index / perRow);
  return {
    cardWidth,
    left: Math.round((width - cardWidth) / 2),
    maxHeight: Math.max(160, height - top - Math.max(bottomInset, SCREEN_MARGIN) - 8),
    perRow,
    tile,
    gap: GAP,
    padding: PADDING,
    initialScrollY: Math.max(0, (row - 1) * (TILE_HEIGHT + GAP)),
  };
}
