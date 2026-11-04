import { CONTENT_ORDER_TABLES } from "../constants/contentOrderTables";

/**
 * A Subdocument, Inline or Hyperlink row calls another whole order table by
 * that table's full name, schema and table: procession_of_the_cross.vespers_procession,
 * fractions.fractions, gospel_rite.gospel_rite. The key says where the table
 * is, so the reader goes straight there: a table made today can be called
 * today, with nothing listed for it anywhere.
 *
 * Before 4 Nov 2026 a call named its table in capitals alone (FRACTIONS was
 * fractions.fractions, found wherever that table was, CONTENT_ORDER_TABLES).
 * The content was moved to full names then, but an offline book packed
 * before that still has the capitals, so those are understood too.
 */
const TABLE_CALL_REGEX = /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/;

/** The table a "schema.table" key names, or null for any other key. */
export function tableCall(hymnKey) {
  const match = TABLE_CALL_REGEX.exec(String(hymnKey || ""));
  return match ? { schema: match[1], table: match[2] } : null;
}

/**
 * The name a call goes by in the reader: a table's own name in capitals
 * (procession_of_the_cross.vespers_procession is VESPERS_PROCESSION), any
 * other key as it is. Sections are named after it (FRACTIONS-60), so a
 * bookmark or a reader's place made before the full names still finds its
 * section, and the few tables the reader treats in a way of their own (the
 * Gospel rites' Coptic Gospel Rite button, the Antiphonary's tunes) are
 * known by it whichever way they are called.
 */
export function callName(hymnKey) {
  const call = tableCall(hymnKey);
  return call ? call.table.toUpperCase() : String(hymnKey || "");
}

/**
 * A key in capitals from before the full names that isn't its table's name.
 * Kept for offline books packed before then.
 */
export const SENTINEL_TABLE_ALIASES = Object.freeze({
  THREE_GREAT_LITANIES: { schema: "litanies", table: "the_three_great_litanies" },
});

const ALL_CAPS_KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

/** Whether a hymn_key is an ALL_CAPS sentinel, not a hymn's own (camelCase) key. */
export function isSentinelKey(hymnKey) {
  return ALL_CAPS_KEY_REGEX.test(String(hymnKey || ""));
}

/**
 * The whole order table { schema, table } a call names, or null: a hymn's
 * own key, a key the reader resolves its own way (`resolvedOtherwise`, asked
 * of the call's name: the day's readings, the prophecies, the Synaxarium),
 * or a name in capitals no table has.
 */
export function sentinelTable(hymnKey, resolvedOtherwise = () => false) {
  const call = tableCall(hymnKey);
  if (call) return resolvedOtherwise(callName(hymnKey)) ? null : call;
  if (!isSentinelKey(hymnKey)) return null;
  if (Object.prototype.hasOwnProperty.call(SENTINEL_TABLE_ALIASES, hymnKey)) return SENTINEL_TABLE_ALIASES[hymnKey];
  if (resolvedOtherwise(hymnKey)) return null;
  const table = hymnKey.toLowerCase();
  return Object.prototype.hasOwnProperty.call(CONTENT_ORDER_TABLES, table)
    ? { schema: CONTENT_ORDER_TABLES[table], table }
    : null;
}
