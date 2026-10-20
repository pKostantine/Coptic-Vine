/**
 * D1 table names keep the Postgres schema as a prefix, joined with a dot:
 * "liturgy.hymn_texts". Unquoted, SQLite reads liturgy.hymn_texts as table
 * hymn_texts in an attached database called liturgy and fails with "no such
 * table", so every name is built here, quoted, and nobody types one by hand.
 * tests/sqlNames.test.ts fails the build on an unquoted schema.table in SQL.
 */

/** The Postgres schemas whose tables Phase 1 copies, plus the D1-only ones. */
export const CONTENT_SCHEMAS = [
  'agpeya', 'aspasmos', 'bible', 'calendar', 'canons', 'doxologies', 'fractions',
  'gospel_responses', 'gospel_rite', 'holy_week', 'hymn_of_the_intercessions', 'litanies',
  'liturgy', 'praxis_response', 'procession_of_the_cross', 'psalmody', 'public', 'readings',
  'seasonal_liturgy_hymns', 'synaxarium', 'veneration', 'verses_of_the_cymbals',
] as const;

/** Schemas that exist only in D1: the content revision and the offline package plan. */
export const D1_SCHEMAS = ['offline_content'] as const;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function checked(part: string, what: string): string {
  if (!IDENTIFIER.test(part)) throw new Error(`Not a valid ${what}: ${JSON.stringify(part)}`);
  return part;
}

/** A table or view, quoted: t('liturgy', 'hymn_texts') is "liturgy.hymn_texts". */
export function t(schema: string, table: string): string {
  return `"${checked(schema, 'schema name')}.${checked(table, 'table name')}"`;
}

/** An index or trigger, named like its table and quoted the same way. */
export const indexName = t;

/** A column, quoted. */
export function col(name: string): string {
  return `"${checked(name, 'column name')}"`;
}
