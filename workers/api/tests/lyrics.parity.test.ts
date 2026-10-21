/**
 * Parity: the lyrics studio (src/rpc/creator/lyrics.ts), the Worker against
 * Supabase's own functions (the oracle), over tests/lib/creatorCatalog.ts plus
 * lyrics: published sets, drafts, and a recording and lessons to write for.
 * After each write the lyric tables are compared by their natural keys
 * (track or item, language, line number); each side makes its own row ids.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ALICE, BOB, CAROL, DAVE, ERIN, id, seedCatalog, T1, T2, T3, T4, VERA } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

let oracle: Oracle;
let worker: WorkerSide;
const RECORDING = id(88);
const LESSON = id(89);
const AT = '2026-04-01T08:00:00+00:00';

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  await seed(oracle, worker, [
    ['music.lyric_sets', [
      { id: id(600), track_id: T1, locale: 'en', kind: 'original', sync_precision: 'line', description: 'Sung', publication_status: 'published', created_at: AT, updated_at: AT },
      { id: id(601), track_id: T1, locale: 'ar', kind: 'translation', sync_precision: 'unsynced', publication_status: 'draft', created_at: AT, updated_at: AT },
    ]],
    ['music.lyric_lines', [
      { id: id(610), lyric_set_id: id(600), sequence: 2, start_ms: 1500, end_ms: 2500, text: 'Second', created_at: AT, updated_at: AT },
      { id: id(611), lyric_set_id: id(600), sequence: 1, start_ms: 0, end_ms: null, text: 'First', created_at: AT, updated_at: AT },
    ]],
    ['music.lyric_edit_drafts', [
      { track_id: T4, locale: 'en', sync_precision: 'line', description: 'Draft', lines: [{ id: null, sequence: 1, startMs: 0, endMs: null, text: 'Old' }], created_by: ALICE, updated_by: ALICE, created_at: AT, updated_at: AT },
    ]],
    ['learning.lessons', [
      { id: id(620), lesson_set_id: id(81), media_asset_id: id(113), audio_asset_id: id(109), media_type: 'video', title: 'Second lesson', sort_order: 5, created_at: AT, updated_at: '2026-04-02T08:00:00+00:00' },
    ]],
  ]);
});
after(() => oracle.close());

const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/;

function same(pg: PgAnswer, w: Answer, what: string): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)?.slice(0, 300)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code (${w.error!.message})`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)?.slice(0, 300)}`);
    assert.deepEqual(normalize(w.data, seeded), normalize(pg.data, seeded), what);
  }
}

/** The lyric tables on both sides, by natural keys. */
async function sameTables(what: string): Promise<void> {
  const queries: [string, string][] = [
    [`select s.track_id::text as owner, s.locale, s.kind::text as kind, s.sync_precision::text as sync, s.description, s.publication_status::text as status, s.created_by::text as by,
        l.sequence, l.start_ms, l.end_ms, l.text from music.lyric_sets s left join music.lyric_lines l on l.lyric_set_id = s.id`,
     `SELECT s."track_id" AS owner, s."locale", s."kind" AS kind, s."sync_precision" AS sync, s."description", s."publication_status" AS status, s."created_by" AS by,
        l."sequence", l."start_ms", l."end_ms", l."text" FROM "music.lyric_sets" s LEFT JOIN "music.lyric_lines" l ON l."lyric_set_id" = s."id"`],
    [`select d.track_id::text as owner, d.locale, d.sync_precision::text as sync, d.description, d.lines::text as lines, d.created_by::text as by, d.updated_by::text as updater from music.lyric_edit_drafts d`,
     `SELECT d."track_id" AS owner, d."locale", d."sync_precision" AS sync, d."description", d."lines" AS lines, d."created_by" AS by, d."updated_by" AS updater FROM "music.lyric_edit_drafts" d`],
    [`select s.item_kind::text as kind, coalesce(s.album_recording_id, s.lesson_id)::text as owner, s.locale, s.sync_precision::text as sync, s.description, s.publication_status::text as status,
        l.sequence, l.start_ms, l.end_ms, l.text from learning.lyric_sets s left join learning.lyric_lines l on l.lyric_set_id = s.id`,
     `SELECT s."item_kind" AS kind, coalesce(s."album_recording_id", s."lesson_id") AS owner, s."locale", s."sync_precision" AS sync, s."description", s."publication_status" AS status,
        l."sequence", l."start_ms", l."end_ms", l."text" FROM "learning.lyric_sets" s LEFT JOIN "learning.lyric_lines" l ON l."lyric_set_id" = s."id"`],
    [`select d.item_kind::text as kind, d.album_recording_id::text as recording, d.lesson_id::text as lesson, d.locale, d.sync_precision::text as sync, d.description, d.lines::text as lines from learning.lyric_edit_drafts d`,
     `SELECT d."item_kind" AS kind, d."album_recording_id" AS recording, d."lesson_id" AS lesson, d."locale", d."sync_precision" AS sync, d."description", d."lines" AS lines FROM "learning.lyric_edit_drafts" d`],
  ];
  for (const [pgSql, sqliteSql] of queries) {
    const clean = (row: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' && TIMESTAMP.test(v) ? '<ts>' : typeof v === 'bigint' ? Number(v) : v])));
    const pg = (await oracle.sql<Record<string, unknown>>(pgSql)).map(clean).sort();
    const lite = (worker.db.prepare(sqliteSql).all() as Record<string, unknown>[]).map((row) => clean({ ...row })).sort();
    assert.deepEqual(lite, pg, `${what}: ${sqliteSql.slice(0, 60)}`);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}) {
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, `${fn}(${JSON.stringify(args).slice(0, 200)}) as ${user ?? 'anon'}`);
  await sameTables(`after ${fn}`);
  return pg;
}

test('the editor lists and the drafts as they stand', async () => {
  await sameTables('seed');
  for (const user of [ALICE, DAVE, VERA, ERIN, CAROL, BOB]) {
    await both(user, 'get_lyric_editor_tracks');
    await both(user, 'get_learning_lyric_editor_items');
    for (const track of [T1, T2, T4, id(699)]) for (const locale of ['en', 'ar', 'xx']) await both(user, 'get_track_lyric_language_draft', { p_track_id: track, p_locale: locale });
    for (const [kind, item] of [['album_recording', RECORDING], ['lesson', LESSON], ['lesson', RECORDING]]) {
      for (const locale of ['en', 'ar']) await both(user, 'get_learning_lyric_language_draft', { p_item_kind: kind, p_item_id: item, p_locale: locale });
    }
  }
});

const LINES = [
  { id: 'l1', startMs: 0, endMs: 900, text: 'One' },
  { startMs: ' 1200 ', text: 'Two' },
  { id: '', startMs: '', endMs: null, text: null },
  { startMs: 2500, endMs: '3000', text: 'Four', extra: true },
  'not an object',
];

test('saving drafts', async () => {
  await both(ALICE, 'save_track_lyric_language_draft', { p_track_id: T2, p_locale: 'en', p_description: '  Verse  ', p_lines: LINES });
  await both(ALICE, 'save_track_lyric_language_draft', { p_track_id: T2, p_locale: 'en', p_description: '   ', p_lines: [{ text: 'Replaced' }] });
  await both(ALICE, 'save_track_lyric_language_draft', { p_track_id: T2, p_locale: 'fr' });
  for (const [args, what] of [
    [{ p_track_id: T2, p_locale: 'xx', p_lines: [] }, 'unknown locale'],
    [{ p_track_id: T2, p_locale: 'en', p_lines: { not: 'an array' } }, 'not an array'],
    [{ p_track_id: T2, p_locale: 'en', p_lines: null }, 'null lines'],
    [{ p_track_id: T2, p_locale: 'en', p_lines: [{ startMs: '1.5' }] }, 'a fraction'],
    [{ p_track_id: T2, p_locale: 'en', p_lines: [{ startMs: 'abc' }] }, 'not a number'],
    [{ p_track_id: T2, p_locale: 'en', p_lines: [{ startMs: '99999999999999999999' }] }, 'too large'],
    [{ p_track_id: T2, p_locale: 'en', p_lines: [{ endMs: '0x1F' }] }, 'hex'],
  ] as const) await both(ALICE, 'save_track_lyric_language_draft', args);
  await both(VERA, 'save_track_lyric_language_draft', { p_track_id: T2, p_locale: 'en', p_lines: [] });
  await both(ERIN, 'save_track_lyric_language_draft', { p_track_id: T2, p_locale: 'en', p_lines: [] });

  for (const precision of ['line', 'unsynced', 'word', null]) {
    await both(DAVE, 'save_track_lyric_studio_draft_v2', { p_track_id: T3, p_sync_precision: precision, p_languages: [
      { locale: 'en', description: ' Sung ', lines: LINES.slice(0, 4) }, { locale: 'ar', lines: [{ text: 'واحد', startMs: 5 }] },
    ] });
  }
  for (const languages of [[], [{ locale: 'xx' }], [{ locale: 'en' }, { locale: 'nope' }], [{ locale: 'en', lines: 'x' }], null, { locale: 'en' }, [{ locale: 'en', lines: [{ startMs: '1.5' }] }]]) {
    await both(DAVE, 'save_track_lyric_studio_draft_v2', { p_track_id: T3, p_sync_precision: 'line', p_languages: languages });
  }

  for (const [kind, item, precision] of [['album_recording', RECORDING, 'line'], ['lesson', LESSON, 'unsynced'], ['lesson', LESSON, 'line'], ['album_recording', RECORDING, null], ['lesson', id(620), 'unsynced']]) {
    await both(ALICE, 'save_learning_lyric_studio_draft', { p_item_kind: kind, p_item_id: item, p_sync_precision: precision, p_languages: [
      { locale: 'en', description: 'Hymn', lines: LINES.slice(0, 4) }, { locale: 'en', lines: [{ text: 'Twice' }] },
    ] });
  }
  for (const languages of [null, [], [{ locale: 'xx' }], 'text']) {
    await both(ALICE, 'save_learning_lyric_studio_draft', { p_item_kind: 'album_recording', p_item_id: RECORDING, p_sync_precision: 'line', p_languages: languages });
  }
  await both(BOB, 'save_learning_lyric_studio_draft', { p_item_kind: 'lesson', p_item_id: LESSON, p_sync_precision: 'unsynced', p_languages: [] });
});

test('publishing drafts', async () => {
  // T4 has an old draft; T3 has the studio's; T1 has a published set to replace.
  await both(ALICE, 'save_track_lyric_studio_draft_v2', { p_track_id: T1, p_sync_precision: 'line', p_languages: [{ locale: 'en', lines: [{ startMs: 10, text: 'New one' }, { startMs: 20, endMs: 30, text: 'New two' }] }] });
  for (const [track, locales, precision] of [
    [T1, ['en'], 'line'], [T4, ['en', 'en'], 'line'], [T3, ['en'], 'line'], [T3, ['ar', 'fr'], 'line'], [T3, ['ar'], 'unsynced'], [T3, null, 'line'],
    [T3, [], 'line'], [T2, ['en'], 'word'], [T2, ['en'], undefined],
  ] as const) {
    await both(ALICE, 'publish_track_lyric_languages_v2', { p_track_id: track, p_locales: locales, ...(precision === undefined ? {} : { p_sync_precision: precision }) });
  }
  await both(VERA, 'publish_track_lyric_languages_v2', { p_track_id: T2, p_locales: ['en'] });

  for (const [kind, item, precision, locales] of [
    ['album_recording', RECORDING, 'line', ['en']], ['album_recording', RECORDING, 'unsynced', ['en']], ['lesson', LESSON, 'line', ['en']],
    ['lesson', LESSON, 'unsynced', ['en', 'ar']], ['lesson', LESSON, 'unsynced', ['en']], ['lesson', id(620), 'unsynced', ['en']], ['lesson', id(620), 'unsynced', null],
  ] as const) {
    await both(ALICE, 'publish_learning_lyric_languages', { p_item_kind: kind, p_item_id: item, p_sync_precision: precision, p_locales: locales });
  }
  for (const user of [ALICE, CAROL]) {
    await both(user, 'get_track_lyric_language_draft', { p_track_id: T1, p_locale: 'en' });
    await both(user, 'get_learning_lyric_language_draft', { p_item_kind: 'lesson', p_item_id: id(620), p_locale: 'en' });
    await both(user, 'get_learning_lyric_editor_items');
  }
});
