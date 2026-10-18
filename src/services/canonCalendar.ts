import { evaluateCondition, getContextFlags } from '@/utils/conditionEngine';
import { METANIA_CONDITION } from '@/utils/spiritualCanon';

/**
 * Whether metanias are made on a day, from the Church's calendar: the day's
 * flags (calendar.get_context_flags, read from the downloaded calendar when
 * there is one) against METANIA_CONDITION. The day is the believer's own —
 * never the date the Books screen has been moved to, and with no evening
 * rollover: a day's metanias are that day's.
 */
export async function readMetaniaDay(day: string): Promise<boolean> {
  const flags = await getContextFlags(day);
  return Boolean(evaluateCondition(METANIA_CONDITION, flags));
}
