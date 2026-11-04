/**
 * The offline books' plan (src/rpc/offline.ts): the hand-kept resources and
 * dependencies of migrations/0004, and on top of them whatever each
 * resource's documents call (src/offlineCalls.ts), run against SQLite with
 * the real content schema of migrations/0001 and 0035, and 0004's plan.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { deriveCalls, ORDER_TABLES } from '../src/offlineCalls.ts';
import { getOfflinePackagePlan, getOfflineTableRows } from '../src/rpc/offline.ts';
import type { ContentContext, D1Database } from '../src/types.ts';

const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

/** A D1 binding over node:sqlite, for the calls the plan makes. */
function d1(db: DatabaseSync): D1Database {
  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[], success: true, meta: {} }),
    raw: async <T>() => [] as T[],
  });
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements) => Promise.all(statements.map((s) => (s as ReturnType<typeof statement>).all())),
  } as D1Database;
}

function content() {
  const db = new DatabaseSync(':memory:');
  db.exec(migration('0001_content_schema.sql'));
  db.exec(migration('0004_offline_plan.sql'));
  // 0035's table (its data copy needs St Basil's rows, and its triggers the revision tables).
  db.exec(migration('0035_commemoration_of_the_saints_hymns.sql').match(/CREATE TABLE "liturgy\.commemoration_of_the_saints_hymns" \([^;]*;/)![0]);
  const hymn = (schemaName: string, key: string, inline: string | null = null) => {
    db.prepare(`INSERT OR IGNORE INTO "${schemaName}.hymn_titles" ("hymn_key", "title_english") VALUES (?, ?)`).run(key, key);
    const line = Number((db.prepare(`SELECT count(*) AS n FROM "${schemaName}.hymn_texts"`).get() as { n: number }).n) + 1;
    db.prepare(`INSERT INTO "${schemaName}.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "item_type", "inline_hymn_key") VALUES (?, ?, ?, ?, ?, ?)`)
      .run(line, key, line, inline ? null : key, inline ? 'Inline' : null, inline);
  };
  const place = (schemaName: string, table: string, rows: [string, string | null][]) => rows.forEach(([key, itemType], index) =>
    db.prepare(`INSERT INTO "${schemaName}.${table}" ("item_order", "hymn_key", "item_type") VALUES (?, ?, ?)`).run(index + 1, key, itemType));
  return { db, hymn, place, context: { db: d1(db) } as unknown as ContentContext };
}

type Plan = { books: { key: string; roots: string[] }[]; dependencies: { resource: string; dependency: string }[]; resources: { id: string; schema: string; tables: string[] }[] };
const dependenciesOf = (plan: Plan, resource: string) => plan.dependencies.filter((d) => d.resource === resource).map((d) => d.dependency);

test("an ALL_CAPS key calls the order table of its name; a hymn's own key, the first schema the reader finds it in", () => {
  assert.equal(ORDER_TABLES.get('fractions'), 'fractions');
  assert.equal(ORDER_TABLES.get('adam_aspasmos'), 'aspasmos');
  assert.equal(ORDER_TABLES.has('hymn_texts'), false);
  const calls = deriveCalls({
    orderKeys: new Map([
      ['liturgy.liturgy_of_st_basil', ['FRACTIONS', 'ADAM_ASPASMOS', 'THREE_GREAT_LITANIES', 'SYNAXARIUM', 'PAULINE_EPISTLE_WITH_COPTIC', 'basilOwn', 'inPublicAndPsalmody', 'nowhere']],
      ['liturgy.sermon_planner', ['riteFrame']],
      ['agpeya.first_hour', ['agpeyaOwn', 'inPublicAndPsalmody']],
    ]),
    inlineKeys: new Map([['liturgy', ['onlyInCanons', 'PROCESSION_OF_THE_CROSS']]]),
    hymns: new Map([
      ['liturgy', new Set(['basilOwn'])],
      ['public', new Set(['inPublicAndPsalmody'])],
      ['psalmody', new Set(['inPublicAndPsalmody'])],
      ['agpeya', new Set(['agpeyaOwn'])],
      ['canons', new Set(['onlyInCanons'])],
      ['gospel_rite', new Set(['riteFrame'])],
    ]),
  });
  assert.deepEqual([...calls.get('liturgy')!].sort(), [
    'aspasmos', 'calendar', 'canons', 'fractions', 'gospel_rite', 'litanies', 'procession_of_the_cross', 'public', 'synaxarium',
  ]);
  // Its own hymns, and the day's readings (the hand-kept plan gives those their Bible), call nothing new;
  // a key found in public is public's, never psalmody's as well.
  assert.deepEqual([...calls.get('agpeya')!], ['public']);
  // A schema with reading_rules of its own reads the Bible by them.
  assert.deepEqual([...calls.get('procession_of_the_cross')!], ['bible']);
  assert.ok(calls.get('holy_week')!.has('bible'));
});

test("a book carries what its documents call, on top of the hand-kept plan, and a schema called gets a package of its own", async () => {
  const { hymn, place, context } = content();
  hymn('liturgy', 'introductionToTheFraction');
  hymn('litanies', 'litanyOfTheGospel');
  hymn('aspasmos', 'adamAspasmosHymn');
  hymn('procession_of_the_cross', 'processionHymn');
  hymn('agpeya', 'agpeyaOwn');
  place('liturgy', 'liturgy_of_st_basil', [['introductionToTheFraction', null], ['FRACTIONS', 'Subdocument'], ['ADAM_ASPASMOS', 'Subdocument'], ['litanyOfTheGospel', null]]);
  place('aspasmos', 'adam_aspasmos', [['adamAspasmosHymn', null], ['PROCESSION_OF_THE_CROSS', 'Subdocument']]);
  place('procession_of_the_cross', 'procession_of_the_cross', [['processionHymn', null]]);
  place('agpeya', 'first_hour', [['agpeyaOwn', null]]);

  const plan = await getOfflinePackagePlan(context) as Plan;
  // The Liturgy carries the Fractions and the Aspasmos it calls; the Aspasmos, the Procession it calls in turn.
  const liturgy = dependenciesOf(plan, 'liturgy');
  for (const called of ['fractions', 'aspasmos', 'litanies']) assert.ok(liturgy.includes(called), `liturgy calls ${called}`);
  assert.deepEqual(dependenciesOf(plan, 'aspasmos'), ['procession_of_the_cross']);
  assert.deepEqual(dependenciesOf(plan, 'procession_of_the_cross'), ['bible']);
  const aspasmos = plan.resources.find((r) => r.id === 'aspasmos');
  assert.deepEqual(aspasmos && { schema: aspasmos.schema, tables: aspasmos.tables }, { schema: 'aspasmos', tables: ['adam_aspasmos', 'hymn_texts', 'hymn_titles', 'vatos_aspasmos'] });
  assert.ok(plan.resources.some((r) => r.id === 'procession_of_the_cross'));
  // Nothing hand-kept is lost, and a book that calls nothing new is as it was.
  assert.deepEqual(dependenciesOf(plan, 'agpeya'), ['public']);
  assert.ok(liturgy.includes('bible') && liturgy.includes('veneration'));
  // In one order, every run, so an unchanged plan never rebuilds the books.
  const pairs = plan.dependencies.map((d) => `${d.resource} ${d.dependency}`);
  assert.deepEqual(pairs, [...pairs].sort());
  assert.deepEqual(plan.resources.map((r) => r.id), plan.resources.map((r) => r.id).sort());

  // The new package's rows are served like any other's; a schema that isn't content is still refused.
  const rows = await getOfflineTableRows(context, 'aspasmos', 'adam_aspasmos', null, 50) as { rows: { hymn_key: string }[] };
  assert.deepEqual(rows.rows.map((row) => row.hymn_key), ['adamAspasmosHymn', 'PROCESSION_OF_THE_CROSS']);
  await assert.rejects(getOfflineTableRows(context, 'offline_content', 'books', null, 50), /not a packaged table/);
  await assert.rejects(getOfflineTableRows(context, 'aspasmos', 'nope', null, 50), /not a packaged table/);
});
