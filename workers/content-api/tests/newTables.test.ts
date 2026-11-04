/**
 * An order table made in D1 after schema/content-tables.json (in the D1
 * console, say) is served, packed into the offline books, and tracked by the
 * revision like the list's own tables (src/content.ts, src/adopt.ts), so a
 * Subdocument, Inline or Hyperlink row can call it by its full name the
 * moment it is there. Run against SQLite with the real content schema of
 * migrations/0001 (and 0002's search tables), the revision of 0003 and the
 * plan of 0004.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { adoptNewTables, revisionTriggers } from '../src/adopt.ts';
import { findContentTable, orderTableOf } from '../src/content.ts';
import { deriveCalls } from '../src/offlineCalls.ts';
import { readRows } from '../src/rest/rows.ts';
import { getOfflinePackagePlan, getOfflineTableRows } from '../src/rpc/offline.ts';
import type { ContentContext, D1Database } from '../src/types.ts';

const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

/** A D1 binding over node:sqlite. */
function d1(db: DatabaseSync): D1Database {
  const statement = (sql: string, values: unknown[] = []) => ({
    sql,
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[], success: true, meta: {} }),
    raw: async <T>() => [] as T[],
  });
  return {
    prepare: (sql: string) => statement(sql),
    // As D1's: in one transaction, so a batch that writes is all or nothing.
    batch: async (statements) => {
      const all = statements as ReturnType<typeof statement>[];
      const writes = all.some((s) => !/^\s*(SELECT|PRAGMA)\b/i.test(s.sql));
      if (writes) db.exec('BEGIN');
      try {
        const results = [];
        for (const s of all) results.push(await s.all());
        if (writes) db.exec('COMMIT');
        return results;
      } catch (error) {
        if (writes) db.exec('ROLLBACK');
        throw error;
      }
    },
  } as D1Database;
}

/** The content as the D1 console would leave it after someone made a new table there. */
function content() {
  const db = new DatabaseSync(':memory:');
  db.exec(migration('0001_content_schema.sql'));
  db.exec(migration('0002_bible_search.sql'));
  db.exec(migration('0003_content_revision.sql'));
  db.exec(migration('0004_offline_plan.sql'));
  db.exec(migration('0035_commemoration_of_the_saints_hymns.sql').match(/CREATE TABLE "liturgy\.commemoration_of_the_saints_hymns" \([^;]*;/)![0]);
  // Made by hand, with no triggers, the way a table is made in the console.
  db.exec(`CREATE TABLE "procession_of_the_cross.vespers_procession" (
    "item_order" REAL NOT NULL PRIMARY KEY, "hymn_key" TEXT, "condition" TEXT, "minimization" TEXT, "item_type" TEXT)`);
  db.exec(`INSERT INTO "procession_of_the_cross.vespers_procession" ("item_order", "hymn_key", "condition") VALUES
    (2, 'throughHisCross', 'FeastOfTheCross'), (1, 'litanyOfTheGospel', NULL), (1.5, 'liturgy.distribution', NULL)`);
  db.exec(`UPDATE "procession_of_the_cross.vespers_procession" SET "item_type" = 'Hyperlink' WHERE "item_order" = 1.5`);
  // Not order tables, or not where content is: never served.
  db.exec(`CREATE TABLE "liturgy.notes" ("item_order" REAL, "hymn_key" TEXT, "author_email" TEXT)`);
  db.exec(`CREATE TABLE "public.placements" ("item_order" REAL, "hymn_key" TEXT)`);
  db.exec(`CREATE TABLE "auth.order" ("item_order" REAL, "hymn_key" TEXT)`);
  const revision = () => (db.prepare(`SELECT "revision" FROM "offline_content.revision" WHERE "id" = 1`).get() as { revision: number }).revision;
  return { db, revision, context: { db: d1(db), churchId: null } as ContentContext };
}

const url = (query: string) => new URL(`https://content.internal/rows?${query}`);

test('a new order table in a content schema is served by its name, in its order, like the tables in the list', async () => {
  const { context } = content();
  const { body } = await readRows(context, 'procession_of_the_cross', 'vespers_procession', url('select=*&order=item_order.asc'), '');
  assert.deepEqual(body, [
    { item_order: 1, hymn_key: 'litanyOfTheGospel', condition: null, minimization: null, item_type: null },
    { item_order: 1.5, hymn_key: 'liturgy.distribution', condition: null, minimization: null, item_type: 'Hyperlink' },
    { item_order: 2, hymn_key: 'throughHisCross', condition: 'FeastOfTheCross', minimization: null, item_type: null },
  ]);
  // Filtered as the app filters any order table.
  const { body: one } = await readRows(context, 'procession_of_the_cross', 'vespers_procession', url('select=hymn_key&item_order=eq.2'), '');
  assert.deepEqual(one, [{ hymn_key: 'throughHisCross' }]);
});

test('only an order table is found that way: another shape, public, or a schema that is not content stays hidden', async () => {
  const { context } = content();
  for (const [schemaName, table] of [['liturgy', 'notes'], ['public', 'placements'], ['auth', 'order'], ['liturgy', 'nowhere']]) {
    await assert.rejects(readRows(context, schemaName, table, url('select=*'), ''), /Could not find the table|Invalid schema/, `${schemaName}.${table}`);
  }
  assert.equal(orderTableOf('liturgy', 'notes', ['item_order', 'hymn_key', 'author_email']), null);
  assert.equal(orderTableOf('public', 'placements', ['item_order', 'hymn_key']), null);
  assert.equal(orderTableOf('liturgy', 'hymns', ['hymn_key', 'condition']), null, 'item_order and hymn_key both');
  assert.equal(orderTableOf('liturgy', 'liturgy_of_st_basil', ['item_order', 'hymn_key']), null, "the list's own tables are the list's");
  assert.deepEqual(orderTableOf('canons', 'new_canons', ['item_order', 'hymn_key', 'implying_conditions'])?.rowKey, ['item_order']);
});

test('a table made a moment ago is found at once', async () => {
  const { db, context } = content();
  assert.ok(await findContentTable(context.db, 'procession_of_the_cross', 'vespers_procession'));
  assert.equal(await findContentTable(context.db, 'liturgy', 'just_made'), undefined);
  db.exec(`CREATE TABLE "liturgy.just_made" ("item_order" REAL NOT NULL, "hymn_key" TEXT)`);
  // A table asked for that wasn't there is looked for again within seconds, not the minute the rest wait.
  await new Promise((resolve) => setTimeout(resolve, 5_100));
  assert.ok(await findContentTable(context.db, 'liturgy', 'just_made'));
});

test('the minute cron gives a new table the triggers the list\'s tables have, once, so its edits move the revision', async () => {
  const { db, revision, context } = content();
  // The triggers are written as migrations/0003 writes them.
  const [insert] = revisionTriggers('agpeya', 'first_hour');
  assert.ok(migration('0003_content_revision.sql').includes(insert), 'the same SQL as 0003');

  const before = revision();
  assert.deepEqual(await adoptNewTables(context.db), ['procession_of_the_cross.vespers_procession']);
  // Its rows from before the triggers count as a change, once.
  assert.equal(revision(), before + 1);
  const changed = db.prepare(`SELECT "table_name" FROM "offline_content.content_changes" WHERE "schema_name" = 'procession_of_the_cross'`).all();
  assert.deepEqual(changed.map((row) => (row as { table_name: string }).table_name), ['vespers_procession']);
  // From now on every edit moves it, as any other content table's does.
  db.exec(`INSERT INTO "procession_of_the_cross.vespers_procession" ("item_order", "hymn_key") VALUES (3, 'hosannaInTheHighest')`);
  db.exec(`DELETE FROM "procession_of_the_cross.vespers_procession" WHERE "item_order" = 3`);
  assert.equal(revision(), before + 3);
  // Nothing to do the next minute.
  assert.deepEqual(await adoptNewTables(context.db), []);
  assert.equal(revision(), before + 3);
  // The hidden tables were left alone.
  const triggers = db.prepare(`SELECT "tbl_name" FROM sqlite_master WHERE "type" = 'trigger' AND "tbl_name" IN ('liturgy.notes', 'public.placements', 'auth.order')`).all();
  assert.deepEqual(triggers, []);
});

test("the offline books pack a new table with its schema's, and what it calls by full name", async () => {
  const { db, context } = content();
  // The Raising of Incense calls it, so the Liturgy's book carries the Procession's.
  db.exec(`INSERT INTO "liturgy.raising_of_incense" ("item_order", "hymn_key", "item_type") VALUES (31.1, 'procession_of_the_cross.vespers_procession', 'Inline')`);
  const plan = await getOfflinePackagePlan(context) as { resources: { id: string; tables: string[] }[]; dependencies: { resource: string; dependency: string }[] };
  const procession = plan.resources.find((resource) => resource.id === 'procession_of_the_cross');
  assert.ok(procession?.tables.includes('vespers_procession'), JSON.stringify(procession));
  const rows = await getOfflineTableRows(context, 'procession_of_the_cross', 'vespers_procession', null, 50) as { rows: { hymn_key: string }[] };
  assert.deepEqual(rows.rows.map((row) => row.hymn_key), ['throughHisCross', 'litanyOfTheGospel', 'liturgy.distribution']);
  assert.ok(plan.dependencies.some((d) => d.resource === 'liturgy' && d.dependency === 'procession_of_the_cross'));
  // Its Hyperlink to liturgy.distribution makes the Procession's book carry the Liturgy.
  assert.ok(plan.dependencies.some((d) => d.resource === 'procession_of_the_cross' && d.dependency === 'liturgy'));
});

test("a hymn an order table places from a schema far off is packed with it, as the reader finds it there", () => {
  const calls = deriveCalls({
    orderKeys: new Map([['procession_of_the_cross.procession_of_the_cross', ['etavenNieskhai', 'litanyOfTheGospel', 'nowhere']]]),
    inlineKeys: new Map(),
    hymns: new Map([
      ['seasonal_liturgy_hymns', new Set(['etavenNieskhai'])],
      ['litanies', new Set(['litanyOfTheGospel'])],
      ['fractions', new Set(['litanyOfTheGospel'])],
    ]),
  });
  // Nearby first (litanies is one of the shared schemas), then anywhere.
  assert.deepEqual([...calls.get('procession_of_the_cross')!].sort(), ['bible', 'litanies', 'seasonal_liturgy_hymns']);
});

test('a key in full names its schema; one in capitals is still read as before, a new table of that name too', () => {
  const calls = deriveCalls({
    orderKeys: new Map([
      ['liturgy.raising_of_incense', ['procession_of_the_cross.vespers_procession', 'fractions.fractions', 'VESPERS_PROCESSION', 'FRACTIONS']],
      ['procession_of_the_cross.vespers_procession', ['litanyOfTheGospel']],
    ]),
    inlineKeys: new Map([['psalmody', ['aspasmos.adam_aspasmos']]]),
    hymns: new Map(),
  });
  assert.deepEqual([...calls.get('liturgy')!].sort(), ['fractions', 'procession_of_the_cross']);
  assert.deepEqual([...calls.get('psalmody')!], ['aspasmos']);
});
