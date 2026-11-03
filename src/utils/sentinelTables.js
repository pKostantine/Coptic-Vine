import { CONTENT_ORDER_TABLES } from "../constants/contentOrderTables";

/**
 * A Subdocument or Inline row whose hymn_key is in capitals calls another
 * whole order table by that table's own name: FRACTIONS is
 * fractions.fractions, ADAM_ASPASMOS aspasmos.adam_aspasmos, GOSPEL_RITE
 * gospel_rite.gospel_rite. It is found wherever that table is
 * (CONTENT_ORDER_TABLES, every order table the content API serves), so a
 * table can be called from any document as soon as the content holds the
 * row: nothing has to be listed for it here.
 *
 * Only a key that isn't its table's name is, below.
 */
export const SENTINEL_TABLE_ALIASES = Object.freeze({
  // The older name of the_three_great_litanies, still in some rows.
  THREE_GREAT_LITANIES: { schema: "litanies", table: "the_three_great_litanies" },
});

const ALL_CAPS_KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

/** Whether a hymn_key is an ALL_CAPS sentinel, not a hymn's own (camelCase) key. */
export function isSentinelKey(hymnKey) {
  return ALL_CAPS_KEY_REGEX.test(String(hymnKey || ""));
}

/**
 * The whole order table { schema, table } an ALL_CAPS key calls, or null:
 * a hymn's own key, a key the reader resolves its own way
 * (`resolvedOtherwise`: the day's readings, the prophecies, the Synaxarium),
 * or a table the content doesn't have (yet).
 */
export function sentinelTable(hymnKey, resolvedOtherwise = () => false) {
  if (!isSentinelKey(hymnKey)) return null;
  if (Object.prototype.hasOwnProperty.call(SENTINEL_TABLE_ALIASES, hymnKey)) return SENTINEL_TABLE_ALIASES[hymnKey];
  if (resolvedOtherwise(hymnKey)) return null;
  const table = hymnKey.toLowerCase();
  return Object.prototype.hasOwnProperty.call(CONTENT_ORDER_TABLES, table)
    ? { schema: CONTENT_ORDER_TABLES[table], table }
    : null;
}
