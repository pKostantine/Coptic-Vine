/**
 * The lyrics studio (CV-Artists): ports of public.get_lyric_editor_tracks,
 * get_track_lyric_language_draft, save_track_lyric_language_draft,
 * save_track_lyric_studio_draft_v2, publish_track_lyric_languages_v2, and
 * their learning twins get_learning_lyric_editor_items,
 * get_learning_lyric_language_draft, save_learning_lyric_studio_draft and
 * publish_learning_lyric_languages (schema/pg-user-schema.sql), checked by
 * tests/lyrics.parity.test.ts.
 *
 * Drafts keep every row as typed; publishing replaces a language's lines
 * with the draft's. Each call checks everything first, then writes in one
 * batch, as the Postgres function ran in one transaction.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { jsonbText, now, PgError, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import type { D1PreparedStatement } from '../../types.ts';
import { cantorEditable, lessonTitle } from '../learning/shared.ts';
import { ADMIN, alias, all, canEditAccount, epochVersion, first, ME, meParams, order, payload, requireAuth, viewer, type Row } from './shared.ts';

const LOCALES = t('media', 'locales');

/** jsonb ->> key on a JSON value: a string as it is, null as null, anything else as jsonb prints it. */
function arrowText(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entry = (value as Row)[key];
  if (entry === undefined || entry === null) return null;
  return typeof entry === 'string' ? entry : jsonbText(entry);
}

/** text::bigint, as int8in reads it (spaces around, a sign, decimal or 0x/0o/0b digits, underscores between). */
function toBigint(text: string): number {
  const trimmed = text.replace(/^[ \t\n\r\v\f]+|[ \t\n\r\v\f]+$/g, '');
  const match = /^([+-]?)(0[xX][0-9a-fA-F]+(?:_[0-9a-fA-F]+)*|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|[0-9]+(?:_[0-9]+)*)$/.exec(trimmed);
  if (!match) raise(`invalid input syntax for type bigint: "${text}"`, '22P02');
  const value = BigInt(match![2].replace(/_/g, '')) * (match![1] === '-' ? -1n : 1n);
  if (value > 9223372036854775807n || value < -9223372036854775808n) raise(`value "${text}" is out of range for type bigint`, '22003');
  return Number(value);
}

const blank = (text: string | null) => text == null || text.replace(/^ +| +$/g, '') === '';
/** nullif(trim(x), ''). */
const trimmedOrNull = (text: string | null) => (text == null ? null : (text.replace(/^ +| +$/g, '') || null));

/** A draft's rows as the studio sent them, numbered; times kept unless unsynced. */
function draftLines(lines: unknown, unsynced = false): Row[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((line, i) => ({
    id: (arrowText(line, 'id') || null),
    sequence: i + 1,
    startMs: unsynced || blank(arrowText(line, 'startMs')) ? null : toBigint(arrowText(line, 'startMs')!),
    endMs: unsynced || blank(arrowText(line, 'endMs')) ? null : toBigint(arrowText(line, 'endMs')!),
    text: arrowText(line, 'text') ?? '',
  }));
}

/** jsonb_typeof(x) <> 'array': not an array, a JSON null included (SQL null is checked by each caller). */
const notArray = (value: unknown) => !Array.isArray(value);

async function localeEnabled(ctx: ApiContext, locale: string | null): Promise<boolean> {
  return Boolean(await first(ctx, `SELECT 1 AS yes FROM ${LOCALES} WHERE ${col('code')} = ? AND ${col('enabled')} = 1`, locale));
}

/** FOREACH … IN ARRAY: the elements, or Postgres's error for a null array. */
function eachOf(locales: (string | null)[] | null): (string | null)[] {
  if (locales == null) throw new PgError('22004', 'FOREACH expression must not be null', 400);
  return locales;
}

/** Inserts of lyric lines, in statements small enough for D1's 100 bound values. */
function insertLines(ctx: ApiContext, table: string, setId: string, lines: Row[], timed: boolean): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  const at = now();
  for (let i = 0; i < lines.length; i += 15) {
    const chunk = lines.slice(i, i + 15);
    statements.push(ctx.db.prepare(`INSERT INTO ${table} (${['id', 'lyric_set_id', 'sequence', 'start_ms', 'end_ms', 'text', 'created_at'].map(col).join(', ')}) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`)
      .bind(...chunk.flatMap((line, j) => {
        const start = timed ? toBigint(arrowText(line, 'startMs') ?? '') : null;
        const end = timed && !blank(arrowText(line, 'endMs')) ? toBigint(arrowText(line, 'endMs')!) : null;
        return [crypto.randomUUID(), setId, i + j + 1, start, end, arrowText(line, 'text') ?? '', at];
      })));
  }
  return statements;
}

/** Publishing a draft: every requested language must have rows, and with line sync every row a start time. */
function checkDraft(draft: Row | undefined, precision: string | null): unknown[] {
  const lines = draft?.lines == null ? null : JSON.parse(draft.lines as string) as unknown[];
  if (lines == null || lines.length === 0) raise('Add lyric lines before publishing', '22023');
  if (precision === 'line' && lines!.some((line) => blank(arrowText(line, 'startMs')))) raise('Every lyric row needs a start time', '22023');
  // The casts the insert makes fail before anything is written.
  if (precision === 'line') for (const line of lines!) { toBigint(arrowText(line, 'startMs')!); if (!blank(arrowText(line, 'endMs'))) toBigint(arrowText(line, 'endMs')!); }
  return lines!;
}

/** private.lyric_artwork_json(asset). */
async function artwork(ctx: ApiContext, assetId: unknown): Promise<Row | null> {
  if (assetId == null) return null;
  const asset = await first(ctx, `SELECT * FROM ${t('media', 'media_assets')} WHERE ${col('id')} = ?`, assetId);
  return asset ? { bucket: asset.bucket, path: asset.path, version: epochVersion(asset.updated_at) } : null;
}

/** private.creator_account_is_mine(account): a member who may edit (an admin, as such, isn't). */
function accountIsMine(account: string): string {
  const m = alias('mine');
  return `EXISTS (SELECT 1 FROM ${t('creator', 'creator_account_members')} ${m} WHERE ${m}.${col('creator_account_id')} = ${account} AND ${m}.${col('user_id')} = (SELECT ${col('uid')} FROM ${col('me')}) AND ${m}.${col('role')} IN ('owner', 'manager', 'editor', 'uploader'))`;
}

const lyricLine = (line: Row) => ({ id: line.id, sequence: line.sequence, startMs: line.start_ms, endMs: line.end_ms, text: line.text });

// ── Music ─────────────────────────────────────────────────────────────────

/** private.music_track_is_editable(track). */
async function trackEditable(ctx: ApiContext, trackId: string): Promise<boolean> {
  const v = await viewer(ctx);
  return Boolean(await first(ctx, `${ME} SELECT 1 AS yes FROM ${t('music', 'tracks')} tr WHERE tr.${col('id')} = ? AND ${canEditAccount(`tr.${col('owner_creator_account_id')}`)}`, ...meParams(v), trackId));
}

export async function getLyricEditorTracks(ctx: ApiContext): Promise<unknown> {
  requireAuth(ctx);
  const v = await viewer(ctx);
  const tracks = await all(ctx, `${ME} SELECT tr.*, a.${col('id')} AS asset_id, a.${col('provider')} AS asset_provider, a.${col('bucket')} AS asset_bucket, a.${col('path')} AS asset_path,
      a.${col('mime_type')} AS asset_mime, a.${col('duration_ms')} AS asset_duration, a.${col('publication_status')} AS asset_status
    FROM ${t('music', 'tracks')} tr LEFT JOIN ${t('media', 'media_assets')} a ON a.${col('id')} = tr.${col('media_asset_id')}
    WHERE ${accountIsMine(`tr.${col('owner_creator_account_id')}`)}`, ...meParams(v));
  tracks.sort((a, b) => order.descNullsLast(a.updated_at, b.updated_at) || order.text(a.title, b.title));
  return payload(await Promise.all(tracks.map(async (tr) => {
    // The release it first appeared on.
    const placed = await first(ctx, `SELECT r.${col('id')} AS id, r.${col('title')} AS title, r.${col('release_type')} AS release_type, r.${col('cover_asset_id')} AS cover,
        rt.${col('disc_number')} AS disc, rt.${col('track_number')} AS position
      FROM ${t('music', 'release_tracks')} rt JOIN ${t('music', 'releases')} r ON r.${col('id')} = rt.${col('release_id')}
      WHERE rt.${col('track_id')} = ? ORDER BY r.${col('created_at')}, r.${col('id')} LIMIT 1`, tr.id);
    return {
      id: tr.id, title: tr.title, subtitle: tr.subtitle, durationMs: tr.duration_ms, publicationStatus: tr.publication_status,
      mediaAsset: tr.asset_id == null ? null : {
        id: tr.asset_id, provider: tr.asset_provider, bucket: tr.asset_bucket, path: tr.asset_path, mimeType: tr.asset_mime, durationMs: tr.asset_duration, publicationStatus: tr.asset_status,
      },
      collection: placed ? { id: placed.id, kind: 'release', title: placed.title, releaseType: placed.release_type, artwork: await artwork(ctx, placed.cover) } : null,
      disc: placed?.disc ?? null, position: placed?.position ?? null,
    };
  })));
}

export async function getTrackLyricLanguageDraft(ctx: ApiContext, trackId: string, locale: string | null): Promise<unknown> {
  requireAuth(ctx);
  if (!(await trackEditable(ctx, trackId))) raise('Track not found or not editable', '42501');
  const [draft, set] = await Promise.all([
    first(ctx, `SELECT * FROM ${t('music', 'lyric_edit_drafts')} WHERE ${col('track_id')} = ? AND ${col('locale')} = ?`, trackId, locale),
    first(ctx, `SELECT * FROM ${t('music', 'lyric_sets')} WHERE ${col('track_id')} = ? AND ${col('locale')} = ? AND ${col('kind')} = 'original'`, trackId, locale),
  ]);
  if (draft) {
    return payload({ id: set?.id ?? null, trackId, locale, description: draft.description, publicationStatus: set?.publication_status ?? 'draft', hasDraft: true,
      syncPrecision: draft.sync_precision, lines: JSON.parse(draft.lines as string) });
  }
  if (!set) return null;
  const lines = await all(ctx, `SELECT * FROM ${t('music', 'lyric_lines')} WHERE ${col('lyric_set_id')} = ?`, set.id);
  lines.sort((a, b) => order.number(a.sequence, b.sequence));
  return payload({ id: set.id, trackId, locale, description: set.description, publicationStatus: set.publication_status, hasDraft: false,
    syncPrecision: set.sync_precision, lines: lines.map(lyricLine) });
}

export async function saveTrackLyricLanguageDraft(ctx: ApiContext, trackId: string, locale: string | null, description: string | null, lines: unknown): Promise<unknown> {
  const userId = requireAuth(ctx);
  if (!(await trackEditable(ctx, trackId))) raise('Track not found or not editable', '42501');
  if (!(await localeEnabled(ctx, locale))) raise('Unsupported or disabled lyric locale', '22023');
  if (lines == null || notArray(lines)) raise('p_lines must be a JSON array', '22023');
  const normalized = draftLines(lines);
  const at = now();
  await ctx.db.prepare(`INSERT INTO ${t('music', 'lyric_edit_drafts')} (${['track_id', 'locale', 'description', 'lines', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (${col('track_id')}, ${col('locale')}) DO UPDATE SET ${col('description')} = excluded.${col('description')}, ${col('lines')} = excluded.${col('lines')},
      ${col('updated_by')} = ?, ${col('updated_at')} = ?`)
    .bind(trackId, locale, trimmedOrNull(description), jsonbText(normalized), userId, userId, at, at, userId, at).run();
  const set = await first(ctx, `SELECT * FROM ${t('music', 'lyric_sets')} WHERE ${col('track_id')} = ? AND ${col('locale')} = ? AND ${col('kind')} = 'original'`, trackId, locale);
  return payload({ id: set?.id ?? null, trackId, locale, description: trimmedOrNull(description), publicationStatus: set?.publication_status ?? 'draft', hasDraft: true, lines: normalized });
}

/** The languages a studio save sends: each checked, then its rows normalized, in order. */
async function studioLanguages(ctx: ApiContext, languages: unknown, precision: string | null, localeError: string) {
  const out: { locale: string | null; description: string | null; lines: Row[] }[] = [];
  for (const language of languages as unknown[]) {
    const locale = arrowText(language, 'locale');
    if (!(await localeEnabled(ctx, locale))) raise(localeError, '22023');
    // jsonb_array_elements(coalesce(language->'lines', '[]')): a missing key is none; anything but an array is refused.
    const lines = language && typeof language === 'object' && !Array.isArray(language) && (language as Row).lines !== undefined ? (language as Row).lines : [];
    if (!Array.isArray(lines)) raise(`cannot extract elements from ${lines && typeof lines === 'object' ? 'an object' : 'a scalar'}`, '22023');
    out.push({ locale, description: trimmedOrNull(arrowText(language, 'description')), lines: draftLines(lines, precision === 'unsynced') });
  }
  return out;
}

export async function saveTrackLyricStudioDraftV2(ctx: ApiContext, trackId: string, precision: string | null, languages: unknown): Promise<unknown> {
  const userId = requireAuth(ctx);
  if (!(await trackEditable(ctx, trackId))) raise('Track not found or not editable', '42501');
  if (precision != null && !['unsynced', 'line'].includes(precision)) raise('Unsupported lyric sync precision', '22023');
  if (languages == null || notArray(languages)) raise('p_languages must be a JSON array', '22023');
  const saved = await studioLanguages(ctx, languages, precision, 'Unsupported or disabled lyric locale');
  const at = now();
  if (saved.length) {
    precisionNotNull(precision, 'lyric_edit_drafts');
    await ctx.db.batch(saved.map((language) => ctx.db.prepare(`INSERT INTO ${t('music', 'lyric_edit_drafts')} (${['track_id', 'locale', 'sync_precision', 'description', 'lines', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (${col('track_id')}, ${col('locale')}) DO UPDATE SET ${col('sync_precision')} = excluded.${col('sync_precision')}, ${col('description')} = excluded.${col('description')},
        ${col('lines')} = excluded.${col('lines')}, ${col('updated_by')} = ?, ${col('updated_at')} = ?`)
      .bind(trackId, language.locale, precision, language.description, jsonbText(language.lines), userId, userId, at, at, userId, at)));
  }
  return payload({
    trackId, savedAt: at,
    languages: saved.map((l) => ({ trackId, locale: l.locale, description: l.description, publicationStatus: 'draft', hasDraft: true, syncPrecision: precision, lines: l.lines })),
  });
}

export async function publishTrackLyricLanguagesV2(ctx: ApiContext, trackId: string, locales: (string | null)[] | null, precision: string | null): Promise<unknown> {
  const userId = requireAuth(ctx);
  if (!(await trackEditable(ctx, trackId))) raise('Track not editable', '42501');
  if (precision != null && !['unsynced', 'line'].includes(precision)) raise('Unsupported lyric sync precision', '22023');
  const statements: D1PreparedStatement[] = [];
  const done = new Set<string | null>();
  const at = now();
  for (const locale of eachOf(locales)) {
    // A language already published in this call has no draft left.
    const draft = done.has(locale) ? undefined : (await first(ctx, `SELECT * FROM ${t('music', 'lyric_edit_drafts')} WHERE ${col('track_id')} = ? AND ${col('locale')} = ?`, trackId, locale)) ?? undefined;
    const lines = checkDraft(draft, precision);
    precisionNotNull(precision, 'lyric_sets');
    const existing = await first(ctx, `SELECT ${col('id')} FROM ${t('music', 'lyric_sets')} WHERE ${col('track_id')} = ? AND ${col('locale')} = ? AND ${col('kind')} = 'original'`, trackId, locale);
    const setId = (existing?.id as string | undefined) ?? crypto.randomUUID();
    if (!existing) {
      statements.push(ctx.db.prepare(`INSERT INTO ${t('music', 'lyric_sets')} (${['id', 'track_id', 'locale', 'kind', 'sync_precision', 'description', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, 'original', ?, ?, 'published', ?, ?, ?, ?)`).bind(setId, trackId, locale, precision, draft!.description, userId, userId, at, at));
    } else {
      statements.push(
        ctx.db.prepare(`UPDATE ${t('music', 'lyric_sets')} SET ${col('sync_precision')} = ?, ${col('description')} = ?, ${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
          .bind(precision, draft!.description, userId, at, setId),
        ctx.db.prepare(`DELETE FROM ${t('music', 'lyric_lines')} WHERE ${col('lyric_set_id')} = ?`).bind(setId),
      );
    }
    statements.push(...insertLines(ctx, t('music', 'lyric_lines'), setId, lines as Row[], precision === 'line'));
    statements.push(ctx.db.prepare(`DELETE FROM ${t('music', 'lyric_edit_drafts')} WHERE ${col('track_id')} = ? AND ${col('locale')} = ?`).bind(trackId, locale));
    done.add(locale);
  }
  if (statements.length) await ctx.db.batch(statements);
  return payload({ trackId, locales, publishedAt: at });
}

// ── Learning ──────────────────────────────────────────────────────────────

/** private.learning_album_is_editable / learning_lesson_set_is_editable, for a collection row alias. */
const collectionEditable = (row: string) => `(${ADMIN} = 1 OR (${row}.${col('owner_creator_account_id')} IS NOT NULL AND ${canEditAccount(`${row}.${col('owner_creator_account_id')}`)}) OR ${cantorEditable(`${row}.${col('cantor_id')}`)})`;

/** private.learning_lyric_item_is_editable(kind, item). */
async function itemEditable(ctx: ApiContext, kind: string, itemId: string): Promise<boolean> {
  const v = await viewer(ctx);
  const sql = kind === 'album_recording'
    ? `${ME} SELECT 1 AS yes FROM ${t('learning', 'album_recordings')} r JOIN ${t('learning', 'albums')} c ON c.${col('id')} = r.${col('album_id')} WHERE r.${col('id')} = ? AND ${collectionEditable('c')}`
    : `${ME} SELECT 1 AS yes FROM ${t('learning', 'lessons')} l JOIN ${t('learning', 'lesson_sets')} c ON c.${col('id')} = l.${col('lesson_set_id')} WHERE l.${col('id')} = ? AND ${collectionEditable('c')}`;
  return Boolean(await first(ctx, sql, ...meParams(v), itemId));
}

/** private.learning_collection_is_mine(owner, cantor): the owner account is mine, else the cantor (its account or a granted one) is. */
function collectionIsMine(row: string): string {
  const c = alias('mine_cantor');
  const p = alias('mine_permission');
  return `(CASE WHEN ${row}.${col('owner_creator_account_id')} IS NOT NULL THEN ${accountIsMine(`${row}.${col('owner_creator_account_id')}`)}
    ELSE (EXISTS (SELECT 1 FROM ${t('learning', 'cantors')} ${c} WHERE ${c}.${col('id')} = ${row}.${col('cantor_id')} AND ${accountIsMine(`${c}.${col('owner_creator_account_id')}`)})
      OR EXISTS (SELECT 1 FROM ${t('learning', 'cantor_permissions')} ${p} WHERE ${p}.${col('cantor_id')} = ${row}.${col('cantor_id')} AND ${accountIsMine(`${p}.${col('creator_account_id')}`)})) END)`;
}

const learningAsset = (prefix: string, row: Row) => ({
  id: row[`${prefix}id`], provider: row[`${prefix}provider`], bucket: row[`${prefix}bucket`], path: row[`${prefix}path`], mimeType: row[`${prefix}mime_type`],
  durationMs: row[`${prefix}duration_ms`], publicationStatus: row[`${prefix}publication_status`],
});

export async function getLearningLyricEditorItems(ctx: ApiContext): Promise<unknown> {
  requireAuth(ctx);
  const v = await viewer(ctx);
  const assetColumns = (a: string, prefix: string) => ['id', 'provider', 'bucket', 'path', 'mime_type', 'duration_ms', 'publication_status'].map((c) => `${a}.${col(c)} AS ${prefix}${c}`).join(', ');
  const [recordings, lessons] = await Promise.all([
    all(ctx, `${ME} SELECT r.*, c.${col('title')} AS collection_title, c.${col('cover_asset_id')} AS cover, ${assetColumns('a', 'a_')}
      FROM ${t('learning', 'album_recordings')} r JOIN ${t('learning', 'albums')} c ON c.${col('id')} = r.${col('album_id')} JOIN ${t('media', 'media_assets')} a ON a.${col('id')} = r.${col('media_asset_id')}
      WHERE ${collectionIsMine('c')}`, ...meParams(v)),
    all(ctx, `${ME} SELECT l.*, c.${col('title')} AS collection_title, c.${col('cover_asset_id')} AS cover, ${assetColumns('a', 'a_')}, ${assetColumns('au', 'au_')}
      FROM ${t('learning', 'lessons')} l JOIN ${t('learning', 'lesson_sets')} c ON c.${col('id')} = l.${col('lesson_set_id')} JOIN ${t('media', 'media_assets')} a ON a.${col('id')} = l.${col('media_asset_id')}
      LEFT JOIN ${t('media', 'media_assets')} au ON au.${col('id')} = l.${col('audio_asset_id')}
      WHERE ${collectionIsMine('c')}`, ...meParams(v)),
  ]);
  // Each one's place in its collection, by sort order and id.
  const place = (rows: Row[], key: string) => {
    const out = new Map<unknown, number>();
    const groups = new Map<unknown, Row[]>();
    for (const row of rows) groups.set(row[key], [...(groups.get(row[key]) ?? []), row]);
    for (const group of groups.values()) [...group].sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.id, b.id)).forEach((row, i) => out.set(row.id, i + 1));
    return out;
  };
  const recordingPlace = place(recordings, 'album_id');
  const lessonPlace = place(lessons, 'lesson_set_id');
  const items = [
    ...await Promise.all(recordings.map(async (r) => ({ updated: r.updated_at, title: r.title, item: {
      id: r.id, targetType: 'learning_album_recording', title: r.title, subtitle: r.collection_title, durationMs: r.duration_ms ?? r.a_duration_ms,
      publicationStatus: r.publication_status, maxSyncPrecision: 'line', mediaAsset: learningAsset('a_', r),
      collection: { id: r.album_id, kind: 'learning_album', title: r.collection_title, artwork: await artwork(ctx, r.cover) }, position: recordingPlace.get(r.id),
    } }))),
    ...await Promise.all(lessons.map(async (l) => {
      const number = lessonPlace.get(l.id)!;
      const audio = l.au_id != null;
      const pick = (c: string) => (audio ? l[`au_${c}`] : null) ?? l[`a_${c}`];
      return { updated: l.updated_at, title: lessonTitle('en', number), item: {
        id: l.id, targetType: 'learning_lesson', title: lessonTitle('en', number), subtitle: l.collection_title, lessonSetId: l.lesson_set_id, lessonNumber: number,
        mediaType: l.media_type, durationMs: l.duration_ms ?? l.au_duration_ms ?? l.a_duration_ms, publicationStatus: l.publication_status, maxSyncPrecision: 'unsynced',
        mediaAsset: { id: pick('id'), provider: pick('provider'), bucket: pick('bucket'), path: pick('path'), mimeType: pick('mime_type'), durationMs: pick('duration_ms'), publicationStatus: pick('publication_status') },
        collection: { id: l.lesson_set_id, kind: 'lesson_set', title: l.collection_title, artwork: await artwork(ctx, l.cover) }, position: number,
      } };
    })),
  ];
  items.sort((a, b) => order.descNullsLast(a.updated, b.updated) || order.text(a.title, b.title));
  return payload(items.map((i) => i.item));
}

const ITEM_KEY = `coalesce(${col('album_recording_id')}, ${col('lesson_id')})`;

export async function getLearningLyricLanguageDraft(ctx: ApiContext, kind: string, itemId: string, locale: string | null): Promise<unknown> {
  requireAuth(ctx);
  if (!(await itemEditable(ctx, kind, itemId))) raise('Learning item not editable', '42501');
  const [draft, set] = await Promise.all([
    first(ctx, `SELECT * FROM ${t('learning', 'lyric_edit_drafts')} WHERE ${col('item_kind')} = ? AND ${ITEM_KEY} = ? AND ${col('locale')} = ?`, kind, itemId, locale),
    first(ctx, `SELECT * FROM ${t('learning', 'lyric_sets')} WHERE ${col('item_kind')} = ? AND ${ITEM_KEY} = ? AND ${col('locale')} = ?`, kind, itemId, locale),
  ]);
  if (draft && draft.locale != null) {
    return payload({ id: set?.id ?? null, trackId: itemId, locale, description: draft.description, publicationStatus: set?.publication_status ?? 'draft', hasDraft: true,
      syncPrecision: draft.sync_precision, lines: JSON.parse(draft.lines as string) });
  }
  if (!set) return null;
  const lines = await all(ctx, `SELECT * FROM ${t('learning', 'lyric_lines')} WHERE ${col('lyric_set_id')} = ?`, set.id);
  lines.sort((a, b) => order.number(a.sequence, b.sequence));
  return payload({ id: set.id, trackId: itemId, locale, description: set.description, publicationStatus: set.publication_status, hasDraft: false,
    syncPrecision: set.sync_precision, lines: lines.map(lyricLine) });
}

function learningKinds(kind: string, precision: string | null): void {
  if (kind === 'lesson' && precision != null && precision !== 'unsynced') raise('Lesson sets support unsynced lyrics only', '22023');
  if (precision != null && !['unsynced', 'line'].includes(precision)) raise('Unsupported lyric sync precision', '22023');
}

/** Writing a null sync precision: the NOT NULL column refuses it, as Postgres words it. */
function precisionNotNull(precision: string | null, table: string): void {
  if (precision == null) raise(`null value in column "sync_precision" of relation "${table}" violates not-null constraint`, '23502');
}

export async function saveLearningLyricStudioDraft(ctx: ApiContext, kind: string, itemId: string, precision: string | null, languages: unknown): Promise<unknown> {
  const userId = requireAuth(ctx);
  if (!(await itemEditable(ctx, kind, itemId))) raise('Learning item not editable', '42501');
  learningKinds(kind, precision);
  // A null list isn't refused (jsonb_typeof(null) is null): nothing is saved.
  if (languages !== null && notArray(languages)) raise('p_languages must be a JSON array', '22023');
  const saved = languages == null ? [] : await studioLanguages(ctx, languages, precision, 'Unsupported lyric locale');
  if (saved.length) precisionNotNull(precision, 'lyric_edit_drafts');
  const at = now();
  const recording = kind === 'album_recording' ? itemId : null;
  const lesson = kind === 'lesson' ? itemId : null;
  const statements = saved.flatMap((language) => [
    ctx.db.prepare(`INSERT INTO ${t('learning', 'lyric_edit_drafts')} (${['item_kind', 'album_recording_id', 'lesson_id', 'locale', 'sync_precision', 'description', 'lines', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
      .bind(kind, recording, lesson, language.locale, precision, language.description, jsonbText(language.lines), userId, userId, at, at),
    ctx.db.prepare(`UPDATE ${t('learning', 'lyric_edit_drafts')} SET ${col('sync_precision')} = ?, ${col('description')} = ?, ${col('lines')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ?
      WHERE ${col('item_kind')} = ? AND ${ITEM_KEY} = ? AND ${col('locale')} = ?`)
      .bind(precision, language.description, jsonbText(language.lines), userId, at, kind, itemId, language.locale),
  ]);
  if (statements.length) await ctx.db.batch(statements);
  return payload({
    trackId: itemId, savedAt: at,
    languages: saved.map((l) => ({ trackId: itemId, locale: l.locale, description: l.description, publicationStatus: 'draft', hasDraft: true, syncPrecision: precision, lines: l.lines })),
  });
}

export async function publishLearningLyricLanguages(ctx: ApiContext, kind: string, itemId: string, precision: string | null, locales: (string | null)[] | null): Promise<unknown> {
  const userId = requireAuth(ctx);
  if (!(await itemEditable(ctx, kind, itemId))) raise('Learning item not editable', '42501');
  learningKinds(kind, precision);
  const statements: D1PreparedStatement[] = [];
  const done = new Set<string | null>();
  const at = now();
  const recording = kind === 'album_recording' ? itemId : null;
  const lesson = kind === 'lesson' ? itemId : null;
  for (const locale of eachOf(locales)) {
    const draft = done.has(locale) ? undefined
      : (await first(ctx, `SELECT * FROM ${t('learning', 'lyric_edit_drafts')} WHERE ${col('item_kind')} = ? AND ${ITEM_KEY} = ? AND ${col('locale')} = ?`, kind, itemId, locale)) ?? undefined;
    const lines = checkDraft(draft, precision);
    precisionNotNull(precision, 'lyric_sets');
    const existing = await first(ctx, `SELECT ${col('id')} FROM ${t('learning', 'lyric_sets')} WHERE ${col('item_kind')} = ? AND ${ITEM_KEY} = ? AND ${col('locale')} = ?`, kind, itemId, locale);
    const setId = (existing?.id as string | undefined) ?? crypto.randomUUID();
    if (!existing) {
      statements.push(ctx.db.prepare(`INSERT INTO ${t('learning', 'lyric_sets')} (${['id', 'item_kind', 'album_recording_id', 'lesson_id', 'locale', 'sync_precision', 'description', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)`).bind(setId, kind, recording, lesson, locale, precision, draft!.description, userId, userId, at, at));
    } else {
      statements.push(
        ctx.db.prepare(`UPDATE ${t('learning', 'lyric_sets')} SET ${col('sync_precision')} = ?, ${col('description')} = ?, ${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
          .bind(precision, draft!.description, userId, at, setId),
        ctx.db.prepare(`DELETE FROM ${t('learning', 'lyric_lines')} WHERE ${col('lyric_set_id')} = ?`).bind(setId),
      );
    }
    statements.push(...insertLines(ctx, t('learning', 'lyric_lines'), setId, lines as Row[], precision === 'line'));
    statements.push(ctx.db.prepare(`DELETE FROM ${t('learning', 'lyric_edit_drafts')} WHERE ${col('item_kind')} = ? AND ${ITEM_KEY} = ? AND ${col('locale')} = ?`).bind(kind, itemId, locale));
    done.add(locale);
  }
  if (statements.length) await ctx.db.batch(statements);
  return payload({ trackId: itemId, locales, publishedAt: at });
}
