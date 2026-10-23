import { evaluateCondition, getContextFlags } from '@/utils/conditionEngine';
import {
  ABSTINENCE_DAY_CONDITION,
  ABSTINENCE_FASTS,
  AGPEYA_MORNING_ONLY_CONDITION,
  AGPEYA_NONE_CONDITION,
  METANIA_CONDITION,
  METANIA_FASTING_CONDITION,
  type CanonCalendarDay,
} from '@/utils/spiritualCanon';

/**
 * A day as the Church's calendar has it for the canon: whether metanias are
 * made (and whether it is a fasting day for them), how much of the Agpeya is
 * kept through Pascha, and the fasts it is a day of abstinence in — the day's flags (calendar.get_context_flags, read
 * from the downloaded calendar when there is one) against the canon's
 * conditions. The day is the believer's own — never the date the Books
 * screen has been moved to, and with no evening rollover.
 */
export async function readCanonCalendarDay(day: string): Promise<CanonCalendarDay> {
  const flags = await getContextFlags(day);
  const met = (condition: string) => Boolean(evaluateCondition(condition, flags));
  return {
    applicable: met(METANIA_CONDITION),
    fasting: met(METANIA_FASTING_CONDITION),
    agpeya: met(AGPEYA_NONE_CONDITION) ? 'none' : met(AGPEYA_MORNING_ONLY_CONDITION) ? 'beforeEve' : 'all',
    fasts: met(ABSTINENCE_DAY_CONDITION) ? ABSTINENCE_FASTS.filter((fast) => met(fast.condition)).map((fast) => fast.id) : [],
  };
}
