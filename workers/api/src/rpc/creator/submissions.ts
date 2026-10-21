/**
 * Creating a submission and editing a release from CV-Artists: ports of
 * public.create_creator_submission_v3 (with the _v2 and the original it
 * wraps, and public.create_media_submission) and public.update_creator_release_v3
 * (with _v2, the original and public.update_creator_release_metadata), in one
 * transaction each. The layers are kept as Supabase has them, each reading
 * what the one before wrote, so checks and errors come in the same order.
 * Checked by tests/creator.writes.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction, type Tx } from '../../db/transaction.ts';
import { jsonbText, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { cantorEditable } from '../learning/shared.ts';
import {
  addEvent, addSubmissionItem, arrayElements, arrow, arrowText, cleanText, eachText, featuredIds, hasKey, jsonbType, linkItemTrack, resolveLearningArtist,
  requireLocale, setTrackCreditRefs, setTrackCredits, submitSubmission, toUuid, trimSpaces, trueFirst,
} from './core.ts';
import { getCreatorRelease } from './reads.ts';
import { canEdit, earliestReleaseAt, first, ME, meParams, order, payload, viewer, type Row } from './shared.ts';

const RELEASES = t('music', 'releases');
const SUBMISSIONS = t('media', 'submissions');
const RELEASE_TRACKS = t('music', 'release_tracks');
const EDITABLE = ['draft', 'uploading', 'ready_to_submit', 'changes_requested'];

/** to_char(at, 'YYYY-MM-DD HH24:MI'). */
const minutes = (at: string) => `${at.slice(0, 10)} ${at.slice(11, 16)}`;
/** jsonb_strip_nulls(jsonb_build_object(…)). */
const stripNulls = (value: Row) => Object.fromEntries(Object.entries(value).filter(([, v]) => v != null));
/** coalesce(role, 'media') <> 'artwork'. */
const isMedia = (item: unknown) => (arrowText(item, 'role') ?? 'media') !== 'artwork';

export type SubmissionInput = {
  accountId: string; mode: string | null; title: string | null; description: string | null; releaseType: string | null; musicType: string | null;
  recordingType: string | null; artistId: string | null; cantorId: string | null; seasonId: string | null; hymnId: string | null; localizedTitles: unknown;
  items: unknown; timing: string | null; scheduledAt: string | null; originalDate: string | null;
};

/** public.create_media_submission. */
async function createMediaSubmission(ctx: ApiContext, tx: Tx, account: string, kind: string, title: string, description: string | null): Promise<string> {
  if (!ctx.userId) raise('Authentication required', '28000');
  if (account == null) raise('creator_account_id is required', '22023');
  if (!(await canEdit(ctx, account))) raise('Not authorized for creator account', '42501');
  if (!(await tx.first(`SELECT 1 AS yes FROM ${t('creator', 'creator_accounts')} WHERE ${col('id')} = ? AND ${col('status')} = 'active'`, account))) raise('Creator account is not active', '22023');
  if (title == null || trimSpaces(title).length === 0) raise('title is required', '22023');
  const id = crypto.randomUUID();
  await tx.run(`INSERT INTO ${SUBMISSIONS} (${['id', 'creator_account_id', 'submission_type', 'title', 'description', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`, id, account, kind, trimSpaces(title), cleanText(description), ctx.userId, ctx.userId, tx.at, tx.at);
  await addEvent(tx, id, ctx.userId, 'created', null, 'draft', null, { submissionType: kind });
  return id;
}

/** Localizations: each key with a title (any locale the catalog knows). */
const titledEntries = (titles: unknown) => eachText(titles ?? {}).filter(([, title]) => cleanText(title) != null).map(([locale, title]) => [locale, trimSpaces(title!)] as const);

/** public.create_creator_submission: the submission, its catalog row, its items (and a music release's tracks), submitted. */
async function createV1(ctx: ApiContext, tx: Tx, a: SubmissionInput & { scheduledAt: string | null }): Promise<Row> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required', '28000');
  if (!(await canEdit(ctx, a.accountId))) raise('Not authorized for creator account', '42501');
  const title = cleanText(a.title);
  const description = cleanText(a.description);
  if (title == null) raise('Add a title', '22023');
  const items = a.items ?? [];
  if (jsonbType(items) !== 'array') raise('Items must be a list', '22023');
  const kind = ({ music: 'music_release', learning_album: 'learning_album', learning_lesson_set: 'learning_lesson_set' } as Record<string, string>)[a.mode ?? ''];
  if (!kind) raise(`Unknown submission mode: ${a.mode ?? '<NULL>'}`, '22023');
  const list = items as unknown[];
  if (list.filter((item) => (arrowText(item, 'role') ?? 'media') === 'media').length === 0) raise('Add at least one media file', '22023');
  if (list.filter((item) => arrowText(item, 'role') === 'artwork').length > 1) raise('Only one artwork file can be attached', '22023');
  const identity = (await tx.first(`SELECT ${col('identity_artist_id')} AS id FROM ${t('creator', 'creator_accounts')} WHERE ${col('id')} = ?`, a.accountId))?.id ?? null;
  let schedule: string | null = null;
  if (kind === 'music_release') {
    if (a.releaseType == null) raise('Choose a release type', '22023');
    if (identity == null) raise('This account has no artist identity yet', '22023');
    if (a.artistId != null && a.artistId !== identity) raise("A release can only be published under its own account's artist identity", '42501');
    const earliest = earliestReleaseAt();
    schedule = a.scheduledAt ?? earliest;
    if (schedule < earliest) raise(`Choose a release date at least 48 hours from now (earliest ${minutes(earliest)} UTC)`, '22023');
  } else {
    const v = await viewer(ctx);
    const cantor = a.cantorId == null ? null : await first(ctx, `${ME} SELECT c.${col('metadata')} FROM ${t('learning', 'cantors')} c WHERE c.${col('id')} = ?
      AND (c.${col('publication_status')} = 'published' OR ${cantorEditable(`c.${col('id')}`)})`, ...meParams(v), a.cantorId);
    const contributorKind = cantor ? ((arrowText(JSON.parse(cantor.metadata as string), 'contributorType') ?? 'cantor').toLowerCase() === 'chorus' ? 'chorus' : 'cantor') : null;
    if (a.cantorId == null || contributorKind == null) raise(kind === 'learning_album' ? 'Choose a cantor or chorus from Coptic Vine' : 'Choose a cantor from Coptic Vine', '22023');
    if (kind === 'learning_lesson_set' && contributorKind === 'chorus') raise('Lesson sets must be taught by a cantor, not a chorus', '22023');
    if (a.seasonId != null && !(await tx.first(`SELECT 1 AS yes FROM ${t('learning', 'seasons')} WHERE ${col('id')} = ?`, a.seasonId))) raise('Season not found', '22023');
    if (kind === 'learning_lesson_set' && (a.hymnId == null || !(await tx.first(`SELECT 1 AS yes FROM ${t('learning', 'hymns')} WHERE ${col('id')} = ?`, a.hymnId)))) raise('Choose a hymn', '22023');
  }
  const artworkIntent = toUuid(list.filter((item) => arrowText(item, 'role') === 'artwork').map((item) => arrowText(item, 'uploadIntentId'))[0] ?? null);
  const submissionId = await createMediaSubmission(ctx, tx, a.accountId, kind!, title!, description);
  const catalogId = crypto.randomUUID();
  const titles = titledEntries(a.localizedTitles);
  if (kind === 'music_release') {
    await tx.run(`INSERT INTO ${RELEASES} (${['id', 'owner_creator_account_id', 'primary_artist_id', 'release_type', 'title', 'description', 'scheduled_release_at', 'original_release_date', 'metadata', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, catalogId, a.accountId, identity, a.releaseType, title, description, schedule, a.originalDate,
    jsonbText(stripNulls({ submissionId, artworkUploadIntentId: artworkIntent })), userId, userId, tx.at, tx.at);
    for (const [locale, text] of titles) {
      await requireLocale(tx, 'release_localizations', locale);
      await tx.run(`INSERT INTO ${t('music', 'release_localizations')} (${['id', 'release_id', 'locale', 'title', 'is_primary', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, crypto.randomUUID(), catalogId, locale, text, locale === 'en' ? 1 : 0, userId, userId, tx.at, tx.at);
    }
  } else {
    const album = kind === 'learning_album';
    // created_by: the column's default, auth.uid().
    await tx.run(`INSERT INTO ${album ? t('learning', 'albums') : t('learning', 'lesson_sets')} (${['id', 'owner_creator_account_id', 'cantor_id', 'season_id', ...(album ? [] : ['hymn_id']), 'submission_id', 'title', 'description', 'metadata', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
      VALUES (${['?', '?', '?', '?', ...(album ? [] : ['?']), '?', '?', '?', '?', '?', '?', '?', '?'].join(', ')})`,
    ...[catalogId, a.accountId, a.cantorId, a.seasonId, ...(album ? [] : [a.hymnId]), submissionId, title, description, jsonbText(stripNulls({ artworkUploadIntentId: artworkIntent })), userId, userId, tx.at, tx.at]);
    for (const [locale, text] of titles) {
      await requireLocale(tx, album ? 'album_localizations' : 'lesson_set_localizations', locale);
      await tx.run(album
        ? `INSERT INTO ${t('learning', 'album_localizations')} (${col('album_id')}, ${col('locale')}, ${col('title')}, ${col('created_at')}, ${col('updated_at')}) VALUES (?, ?, ?, ?, ?)`
        : `INSERT INTO ${t('learning', 'lesson_set_localizations')} (${col('lesson_set_id')}, ${col('locale')}, ${col('title')}, ${col('created_at')}, ${col('updated_at')}) VALUES (?, ?, ?, ?, ?)`,
      catalogId, locale, text, tx.at, tx.at);
    }
  }
  // ORDER BY (role = 'artwork') DESC, position: an item with no role (null) first, then artwork, then the rest;
  // a music release's items become its tracks, with their credits.
  const isArtwork = (item: unknown) => (arrowText(item, 'role') == null ? null : arrowText(item, 'role') === 'artwork');
  const ordered = list.map((item, position) => ({ item, position })).sort((x, y) => trueFirst(isArtwork(x.item), isArtwork(y.item)) || x.position - y.position);
  let index = 0;
  let trackNumber = 0;
  for (const { item } of ordered) {
    const added = await addSubmissionItem(ctx, tx, {
      submissionId, intentId: toUuid(arrowText(item, 'uploadIntentId')), assetId: null, title: cleanText(arrowText(item, 'title')), sortOrder: index, required: true,
      role: arrowText(item, 'role') === 'artwork' ? 'artwork' : null,
    });
    if (kind === 'music_release' && isMedia(item)) {
      trackNumber += 1;
      const trackId = crypto.randomUUID();
      await tx.batch([
        tx.db.prepare(`INSERT INTO ${t('music', 'tracks')} (${['id', 'owner_creator_account_id', 'title', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`).bind(trackId, a.accountId, cleanText(arrowText(item, 'title')) ?? title, userId, userId, tx.at, tx.at),
        tx.db.prepare(`INSERT INTO ${RELEASE_TRACKS} (${['id', 'release_id', 'track_id', 'disc_number', 'track_number', 'created_at'].map(col).join(', ')}) VALUES (?, ?, ?, 1, ?, ?)`)
          .bind(crypto.randomUUID(), catalogId, trackId, trackNumber, tx.at),
      ]);
      const main = arrowText(item, 'mainArtistId');
      await setTrackCredits(tx, trackId, a.accountId, main === '' || main == null ? null : toUuid(main), featuredIds(item));
      await linkItemTrack(ctx, tx, added.item_id, trackId, a.accountId);
    }
    index += 1;
  }
  const submitted = await submitSubmission(ctx, tx, submissionId);
  return { submissionId, catalogId, status: submitted.status, itemCount: index, trackCount: trackNumber, scheduledReleaseAt: schedule, originalReleaseDate: a.originalDate };
}

/** public.create_creator_submission_v2: titles, music and recording types and track titles checked; the tracks' credits by name and their titles. */
async function createV2(ctx: ApiContext, tx: Tx, a: SubmissionInput): Promise<Row> {
  if (!ctx.userId) raise('Authentication required', '28000');
  if (!eachText(a.localizedTitles ?? {}).some(([locale, title]) => ['en', 'ar', 'fr'].includes(locale) && cleanText(title) != null)) raise('Add a title in English, Arabic, or French', '22023');
  const musicType = cleanText(a.musicType);
  const recordingType = cleanText(a.recordingType);
  let releaseType = a.releaseType;
  const entries = a.mode === 'music' ? arrayElements(a.items ?? []) : [];
  if (a.mode === 'music') {
    const count = entries.filter(isMedia).length;
    if (count === 0) raise('A music release needs at least one track', '22023');
    releaseType = count === 1 ? 'single' : count <= 6 ? 'ep' : 'album';
    if (musicType == null) raise('Music type is required', '22023');
    if (recordingType == null) raise('Recording type is required', '22023');
    if (entries.some((entry) => isMedia(entry) && cleanText(arrowText(entry, 'title')) == null)) raise('Every track needs a title', '22023');
  }
  const result = await createV1(ctx, tx, { ...a, releaseType });
  if (a.mode !== 'music') return result;
  const catalogId = result.catalogId as string;
  const release = (await tx.first(`SELECT ${col('metadata')} FROM ${RELEASES} WHERE ${col('id')} = ?`, catalogId))!;
  await tx.run(`UPDATE ${RELEASES} SET ${col('metadata')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
    jsonbText({ ...(JSON.parse(release.metadata as string) as Row), musicType, recordingType }), tx.at, catalogId);
  let position = 0;
  for (const item of entries.filter(isMedia)) {
    position += 1;
    const track = await tx.first(`SELECT ${col('track_id')} AS id FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ? AND ${col('disc_number')} = 1 AND ${col('track_number')} = ?`, catalogId, position);
    if (!track) raise(`Could not resolve track ${position} for the new release`);
    const mainId = arrowText(item, 'mainArtistId');
    const contributors = arrow(item, 'contributors');
    await setTrackCreditRefs(ctx, tx, track!.id, a.accountId, arrowText(item, 'mainArtistName'), mainId === '' || mainId == null ? null : toUuid(mainId), contributors === undefined ? [] : contributors);
    for (const [locale, title] of titledEntries(arrow(item, 'localizedTitles') ?? {})) {
      await requireLocale(tx, 'track_localizations', locale);
      await tx.run(`INSERT INTO ${t('music', 'track_localizations')} (${['id', 'track_id', 'locale', 'title', 'is_primary', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
        ON CONFLICT (${col('track_id')}, ${col('locale')}) DO UPDATE SET ${col('title')} = excluded.${col('title')}, ${col('is_primary')} = excluded.${col('is_primary')},
          ${col('updated_by')} = excluded.${col('updated_by')}, ${col('updated_at')} = ?`,
      crypto.randomUUID(), track!.id, locale, title, locale === 'en' ? 1 : 0, ctx.userId, ctx.userId, tx.at, tx.at, tx.at);
    }
  }
  return result;
}

export async function createCreatorSubmissionV3(ctx: ApiContext, a: SubmissionInput): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    let timing = trimSpaces(a.timing ?? 'asap').toLowerCase();
    if (a.mode != null && ['music', 'learning_album', 'learning_lesson_set'].includes(a.mode)) {
      if (!['asap', 'scheduled'].includes(timing)) raise('Release timing must be asap or scheduled', '22023');
      if (timing === 'scheduled' && a.scheduledAt == null) raise('Choose a scheduled release date and time', '22023');
    } else {
      timing = 'asap';
    }
    if (a.mode != null && a.mode !== 'music' && timing === 'scheduled' && a.scheduledAt! < earliestReleaseAt()) raise('Choose a release date at least 48 hours from now', '22023');
    // The client sends an artist's id (or an older build a cantor's); a name only when none is chosen.
    let cantor = a.cantorId;
    const learning = a.mode === 'learning_album' || a.mode === 'learning_lesson_set';
    if (learning) {
      const named = arrayElements(a.items ?? []).filter(isMedia)
        .sort((x, y) => order.text(arrowText(x, 'uploadIntentId'), arrowText(y, 'uploadIntentId')))[0];
      cantor = await resolveLearningArtist(ctx, tx, a.accountId, a.cantorId, named === undefined ? null : cleanText(arrowText(named, 'learningArtistName')));
    }
    const result = await createV2(ctx, tx, { ...a, cantorId: cantor, scheduledAt: timing === 'scheduled' ? a.scheduledAt : null });
    const submissionId = result.submissionId as string;
    if (learning) {
      // Each item keeps its titles, matched by its upload.
      for (const entry of arrayElements(a.items ?? []).filter(isMedia)) {
        const intent = toUuid(arrowText(entry, 'uploadIntentId'));
        const titles = arrow(entry, 'localizedTitles');
        await tx.run(`UPDATE ${t('media', 'submission_items')} SET ${col('localized_titles')} = ?, ${col('updated_at')} = ? WHERE ${col('submission_id')} = ? AND ${col('upload_intent_id')} = ?`,
          jsonbText(jsonbType(titles) === 'object' ? titles : {}), tx.at, submissionId, intent);
      }
    }
    const catalogId = result.catalogId as string | null;
    if (a.mode === 'music') {
      await tx.run(`UPDATE ${RELEASES} SET ${col('release_timing_mode')} = ?, ${col('scheduled_release_at')} = CASE WHEN ? = 'asap' THEN NULL ELSE ${col('scheduled_release_at')} END,
        ${col('updated_at')} = ? WHERE ${col('id')} = ?`, timing, timing, tx.at, catalogId);
    } else if (learning) {
      await tx.run(`UPDATE ${a.mode === 'learning_album' ? t('learning', 'albums') : t('learning', 'lesson_sets')} SET ${col('release_timing_mode')} = ?, ${col('scheduled_release_at')} = ?,
        ${col('original_release_date')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, timing, timing === 'scheduled' ? a.scheduledAt : null, a.originalDate, tx.at, catalogId);
    }
    return payload(result);
  });
}

// ── Editing a release ─────────────────────────────────────────────────────

export type ReleaseUpdate = {
  releaseId: string; title: string | null; description: string | null; timing: string | null; scheduledAt: string | null; originalDate: string | null;
  clearOriginalDate: boolean | null; localizedTitles: unknown; musicType: string | null; recordingType: string | null; tracks: unknown; coverIntent: string | null;
};

/** public.update_creator_release: the release, artwork and tracks (new ones from uploads), then back to review. */
async function updateV1(ctx: ApiContext, tx: Tx, a: ReleaseUpdate): Promise<void> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required', '28000');
  let release = await tx.first(`SELECT * FROM ${RELEASES} WHERE ${col('id')} = ?`, a.releaseId);
  if (!release) raise('Release not found', 'P0002');
  const account = release!.owner_creator_account_id;
  if (!(await canEdit(ctx, account))) raise('Not authorized for this release', '42501');
  // (metadata ->> 'submissionId')::uuid, without nullif: an empty one fails the cast.
  const submissionId = toUuid(arrowText(JSON.parse(release!.metadata as string), 'submissionId'));
  if (a.scheduledAt != null) {
    const earliest = earliestReleaseAt();
    if (a.scheduledAt < earliest) raise(`Choose a release date at least 48 hours from now (earliest ${minutes(earliest)} UTC)`, '22023');
  }
  const tracks = a.tracks;
  const addsItems = a.coverIntent != null || arrayElements(tracks ?? []).some((entry) => (arrowText(entry, 'id') ?? '') === '');
  let originalStatus: string | null = null;
  if (submissionId != null) {
    originalStatus = ((await tx.first(`SELECT ${col('status')} FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, submissionId))?.status as string | undefined) ?? null;
    // Reopened so items can be attached; submitting again at the end restores it, with a fresh deadline.
    if (addsItems && originalStatus != null && !EDITABLE.includes(originalStatus)) {
      await tx.run(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'ready_to_submit', ${col('updated_by')} = ? WHERE ${col('id')} = ?`, userId, submissionId);
    }
  }
  release = await tx.writeFirst(`UPDATE ${RELEASES} SET ${col('title')} = coalesce(?, ${col('title')}), ${col('description')} = CASE WHEN ? THEN ${col('description')} ELSE ? END,
    ${col('scheduled_release_at')} = coalesce(?, ${col('scheduled_release_at')}), ${col('original_release_date')} = CASE WHEN ? THEN NULL ELSE coalesce(?, ${col('original_release_date')}) END,
    ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ? RETURNING *`,
  cleanText(a.title), a.description == null ? 1 : 0, a.description == null ? null : cleanText(a.description), a.scheduledAt, a.clearOriginalDate ? 1 : 0, a.originalDate, userId, tx.at, a.releaseId);
  // (update_creator_release_v2 passes no titles here; update_creator_release_metadata sets them.)
  if (a.coverIntent != null) {
    if (submissionId == null) raise('This release has no submission to attach artwork to', '22023');
    await addSubmissionItem(ctx, tx, { submissionId, intentId: a.coverIntent, assetId: null, title: 'Artwork', sortOrder: -1, required: true, role: 'artwork' });
  }
  if (tracks != null) {
    if (jsonbType(tracks) !== 'array') raise('Tracks must be a list', '22023');
    const keep: string[] = [];
    let position = 0;
    for (const entry of tracks as unknown[]) {
      position += 1;
      const idText = arrowText(entry, 'id');
      let trackId = idText == null || idText === '' ? null : toUuid(idText);
      const isNew = trackId == null;
      if (trackId == null) {
        const intentText = arrowText(entry, 'uploadIntentId');
        if (intentText == null || intentText === '') raise('A new track needs an uploaded file', '22023');
        if (submissionId == null) raise('This release has no submission to add tracks to', '22023');
        trackId = crypto.randomUUID();
        await tx.run(`INSERT INTO ${t('music', 'tracks')} (${['id', 'owner_creator_account_id', 'title', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`, trackId, account, cleanText(arrowText(entry, 'title')) ?? release!.title, userId, userId, tx.at, tx.at);
        const added = await addSubmissionItem(ctx, tx, {
          submissionId, intentId: toUuid(intentText), assetId: null, title: cleanText(arrowText(entry, 'title')), sortOrder: position, required: true, role: 'track',
        });
        await tx.run(`UPDATE ${t('media', 'submission_items')} SET ${col('music_track_id')} = ? WHERE ${col('id')} = ?`, trackId, added.item_id);
      } else {
        if (!(await tx.first(`SELECT 1 AS yes FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ? AND ${col('track_id')} = ?`, a.releaseId, trackId))) raise('Track does not belong to this release', '42501');
        await tx.run(`UPDATE ${t('music', 'tracks')} SET ${col('title')} = coalesce(?, ${col('title')}), ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
          cleanText(arrowText(entry, 'title')), userId, tx.at, trackId);
      }
      // Numbers out of the way first: (release, disc, number) is unique.
      const moved = await tx.run(`UPDATE ${RELEASE_TRACKS} SET ${col('track_number')} = ? WHERE ${col('release_id')} = ? AND ${col('track_id')} = ?`, position + 1000, a.releaseId, trackId);
      if (moved.meta.changes === 0) {
        await tx.run(`INSERT INTO ${RELEASE_TRACKS} (${['id', 'release_id', 'track_id', 'disc_number', 'track_number', 'created_at'].map(col).join(', ')}) VALUES (?, ?, ?, 1, ?, ?)`,
          crypto.randomUUID(), a.releaseId, trackId, position + 1000, tx.at);
      }
      // A new track always takes the default credits, even when the caller named no artist.
      if (isNew || hasKey(entry, 'mainArtistId') || hasKey(entry, 'featuredArtistIds')) {
        const main = arrowText(entry, 'mainArtistId');
        await setTrackCredits(tx, trackId, account, main == null || main === '' ? null : toUuid(main), featuredIds(entry));
      }
      keep.push(trackId!);
    }
    await tx.batch([
      tx.db.prepare(`DELETE FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ? AND ${col('track_id')} NOT IN (SELECT value FROM json_each(?))`).bind(a.releaseId, JSON.stringify(keep)),
      tx.db.prepare(`UPDATE ${RELEASE_TRACKS} SET ${col('track_number')} = ${col('track_number')} - 1000 WHERE ${col('release_id')} = ? AND ${col('track_number')} > 1000`).bind(a.releaseId),
    ]);
  }
  // Back to review through the usual path: the submitted time and the 48-hour deadline.
  if (submissionId != null && originalStatus != null && originalStatus !== 'rejected') {
    await submitSubmission(ctx, tx, submissionId);
    await addEvent(tx, submissionId, userId, 'edited_by_creator', originalStatus, 'pending_review', 'The artist edited this release, so it is back in the review queue.', { releaseId: a.releaseId });
  }
}

/** public.update_creator_release_metadata: music and recording types, and the titles in en, ar and fr. */
async function updateMetadata(ctx: ApiContext, tx: Tx, releaseId: string, musicType: string | null, recordingType: string | null, titles: unknown): Promise<void> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required', '28000');
  const release = await tx.first(`SELECT ${col('owner_creator_account_id')} AS account, ${col('metadata')} FROM ${RELEASES} WHERE ${col('id')} = ?`, releaseId);
  if (release?.account == null) raise('Release not found', 'P0002');
  if (!(await canEdit(ctx, release!.account))) raise('Not authorized for this release', '42501');
  const metadata = JSON.parse((release!.metadata as string) ?? '{}') as Row;
  delete metadata.musicType;
  delete metadata.recordingType;
  if (cleanText(musicType) != null) metadata.musicType = trimSpaces(musicType!);
  if (cleanText(recordingType) != null) metadata.recordingType = trimSpaces(recordingType!);
  await tx.run(`UPDATE ${RELEASES} SET ${col('metadata')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, jsonbText(metadata), userId, tx.at, releaseId);
  if (titles != null) {
    await tx.run(`DELETE FROM ${t('music', 'release_localizations')} WHERE ${col('release_id')} = ? AND ${col('locale')} IN ('en', 'ar', 'fr')`, releaseId);
    for (const [locale, title] of eachText(titles)) {
      if (!['en', 'ar', 'fr'].includes(locale) || cleanText(title) == null) continue;
      await tx.run(`INSERT INTO ${t('music', 'release_localizations')} (${['id', 'release_id', 'locale', 'title', 'is_primary', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, crypto.randomUUID(), releaseId, locale, trimSpaces(title!), locale === 'en' ? 1 : 0, userId, userId, tx.at, tx.at);
    }
  }
}

/** public.update_creator_release_v2: a submission under review reopened, then the original, the metadata, and each track's credits and titles. */
async function updateV2(ctx: ApiContext, tx: Tx, a: ReleaseUpdate): Promise<void> {
  if (!ctx.userId) raise('Authentication required', '28000');
  const release = await tx.first(`SELECT ${col('owner_creator_account_id')} AS account, nullif(json_extract(${col('metadata')}, '$.submissionId'), '') AS submission FROM ${RELEASES} WHERE ${col('id')} = ?`, a.releaseId);
  if (release?.account == null) raise('Release not found', 'P0002');
  if (!(await canEdit(ctx, release!.account))) raise('Not authorized for this release', '42501');
  const submissionId = release!.submission == null ? null : toUuid(release!.submission as string);
  if (submissionId != null) {
    const status = (await tx.first(`SELECT ${col('status')} FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, submissionId))?.status as string | undefined;
    if (status != null && !EDITABLE.includes(status)) {
      await tx.run(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'ready_to_submit', ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, ctx.userId, tx.at, submissionId);
    }
  }
  await updateV1(ctx, tx, { ...a, localizedTitles: null });
  await updateMetadata(ctx, tx, a.releaseId, a.musicType, a.recordingType, a.localizedTitles);
  if (a.tracks != null) {
    let position = 0;
    for (const entry of arrayElements(a.tracks)) {
      position += 1;
      const track = await tx.first(`SELECT ${col('track_id')} AS id FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ? AND ${col('disc_number')} = 1 AND ${col('track_number')} = ?`, a.releaseId, position);
      if (!track) raise(`Could not resolve track ${position} after release update`);
      const mainId = arrowText(entry, 'mainArtistId');
      const contributors = arrow(entry, 'contributors');
      await setTrackCreditRefs(ctx, tx, track!.id, release!.account, arrowText(entry, 'mainArtistName'), mainId === '' || mainId == null ? null : toUuid(mainId),
        contributors === undefined ? [] : contributors);
      if (hasKey(entry, 'localizedTitles')) {
        await tx.run(`DELETE FROM ${t('music', 'track_localizations')} WHERE ${col('track_id')} = ? AND ${col('locale')} IN ('en', 'ar', 'fr')`, track!.id);
        const titles = arrow(entry, 'localizedTitles');
        for (const [locale, title] of eachText(titles ?? {})) {
          if (!['en', 'ar', 'fr'].includes(locale) || cleanText(title) == null) continue;
          await tx.run(`INSERT INTO ${t('music', 'track_localizations')} (${['id', 'track_id', 'locale', 'title', 'is_primary', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
            VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
            ON CONFLICT (${col('track_id')}, ${col('locale')}) DO UPDATE SET ${col('title')} = excluded.${col('title')}, ${col('is_primary')} = excluded.${col('is_primary')},
              ${col('updated_by')} = excluded.${col('updated_by')}, ${col('updated_at')} = ?`,
          crypto.randomUUID(), track!.id, locale, trimSpaces(title!), locale === 'en' ? 1 : 0, ctx.userId, ctx.userId, tx.at, tx.at, tx.at);
        }
      }
    }
  }
}

export async function updateCreatorReleaseV3(ctx: ApiContext, a: ReleaseUpdate): Promise<unknown> {
  if (!ctx.userId) raise('Authentication required', '28000');
  await transaction(ctx, async (tx) => {
    const release = await tx.first(`SELECT * FROM ${RELEASES} WHERE ${col('id')} = ?`, a.releaseId);
    if (!release) raise('Release not found', 'P0002');
    if (!(await canEdit(ctx, release!.owner_creator_account_id))) raise('Not authorized for this release', '42501');
    const timing = trimSpaces(a.timing ?? (release!.release_timing_mode as string | null) ?? 'asap').toLowerCase();
    if (!['asap', 'scheduled'].includes(timing)) raise('Release timing must be asap or scheduled', '22023');
    if (timing === 'scheduled' && a.scheduledAt == null && release!.scheduled_release_at == null) raise('Choose a scheduled release date and time', '22023');
    await tx.run(timing === 'asap'
      ? `UPDATE ${RELEASES} SET ${col('release_timing_mode')} = 'asap', ${col('scheduled_release_at')} = NULL, ${col('updated_at')} = ? WHERE ${col('id')} = ?`
      : `UPDATE ${RELEASES} SET ${col('release_timing_mode')} = 'scheduled', ${col('updated_at')} = ? WHERE ${col('id')} = ?`, tx.at, a.releaseId);
    await updateV2(ctx, tx, { ...a, scheduledAt: timing === 'scheduled' ? a.scheduledAt : null });
    await tx.run(`UPDATE ${RELEASES} SET ${col('release_timing_mode')} = ?, ${col('scheduled_release_at')} = CASE WHEN ? = 'asap' THEN NULL ELSE ${col('scheduled_release_at')} END,
      ${col('updated_at')} = ? WHERE ${col('id')} = ?`, timing, timing, tx.at, a.releaseId);
  });
  return getCreatorRelease(ctx, a.releaseId);
}

