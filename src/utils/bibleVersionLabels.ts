import type { AppText } from './appText';

export type BibleVersionTestament = 'OT' | 'NT';

/**
 * The names the reader sees for the Bible's two main texts, by what they are:
 * the English is the SAAS (St. Athanasius Academy Septuagint) in the Old
 * Testament and the NKJV in the New, and the Arabic is the SVD (Smith & Van
 * Dyck) throughout. The Old Testament's separate NKJV keeps its own name.
 * Without a testament (a search across both), the English names both.
 */
export function englishVersionLabel(testament: BibleVersionTestament | null | undefined): AppText {
  if (testament === 'OT') return { english: 'English (SAAS)', arabic: 'الإنجليزية (SAAS)', french: 'Anglais (SAAS)' };
  if (testament === 'NT') return { english: 'English (NKJV)', arabic: 'الإنجليزية (NKJV)', french: 'Anglais (NKJV)' };
  return { english: 'English (SAAS, NKJV)', arabic: 'الإنجليزية (SAAS، NKJV)', french: 'Anglais (SAAS, NKJV)' };
}

export const ARABIC_VERSION_LABEL: AppText = { english: 'Arabic (SVD)', arabic: 'العربية (SVD)', french: 'Arabe (SVD)' };
