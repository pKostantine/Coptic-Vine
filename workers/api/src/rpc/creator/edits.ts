/**
 * The submission editor's save (CV-Artists, and CV-Admin's editor): ports
 * of public.save_submission_edit, private.save_music_submission_edit and
 * private.save_learning_submission_edit (schema/pg-user-schema.sql), in one
 * transaction. A release, album or lesson set is rewritten from the edit: its
 * titles, timing, artist, tracks or recordings (kept, given new files, added
 * or removed) and artwork; an artist's edit goes back to review, an admin's
 * keeps its status and, on live content, goes live once processed.
 * Checked by tests/creator.writes.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction, type Tx } from '../../db/transaction.ts';
import { jsonbText, raise, timestampInput } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { convert } from '../args.ts';
import {
  addEditItem, addEvent, addHours, arrow, arrowText, attachCompletedJobs, cleanText, cleanupOrphanTrack, editCompactTitles, editLocalizedTitles, editPreferredTitle,
  hasKey, jsonbType, musicSubmissionHasPendingEdits, replaceArtwork, requiredReady, resolveLearningArtist, setTrackCreditRefs, toUuid,
} from './core.ts';
import { publishMusicSubmission, applyLearningEdits } from './publish.ts';
import { getSubmissionEditor } from './reads.ts';
import { canEdit, earliestReleaseAt, viewer, type Row } from './shared.ts';

const ITEMS = t('media', 'submission_items');
const RELEASE_TRACKS = t('music', 'release_tracks');
const LOCALES = ['en', 'ar', 'fr'];

/** nullif(btrim(edit ->> key), ''). */
const field = (edit: unknown, key: string) => cleanText(arrowText(edit, key));
/** coalesce(edit -> 'items', '[]'): a missing key is none; a JSON null stays null (and fails the check). */
const entriesOf = (edit: unknown) => (arrow(edit, 'items') === undefined ? [] : arrow(edit, 'items'));
/** nullif(btrim(edit ->> key), '')::date. */
const dateField = (edit: unknown, key: string) => (field(edit, key) == null ? null : convert('date', field(edit, key)) as string);

type Outcome = Row & { mediaChanged: boolean };

async function saveMusicEdit(ctx: ApiContext, tx: Tx, sub: Row, edit: unknown, actor: string, isAdmin: boolean): Promise<Outcome> {
  const coverIntent = toUuid(field(edit, 'coverUploadIntentId'));
  const titles = editLocalizedTitles(arrow(edit, 'localizedTitles'));
  const musicType = field(edit, 'musicType');
  const recordingType = field(edit, 'recordingType');
  let timing = (field(edit, 'releaseTimingMode') ?? '').toLowerCase();
  const entries = entriesOf(edit);
  const rel = await tx.first(`SELECT * FROM ${t('music', 'releases')} WHERE nullif(json_extract(${col('metadata')}, '$.submissionId'), '') = ?`, sub.id);
  if (!rel) raise('This submission has no release to edit', 'P0002');
  const live = rel!.publication_status === 'published';
  const title = editPreferredTitle(titles, arrowText(edit, 'title'));
  if (title == null) raise('Add a release title in English, Arabic, or French.', '22023');
  if (musicType == null) raise('Choose a music type.', '22023');
  if (recordingType == null) raise('Choose a recording type.', '22023');
  if (jsonbType(entries) !== 'array' || (entries as unknown[]).length === 0) raise('A release needs at least one track.', '22023');
  const list = entries as unknown[];
  let scheduledAt: string | null = null;
  if (!live && timing !== '') {
    if (!['asap', 'scheduled'].includes(timing)) raise('Unsupported release timing', '22023');
    scheduledAt = field(edit, 'scheduledReleaseAt') == null ? null : timestampInput(field(edit, 'scheduledReleaseAt'), 'scheduledReleaseAt');
    if (timing === 'scheduled' && (scheduledAt ?? rel!.scheduled_release_at) == null) raise('Choose a scheduled release date and time.', '22023');
  }
  if (live) timing = '';
  const metadata = JSON.parse(rel!.metadata as string) as Row;
  delete metadata.musicType;
  delete metadata.recordingType;
  await tx.run(`UPDATE ${t('music', 'releases')} SET ${col('title')} = ?, ${col('description')} = ?, ${col('metadata')} = ?, ${col('release_timing_mode')} = ?, ${col('scheduled_release_at')} = ?,
    ${col('original_release_date')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
  title, field(edit, 'description'), jsonbText({ ...metadata, musicType, recordingType }), timing === '' ? rel!.release_timing_mode : timing,
  timing === '' ? rel!.scheduled_release_at : timing === 'asap' ? null : scheduledAt ?? rel!.scheduled_release_at,
  hasKey(edit, 'originalReleaseDate') ? dateField(edit, 'originalReleaseDate') : rel!.original_release_date, actor, tx.at, rel!.id);
  // The titles in each language, keeping their publication with the release's.
  for (const locale of LOCALES) {
    if (!titles[locale]) {
      await tx.run(`DELETE FROM ${t('music', 'release_localizations')} WHERE ${col('release_id')} = ? AND ${col('locale')} = ?`, rel!.id, locale);
    } else {
      await tx.run(`INSERT INTO ${t('music', 'release_localizations')} (${['id', 'release_id', 'locale', 'title', 'is_primary', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (${col('release_id')}, ${col('locale')}) DO UPDATE SET ${col('title')} = excluded.${col('title')},
          ${col('publication_status')} = CASE WHEN ? THEN 'published' ELSE ${t('music', 'release_localizations')}.${col('publication_status')} END, ${col('updated_by')} = ?, ${col('updated_at')} = ?`,
      crypto.randomUUID(), rel!.id, locale, titles[locale], locale === 'en' ? 1 : 0, live ? 'published' : 'draft', actor, actor, tx.at, tx.at, live ? 1 : 0, actor, tx.at);
    }
  }
  const existing = (await tx.all(`SELECT ${col('track_id')} AS id FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ?`, rel!.id)).map((row) => row.id as string);
  const kept: string[] = [];
  let mediaChanged = false;
  let added = 0;
  let replaced = 0;
  let deleted = 0;
  for (const [index, entry] of list.entries()) {
    const place = index + 1;
    let target = toUuid(field(entry, 'id'));
    const intent = toUuid(field(entry, 'uploadIntentId'));
    // A single is titled as its release.
    const trackTitles = list.length === 1 ? titles : editLocalizedTitles(arrow(entry, 'localizedTitles'));
    const trackTitle = list.length === 1 ? title : editPreferredTitle(trackTitles, arrowText(entry, 'title'));
    if (trackTitle == null) raise(`Add a title in at least one language for track ${place}.`, '22023');
    if (target != null) {
      if (!existing.includes(target)) raise(`Track ${place} is not on this release`, '22023');
      await tx.run(`UPDATE ${t('music', 'tracks')} SET ${col('title')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, trackTitle, actor, tx.at, target);
      if (intent != null) {
        const original = await tx.first(`SELECT * FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('music_track_id')} = ? AND ${col('replaces_item_id')} IS NULL
          ORDER BY ${col('created_at')} DESC LIMIT 1`, sub.id, target);
        if (live) {
          if (!original) raise(`Track ${place} cannot be given a new file. Delete it and add the new file as a track instead.`, '22023');
          // The live file plays on until this one is approved and processed.
          await tx.run(`DELETE FROM ${ITEMS} WHERE ${col('replaces_item_id')} = ?`, original!.id);
          await addEditItem(ctx, tx, { submissionId: sub.id, intentId: intent, role: 'track', title: trackTitle, sortOrder: place, localizedTitles: {}, trackId: null, replaces: original!.id });
        } else {
          // Not live yet: the new file simply takes the old one's place.
          await tx.batch([
            tx.db.prepare(`DELETE FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('music_track_id')} = ?`).bind(sub.id, target),
            tx.db.prepare(`UPDATE ${t('music', 'tracks')} SET ${col('media_asset_id')} = NULL, ${col('duration_ms')} = NULL WHERE ${col('id')} = ?`).bind(target),
          ]);
          await addEditItem(ctx, tx, { submissionId: sub.id, intentId: intent, role: 'track', title: trackTitle, sortOrder: place, localizedTitles: {}, trackId: target, replaces: null });
        }
        mediaChanged = true;
        replaced += 1;
      }
    } else {
      if (intent == null) raise(`Track ${place} needs an audio file.`, '22023');
      target = crypto.randomUUID();
      await tx.batch([
        tx.db.prepare(`INSERT INTO ${t('music', 'tracks')} (${['id', 'owner_creator_account_id', 'title', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`).bind(target, rel!.owner_creator_account_id, trackTitle, actor, actor, tx.at, tx.at),
        tx.db.prepare(`INSERT INTO ${RELEASE_TRACKS} (${['id', 'release_id', 'track_id', 'disc_number', 'track_number', 'created_at'].map(col).join(', ')}) VALUES (?, ?, ?, 1, ?, ?)`)
          .bind(crypto.randomUUID(), rel!.id, target, 300000 + place, tx.at),
      ]);
      await addEditItem(ctx, tx, { submissionId: sub.id, intentId: intent!, role: 'track', title: trackTitle, sortOrder: place, localizedTitles: {}, trackId: target, replaces: null });
      mediaChanged = true;
      added += 1;
    }
    if (kept.includes(target!)) raise(`Track ${place} is listed twice`, '22023');
    kept.push(target!);
    // Its titles in each language, published with the track.
    for (const locale of LOCALES) {
      if (!trackTitles[locale]) {
        await tx.run(`DELETE FROM ${t('music', 'track_localizations')} WHERE ${col('track_id')} = ? AND ${col('locale')} = ?`, target, locale);
      } else {
        await tx.run(`INSERT INTO ${t('music', 'track_localizations')} (${['id', 'track_id', 'locale', 'title', 'is_primary', 'publication_status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
          SELECT ?, tr.${col('id')}, ?, ?, ?, tr.${col('publication_status')}, ?, ?, ?, ? FROM ${t('music', 'tracks')} tr WHERE tr.${col('id')} = ?
          ON CONFLICT (${col('track_id')}, ${col('locale')}) DO UPDATE SET ${col('title')} = excluded.${col('title')}, ${col('publication_status')} = excluded.${col('publication_status')},
            ${col('updated_by')} = ?, ${col('updated_at')} = ?`,
        crypto.randomUUID(), locale, trackTitles[locale], locale === 'en' ? 1 : 0, actor, actor, tx.at, tx.at, target, actor, tx.at);
      }
    }
    const contributors = arrow(entry, 'contributors');
    await setTrackCreditRefs(ctx, tx, target, rel!.owner_creator_account_id, field(entry, 'mainArtistName'), toUuid(field(entry, 'mainArtistId')), contributors === undefined ? [] : contributors);
    await tx.run(`UPDATE ${ITEMS} SET ${col('sort_order')} = ?, ${col('title')} = ?, ${col('updated_at')} = ? WHERE ${col('submission_id')} = ?
      AND (${col('music_track_id')} = ? OR ${col('replaces_item_id')} IN (SELECT o.${col('id')} FROM ${ITEMS} o WHERE o.${col('submission_id')} = ? AND o.${col('music_track_id')} = ?))`,
    place, trackTitle, tx.at, sub.id, target, sub.id, target);
  }
  // Tracks left out are deleted, with their files.
  for (const removed of existing) {
    if (kept.includes(removed)) continue;
    await tx.batch([
      tx.db.prepare(`DELETE FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('music_track_id')} = ?`).bind(sub.id, removed),
      tx.db.prepare(`DELETE FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ? AND ${col('track_id')} = ?`).bind(rel!.id, removed),
    ]);
    await cleanupOrphanTrack(tx, removed);
    deleted += 1;
  }
  // The new order; numbers out of the way first: (release, disc, number) is unique.
  await tx.batch([
    tx.db.prepare(`UPDATE ${RELEASE_TRACKS} SET ${col('track_number')} = ${col('track_number')} + 100000 WHERE ${col('release_id')} = ?`).bind(rel!.id),
    tx.db.prepare(`UPDATE ${RELEASE_TRACKS} SET ${col('disc_number')} = 1, ${col('track_number')} = ordered.key + 1 FROM json_each(?) ordered
      WHERE ${RELEASE_TRACKS}.${col('release_id')} = ? AND ${RELEASE_TRACKS}.${col('track_id')} = ordered.value`).bind(JSON.stringify(kept), rel!.id),
  ]);
  // Credits on a live release show at once, so the credited artists must be visible.
  if (live) {
    await tx.run(`UPDATE ${t('music', 'artists')} SET ${col('publication_status')} = 'published', ${col('updated_at')} = ?
      WHERE ${col('id')} IN (SELECT ta.${col('artist_id')} FROM ${RELEASE_TRACKS} rt JOIN ${t('music', 'track_artists')} ta ON ta.${col('track_id')} = rt.${col('track_id')} WHERE rt.${col('release_id')} = ?)
        AND ${col('publication_status')} <> 'published' AND (${col('is_credit_only')} = 1 OR ?)`, tx.at, rel!.id, isAdmin ? 1 : 0);
  }
  if (coverIntent != null) {
    await replaceArtwork(ctx, tx, sub.id, coverIntent, rel!.cover_asset_id);
    mediaChanged = true;
  }
  await tx.run(`UPDATE ${t('media', 'submissions')} SET ${col('title')} = ?, ${col('description')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
    title, field(edit, 'description'), actor, tx.at, sub.id);
  return { mediaChanged, live, added, replaced, deleted, trackCount: list.length };
}

async function saveLearningEdit(ctx: ApiContext, tx: Tx, sub: Row, edit: unknown, actor: string, isAdmin: boolean): Promise<Outcome> {
  const titles = editLocalizedTitles(arrow(edit, 'localizedTitles'));
  let timing = (field(edit, 'releaseTimingMode') ?? '').toLowerCase();
  const entries = entriesOf(edit);
  const coverIntent = toUuid(field(edit, 'coverUploadIntentId'));
  const album = sub.submission_type === 'learning_album';
  const table = album ? t('learning', 'albums') : t('learning', 'lesson_sets');
  const collection = await tx.first(`SELECT * FROM ${table} WHERE ${col('submission_id')} = ?`, sub.id);
  if (!collection) raise('This submission has nothing to edit', 'P0002');
  const live = collection!.publication_status === 'published';
  const currentCantor = collection!.cantor_id;
  let nextSeason = collection!.season_id;
  let nextHymn = album ? null : collection!.hymn_id;
  const title = editPreferredTitle(titles, arrowText(edit, 'title'));
  if (title == null) raise('Add a title in English, Arabic, or French.', '22023');
  if (jsonbType(entries) !== 'array' || (entries as unknown[]).length === 0) raise(`Keep at least one ${album ? 'recording' : 'lesson'}.`, '22023');
  const list = entries as unknown[];

  // The artist, chosen or named as when submitting.
  let nextCantor = currentCantor;
  const artistId = field(edit, 'artistId');
  const current = await tx.first(`SELECT coalesce(${col('artist_id')}, ${col('id')}) AS id FROM ${t('learning', 'cantors')} WHERE ${col('id')} = ?`, currentCantor);
  if ((artistId != null && toUuid(arrowText(edit, 'artistId')) !== ((current?.id as string | undefined) ?? null)) || (artistId == null && field(edit, 'artistName') != null)) {
    nextCantor = await resolveLearningArtist(ctx, tx, sub.creator_account_id, toUuid(artistId), field(edit, 'artistName'));
  }
  if (live && nextCantor !== currentCantor && !(await tx.first(`SELECT 1 AS yes FROM ${t('learning', 'cantors')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, nextCantor))) {
    if (!isAdmin) raise('Choose an artist who is already on Coptic Vine for live content, or ask Coptic Vine to add them.', '22023');
    await tx.run(`UPDATE ${t('learning', 'cantors')} SET ${col('publication_status')} = 'published', ${col('updated_at')} = ? WHERE ${col('id')} = ?`, tx.at, nextCantor);
  }
  if (hasKey(edit, 'seasonId')) {
    nextSeason = toUuid(field(edit, 'seasonId'));
    if (nextSeason != null && !(await tx.first(`SELECT 1 AS yes FROM ${t('learning', 'seasons')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, nextSeason))) {
      raise('That season is not available', '22023');
    }
  }
  if (!album && hasKey(edit, 'hymnId')) {
    nextHymn = toUuid(field(edit, 'hymnId'));
    if (nextHymn == null) raise('Choose the hymn this lesson set teaches.', '22023');
    const available = await tx.first(`SELECT 1 AS yes FROM ${t('learning', 'hymns')} WHERE ${col('id')} = ? AND (${col('publication_status')} = 'published'
      OR (? AND ${col('created_by')} = ? AND json_extract(${col('metadata')}, '$.creatorAccountId') = ?) OR ?)`, nextHymn, live ? 0 : 1, sub.created_by, sub.creator_account_id, isAdmin ? 1 : 0);
    if (!available) raise(`That hymn is not available${live ? ' for live content' : ''}`, '22023');
    if (live && isAdmin) await tx.run(`UPDATE ${t('learning', 'hymns')} SET ${col('publication_status')} = 'published', ${col('updated_at')} = ? WHERE ${col('id')} = ? AND ${col('publication_status')} <> 'published'`, tx.at, nextHymn);
  }
  // Timing only matters before it goes live; a new date keeps the 48-hour notice.
  let scheduledAt: string | null = null;
  if (!live && timing !== '') {
    if (!['asap', 'scheduled'].includes(timing)) raise('Unsupported release timing', '22023');
    scheduledAt = field(edit, 'scheduledReleaseAt') == null ? null : timestampInput(field(edit, 'scheduledReleaseAt'), 'scheduledReleaseAt');
    if (timing === 'scheduled') {
      if ((scheduledAt ?? collection!.scheduled_release_at) == null) raise('Choose a scheduled release date and time.', '22023');
      const earliest = earliestReleaseAt();
      if (scheduledAt != null && scheduledAt !== collection!.scheduled_release_at && scheduledAt < earliest && !isAdmin) {
        raise(`A release must be scheduled at least 48 hours out (earliest ${earliest.slice(0, 10)} ${earliest.slice(11, 16)} UTC)`, '22023');
      }
    }
  } else {
    timing = '';
  }
  await tx.run(`UPDATE ${table} SET ${col('title')} = ?, ${col('description')} = ?, ${col('cantor_id')} = ?, ${col('season_id')} = ?, ${album ? '' : `${col('hymn_id')} = ?, `}
    ${col('release_timing_mode')} = ?, ${col('scheduled_release_at')} = ?, ${col('original_release_date')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
  ...[title, field(edit, 'description'), nextCantor, nextSeason, ...(album ? [] : [nextHymn]), timing === '' ? collection!.release_timing_mode : timing,
    timing === '' ? collection!.scheduled_release_at : timing === 'asap' ? null : scheduledAt ?? collection!.scheduled_release_at,
    hasKey(edit, 'originalReleaseDate') ? dateField(edit, 'originalReleaseDate') : collection!.original_release_date, actor, tx.at, collection!.id]);
  const localizations = album ? t('learning', 'album_localizations') : t('learning', 'lesson_set_localizations');
  const owner = album ? col('album_id') : col('lesson_set_id');
  for (const locale of LOCALES) {
    if (!titles[locale]) {
      await tx.run(`DELETE FROM ${localizations} WHERE ${owner} = ? AND ${col('locale')} = ?`, collection!.id, locale);
    } else {
      await tx.run(`INSERT INTO ${localizations} (${owner}, ${col('locale')}, ${col('title')}, ${col('created_at')}, ${col('updated_at')}) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (${owner}, ${col('locale')}) DO UPDATE SET ${col('title')} = excluded.${col('title')}, ${col('updated_at')} = ?`, collection!.id, locale, titles[locale], tx.at, tx.at, tx.at);
    }
  }
  const children = album ? t('learning', 'album_recordings') : t('learning', 'lessons');
  // Live recordings and lessons move out of the way of the new order: their (collection, sort_order) is unique.
  if (live) await tx.run(`UPDATE ${children} SET ${col('sort_order')} = ${col('sort_order')} + 100000 WHERE ${owner} = ?`, collection!.id);

  const kept: string[] = [];
  let mediaChanged = false;
  let added = 0;
  let replaced = 0;
  let deleted = 0;
  for (const [index, entry] of list.entries()) {
    const place = index + 1;
    const intent = toUuid(field(entry, 'uploadIntentId'));
    let itemTitles: Record<string, string>;
    let itemTitle: string | null;
    if (album) {
      // A single recording is titled as its album.
      itemTitles = list.length === 1 ? titles : editLocalizedTitles(arrow(entry, 'localizedTitles'));
      itemTitle = list.length === 1 ? title : editPreferredTitle(itemTitles, arrowText(entry, 'title'));
      if (itemTitle == null) raise(`Add a title in at least one language for recording ${place}.`, '22023');
    } else {
      // Lessons are numbered in order, as when submitting.
      itemTitles = {};
      itemTitle = `Lesson ${place}`;
    }
    const compact = editCompactTitles(itemTitles);
    if (field(entry, 'id') != null) {
      const original = await tx.first(`SELECT * FROM ${ITEMS} WHERE ${col('id')} = ? AND ${col('submission_id')} = ? AND ${col('role')} <> 'artwork' AND ${col('replaces_item_id')} IS NULL`,
        toUuid(arrowText(entry, 'id')), sub.id);
      if (!original) raise(`Item ${place} is not part of this submission`, '22023');
      if (kept.includes(original!.id as string)) raise(`Item ${place} is listed twice`, '22023');
      await tx.run(`UPDATE ${ITEMS} SET ${col('title')} = ?, ${col('localized_titles')} = ?, ${col('sort_order')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ? OR ${col('replaces_item_id')} = ?`,
        itemTitle, jsonbText(compact), place, tx.at, original!.id, original!.id);
      if (live) {
        await tx.run(`UPDATE ${children} SET ${col('title')} = ?, ${col('sort_order')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${owner} = ? AND json_extract(${col('metadata')}, '$.submissionItemId') = ?`,
          itemTitle, place, actor, tx.at, collection!.id, original!.id);
      }
      if (intent != null) {
        if (live) {
          // The live file plays on until this one is approved and processed.
          await tx.run(`DELETE FROM ${ITEMS} WHERE ${col('replaces_item_id')} = ?`, original!.id);
          await addEditItem(ctx, tx, { submissionId: sub.id, intentId: intent, role: original!.role as string, title: itemTitle, sortOrder: place, localizedTitles: compact, trackId: null, replaces: original!.id });
          kept.push(original!.id as string);
        } else {
          const fresh = await addEditItem(ctx, tx, { submissionId: sub.id, intentId: intent, role: original!.role as string, title: itemTitle, sortOrder: place, localizedTitles: compact, trackId: null, replaces: null });
          await tx.run(`DELETE FROM ${ITEMS} WHERE ${col('id')} = ?`, original!.id);
          kept.push(fresh);
        }
        mediaChanged = true;
        replaced += 1;
      } else {
        kept.push(original!.id as string);
      }
    } else {
      if (intent == null) raise(`${album ? 'Recording' : 'Lesson'} ${place} needs a file.`, '22023');
      kept.push(await addEditItem(ctx, tx, { submissionId: sub.id, intentId: intent!, role: 'lesson', title: itemTitle, sortOrder: place, localizedTitles: compact, trackId: null, replaces: null }));
      mediaChanged = true;
      added += 1;
    }
  }
  // Items left out are deleted: their live recording or lesson, and their files.
  const leftOut = (await tx.all(`SELECT ${col('id')} FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('role')} <> 'artwork' AND ${col('replaces_item_id')} IS NULL`, sub.id))
    .filter((item) => !kept.includes(item.id as string));
  for (const removed of leftOut) {
    await tx.batch([
      tx.db.prepare(`DELETE FROM ${children} WHERE ${owner} = ? AND json_extract(${col('metadata')}, '$.submissionItemId') = ?`).bind(collection!.id, removed.id),
      tx.db.prepare(`DELETE FROM ${ITEMS} WHERE ${col('id')} = ?`).bind(removed.id),
    ]);
    deleted += 1;
  }
  // The localized titles of live recordings follow their items.
  if (live && album) {
    const recordings = t('learning', 'album_recordings');
    const statements = [tx.db.prepare(`DELETE FROM ${t('learning', 'recording_localizations')} WHERE ${col('recording_id')} IN (SELECT ${col('id')} FROM ${recordings} WHERE ${col('album_id')} = ?)`).bind(collection!.id)];
    const rows = await tx.all(`SELECT r.${col('id')} AS id, i.${col('localized_titles')} AS titles FROM ${recordings} r JOIN ${ITEMS} i ON i.${col('id')} = json_extract(r.${col('metadata')}, '$.submissionItemId')
      WHERE r.${col('album_id')} = ?`, collection!.id);
    for (const row of rows) {
      for (const [locale, text] of Object.entries(JSON.parse(row.titles as string) as Row)) {
        const value = text == null ? null : typeof text === 'string' ? text : jsonbText(text);
        if (!LOCALES.includes(locale) || cleanText(value) == null) continue;
        statements.push(tx.db.prepare(`INSERT INTO ${t('learning', 'recording_localizations')} (${col('recording_id')}, ${col('locale')}, ${col('title')}, ${col('created_at')}, ${col('updated_at')}) VALUES (?, ?, ?, ?, ?)`)
          .bind(row.id, locale, value, tx.at, tx.at));
      }
    }
    await tx.batch(statements);
  }
  if (coverIntent != null) {
    await replaceArtwork(ctx, tx, sub.id, coverIntent, collection!.cover_asset_id);
    mediaChanged = true;
  }
  await tx.run(`UPDATE ${t('media', 'submissions')} SET ${col('title')} = ?, ${col('description')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
    title, field(edit, 'description'), actor, tx.at, sub.id);
  return { mediaChanged, live, added, replaced, deleted, itemCount: list.length };
}

export async function saveSubmissionEdit(ctx: ApiContext, submissionId: string, edit: unknown): Promise<unknown> {
  const actor = ctx.userId;
  // An admin can give up admin rules for a save; nobody can take them on.
  const isAdmin = (await viewer(ctx)).admin && arrow(edit, 'asCreator') !== true;
  if (!actor) raise('Authentication required', '28000');
  if (edit == null || jsonbType(edit) !== 'object') raise('Nothing to save', '22023');
  await transaction(ctx, async (tx) => {
    const sub = await tx.first(`SELECT * FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submissionId);
    if (!sub) raise('Submission not found', 'P0002');
    if (!(await canEdit(ctx, sub!.creator_account_id))) raise('Not authorized for this submission', '42501');
    if (['rejected', 'archived'].includes(sub!.status as string)) {
      raise('This submission was not approved, so it can no longer be edited. Send a new submission instead.', '22023');
    }
    let outcome: Outcome;
    if (sub!.submission_type === 'music_release') outcome = await saveMusicEdit(ctx, tx, sub!, edit, actor!, isAdmin);
    else if (['learning_album', 'learning_lesson_set'].includes(sub!.submission_type as string)) outcome = await saveLearningEdit(ctx, tx, sub!, edit, actor!, isAdmin);
    else raise('This kind of submission cannot be edited here', '22023');
    await attachCompletedJobs(tx, sub!.id);
    // An artist's edit goes to review when it isn't live yet, or brings new files to live content. An admin's keeps its status.
    const previous = sub!.status as string;
    const next = isAdmin ? previous : previous === 'published' ? (outcome!.mediaChanged ? 'pending_review' : previous) : 'pending_review';
    // Back in review, it reads as a fresh submission: the decision cleared and the clock restarted.
    if (next === 'pending_review' && previous !== next) {
      await tx.run(`UPDATE ${t('media', 'submissions')} SET ${col('status')} = ?, ${col('submitted_at')} = ?, ${col('review_due_at')} = ?, ${col('reviewer_id')} = NULL, ${col('reviewed_at')} = NULL,
        ${col('review_notes')} = NULL, ${col('approved_at')} = NULL, ${col('rejected_at')} = NULL, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
      next, tx.at, addHours(tx.at, 48), actor, tx.at, sub!.id);
    }
    await addEvent(tx, sub!.id, actor, isAdmin ? 'edited_by_admin' : 'edited_by_creator', previous, next, null, outcome!);
    // An admin's new files on live content go live once processed: now, if they already are, else when processing settles.
    if (isAdmin && next === 'published') {
      if (sub!.submission_type === 'music_release') {
        if (await requiredReady(tx, sub!.id) && await musicSubmissionHasPendingEdits(tx, sub!.id)) await publishMusicSubmission(tx, sub!.id, actor, 'admin_edit');
      } else {
        await applyLearningEdits(tx, sub!.id, actor);
      }
    }
  });
  return getSubmissionEditor(ctx, submissionId);
}
