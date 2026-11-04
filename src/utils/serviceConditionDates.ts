import { addUtcDays } from './dateUtils';

type ExtraContext = Record<string, unknown> | undefined;

interface ServiceWeekdayConditionInput {
  schema: string;
  table: string;
  extraContext?: ExtraContext;
  /** The liturgical date the service is read for (CalendarContext's effectiveDate, or a date it is opened for). */
  effectiveDate: Date;
}

export function isVespersPraisesService(schema: string, table: string): boolean {
  return schema === 'psalmody' && table === 'vespers_praises';
}

export function isVespersWeekdayService(schema: string, table: string, extraContext?: ExtraContext): boolean {
  return (
    (schema === 'liturgy' && table === 'raising_of_incense' && extraContext?.Vespers === true) ||
    (schema === 'liturgy' && table === 'lectionary_vespers')
  );
}

/**
 * Returns a date override for weekday/day-family condition flags only.
 *
 * The main hydration date still supplies feasts, fasts, seasons, Coptic date
 * tokens, and all non-weekday conditions. A day's Vespers (and its Vespers
 * Praises) is prayed the evening before, so its weekday is that evening's,
 * the day before the liturgical date: Palm Sunday's Vespers is Saturday's,
 * VatosDays, never Sunday's AdamDays. It is the same whether the service is
 * opened that Saturday night or on the Sunday morning: both read Palm
 * Sunday, and an evening never shows anything its morning doesn't.
 */
export function getServiceWeekdayConditionDate({
  schema,
  table,
  extraContext,
  effectiveDate,
}: ServiceWeekdayConditionInput): Date | undefined {
  // Sermon Planner mixes all three services in one document. Its hydrator
  // applies this override only to the Vespers rows, not Matins or Liturgy.
  const isSermonPlanner = schema === 'liturgy' && table === 'sermon_planner';
  if (isVespersPraisesService(schema, table) || isVespersWeekdayService(schema, table, extraContext) || isSermonPlanner) {
    return addUtcDays(effectiveDate, -1);
  }
  return undefined;
}
