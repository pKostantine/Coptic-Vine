import { evaluateCondition, getContextFlags } from '@/utils/conditionEngine';
import { METANIA_CONDITION, METANIA_FASTING_CONDITION, type MetaniaDay } from '@/utils/spiritualCanon';

/**
 * Whether metanias are made on a day, and whether it is a fasting day for
 * them, from the Church's calendar: the day's flags (calendar.get_context_flags,
 * read from the downloaded calendar when there is one) against
 * METANIA_CONDITION and METANIA_FASTING_CONDITION. The day is the believer's own —
 * never the date the Books screen has been moved to, and with no evening
 * rollover: a day's metanias are that day's.
 */
export async function readMetaniaDay(day: string): Promise<MetaniaDay> {
  const flags = await getContextFlags(day);
  return {
    applicable: Boolean(evaluateCondition(METANIA_CONDITION, flags)),
    fasting: Boolean(evaluateCondition(METANIA_FASTING_CONDITION, flags)),
  };
}
