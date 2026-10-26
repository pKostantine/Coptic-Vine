import { tr } from '@/utils/appText';
import type { LearningSeasonTiming } from '@/utils/learningSeasonDates';
import { formatCopticDayMonth, toEasternArabicDigits } from '@/utils/localeFormat';

/** "in 56 days" (or "In 56 days" on a tile's pill), "tomorrow"; in Arabic with the noun each count takes. */
export function inDaysText(days: number, arabic: boolean, capitalized = false): string {
  if (arabic) {
    if (days === 1) return 'غدًا';
    if (days === 2) return 'بعد يومين';
    return `بعد ${toEasternArabicDigits(days)} ${days <= 10 ? 'أيام' : 'يومًا'}`;
  }
  const text = days === 1 ? tr('tomorrow', 'demain', '') : tr(`in ${days} days`, `dans ${days} jours`, '');
  return capitalized ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** A dated season's Coptic start, "Hathor 16"; empty when it isn't dated or the date can't be read. */
export function seasonStartText(timing: LearningSeasonTiming | undefined, arabic: boolean): string {
  const coptic = timing?.next?.coptic;
  return coptic ? formatCopticDayMonth(coptic.monthName, coptic.day, arabic) : '';
}

/** The Seasons page's line under a dated season not yet begun: "Hathor 16 · in 56 days". */
export function seasonCountdownText(timing: LearningSeasonTiming | undefined, arabic: boolean): string {
  if (!timing?.next || timing.now) return '';
  return [seasonStartText(timing, arabic), inDaysText(timing.next.days, arabic)].filter(Boolean).join(' · ');
}
