/**
 * Writes migration 0009_user_triggers.sql: Supabase's triggers on the user
 * data (schema/pg-user-schema.sql), as SQLite triggers, so D1 applies them to
 * every write, inside the same transaction, whoever writes; and migration
 * 0010_undo_log.sql (generateUndo, below).
 *
 *   npm run gen:triggers              write the migration
 *   npm run gen:triggers -- --check   fail if it is out of date
 *
 * How Postgres's triggers map onto SQLite's:
 *
 * - On/off. "private.replica_mode" holds a depth; while it is above 0 every
 *   trigger here is off, as Postgres's session_replication_role = replica
 *   turns them off. The import raises it for its whole run. A trigger that
 *   emulates a BEFORE trigger changing NEW raises it around its own update of
 *   the row, since Postgres fires nothing for that change.
 * - Order. SQLite fires a table's triggers for one event newest first;
 *   Postgres fires them in name order. Each table's triggers are created in
 *   reverse name order.
 * - BEFORE triggers that change NEW (a release's artwork, a lesson's audio)
 *   become AFTER triggers that update the row, with the triggers off.
 *   BEFORE triggers that only raise stay BEFORE triggers.
 * - Errors. RAISE(ABORT, 'pg:<SQLSTATE>:<message>'); the Worker answers with
 *   that code and message (src/pg.ts, triggerError).
 * - Statement triggers. The search index's refresh only bumps
 *   "private.search_index_state".version; the Worker rebuilds the index after
 *   the write commits (src/db/searchIndex.ts). The media processor's wake-up
 *   becomes a row in "private.outbox" that the Worker sends.
 * - set_updated_at. Postgres stamps updated_at before every update. 0007's
 *   triggers stamp it after an update that didn't set it; they are made again
 *   here with the on/off guard, and stamp with the triggers off.
 * - private.enqueue_notification is written out at each call: the
 *   notifications (unless the user turned the category off), then a delivery
 *   for each of the user's enabled devices, for the notifications just added
 *   ("private.trigger_marks" holds the highest rowid before them).
 *
 * Not here: media.search_aliases' normalize_search_alias_trigger needs
 * normalize_search_text (src/rpc/search/text.ts). Nothing writes that table;
 * whatever does must store normalized_alias = normalizeSearchText(alias).
 * And lower() is ASCII-only in SQLite, so the artist image sync matches
 * cantor names case-insensitively in ASCII letters only (Postgres: Unicode).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { col, indexName, t } from '../../content-api/src/db/names.ts';
import { NOW_SQL } from './gen-schema.ts';

const OUT = new URL('../../content-api/migrations/0009_user_triggers.sql', import.meta.url);
const SCHEMA_0007 = new URL('../../content-api/migrations/0007_user_schema.sql', import.meta.url);
const TABLES = new URL('../schema/user-tables.json', import.meta.url);

type Event = 'INSERT' | 'UPDATE' | 'DELETE';
type Trigger = {
  /** Postgres's trigger name: SQLite's is "<schema>.<table>_<name>_<event>". */
  name: string;
  table: [string, string];
  timing: 'BEFORE' | 'AFTER';
  events: Event[];
  /** UPDATE OF these columns. */
  of?: string[];
  /** A condition on NEW and OLD, for each event. */
  when?: (event: Event) => string | null;
  body: (event: Event) => string[];
};

const ACTIVE = `(SELECT ${col('depth')} FROM ${t('private', 'replica_mode')}) = 0`;
const PAUSE = `UPDATE ${t('private', 'replica_mode')} SET ${col('depth')} = ${col('depth')} + 1;`;
const RESUME = `UPDATE ${t('private', 'replica_mode')} SET ${col('depth')} = ${col('depth')} - 1;`;
const sql = (text: string) => `'${text.split("'").join("''")}'`;
const raise = (code: string, message: string) => `RAISE(ABORT, 'pg:${code}:' || ${message})`;
const NEW = (name: string) => `NEW.${col(name)}`;
const OLD = (name: string) => `OLD.${col(name)}`;

/** jsonb_build_object as Postgres prints it: keys by length, then bytes; ", " and ": " between. */
function jsonbObject(entries: Record<string, string>): string {
  const keys = Object.keys(entries).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return `'{' || ${keys.map((key, i) => `'${i ? ', ' : ''}"${key}": ' || json_quote(${entries[key]})`).join(' || ')} || '}'`;
}

/**
 * private.enqueue_notification for each user of `audience` (a query of
 * distinct "user_id"s): the notification, unless the user turned the
 * category off, then deliveries to their enabled Expo and Web Push devices.
 */
function enqueue(audience: string, n: { app: string; category: string; event: string; title: string; body: string; link: string; payload: string }): string[] {
  const notifications = t('public', 'notifications');
  const mark = `(SELECT ${col('value')} FROM ${t('private', 'trigger_marks')} WHERE ${col('name')} = 'notifications')`;
  return [
    `UPDATE ${t('private', 'trigger_marks')} SET ${col('value')} = (SELECT coalesce(max(rowid), 0) FROM ${notifications}) WHERE ${col('name')} = 'notifications';`,
    `INSERT INTO ${notifications} (${['user_id', 'app_key', 'category', 'event_type', 'title', 'body', 'deep_link', 'image_url', 'payload'].map(col).join(', ')})
    SELECT audience.${col('user_id')}, ${sql(n.app)}, ${sql(n.category)}, ${n.event}, ${n.title}, ${n.body}, ${n.link}, NULL, ${n.payload}
    FROM (${audience}) audience
    WHERE audience.${col('user_id')} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${t('public', 'notification_preferences')} pref
      WHERE pref.${col('user_id')} = audience.${col('user_id')} AND pref.${col('app_key')} = ${sql(n.app)} AND pref.${col('category')} = ${sql(n.category)} AND pref.${col('enabled')} = 0);`,
    `INSERT INTO ${t('private', 'notification_deliveries')} (${['notification_id', 'device_id', 'provider'].map(col).join(', ')})
    SELECT n.${col('id')}, d.${col('id')}, d.${col('provider')} FROM ${notifications} n
    JOIN ${t('public', 'notification_devices')} d ON d.${col('user_id')} = n.${col('user_id')} AND d.${col('app_key')} = n.${col('app_key')} AND d.${col('enabled')} = 1 AND d.${col('provider')} IN ('expo', 'web_push')
    WHERE n.rowid > ${mark}
    ON CONFLICT (${col('notification_id')}, ${col('device_id')}) DO NOTHING;`,
  ];
}

const ADMINS = `SELECT DISTINCT ur.${col('user_id')} FROM ${t('creator', 'user_roles')} ur WHERE ur.${col('role')} = 'admin' AND ur.${col('revoked_at')} IS NULL`;
const members = (account: string) => `SELECT DISTINCT m.${col('user_id')} FROM ${t('creator', 'creator_account_members')} m WHERE m.${col('creator_account_id')} = ${account}`;

/** private.publish_public_profile_image, on music.artists and learning.cantors. */
const publishProfileImage = (table: [string, string]): Trigger => ({
  name: table[0] === 'music' ? 'music_artist_publish_profile_image' : 'learning_cantor_publish_profile_image',
  table, timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['profile_image_asset_id', 'publication_status'],
  when: () => `${NEW('publication_status')} = 'published' AND ${NEW('profile_image_asset_id')} IS NOT NULL`,
  body: () => [`UPDATE ${t('media', 'media_assets')} SET ${col('publication_status')} = 'published', ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col('id')} = ${NEW('profile_image_asset_id')} AND ${col('processing_status')} = 'completed';`],
});

/** private.sync_music_release_type(release): single, EP or album by its track count, unless it has none. */
function syncReleaseType(release: string): string {
  const count = `(SELECT count(*) FROM ${t('music', 'release_tracks')} rt WHERE rt.${col('release_id')} = ${release})`;
  const inferred = `(CASE WHEN ${count} = 1 THEN 'single' WHEN ${count} BETWEEN 2 AND 6 THEN 'ep' ELSE 'album' END)`;
  return `UPDATE ${t('music', 'releases')} SET ${col('release_type')} = ${inferred}, ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col('id')} = ${release} AND ${count} > 0 AND ${col('release_type')} IS NOT ${inferred};`;
}

/** The artists a release credits: its primary artist and its tracks' artists. */
const releaseArtists = (release: string) => `SELECT r.${col('primary_artist_id')} FROM ${t('music', 'releases')} r WHERE r.${col('id')} = ${release} AND r.${col('primary_artist_id')} IS NOT NULL
      UNION SELECT ta.${col('artist_id')} FROM ${t('music', 'release_tracks')} rt JOIN ${t('music', 'track_artists')} ta ON ta.${col('track_id')} = rt.${col('track_id')} WHERE rt.${col('release_id')} = ${release}`;
const releaseTracks = (release: string) => `SELECT rt.${col('track_id')} FROM ${t('music', 'release_tracks')} rt WHERE rt.${col('release_id')} = ${release}`;

/** private.publish_music_release_consumer_dependencies(release, actor). */
function publishReleaseDependencies(release: string, actor: string): string[] {
  const publish = (table: [string, string], key: string, ids: string, extra = '') => `UPDATE ${t(...table)} SET ${col('publication_status')} = 'published', ${col('updated_by')} = coalesce(${actor}, ${col('updated_by')}), ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col(key)} IN (${ids}) AND ${col('publication_status')} <> 'published'${extra};`;
  const lines = t('music', 'lyric_lines');
  const set = t('music', 'lyric_sets');
  return [
    publish(['music', 'artists'], 'id', releaseArtists(release)),
    publish(['music', 'artist_localizations'], 'artist_id', releaseArtists(release)),
    publish(['music', 'tracks'], 'id', releaseTracks(release)),
    publish(['music', 'track_localizations'], 'track_id', releaseTracks(release)),
    publish(['music', 'lyric_sets'], 'track_id', releaseTracks(release), `
      AND ${col('sync_precision')} IN ('line', 'word')
      AND EXISTS (SELECT 1 FROM ${lines} l WHERE l.${col('lyric_set_id')} = ${set}.${col('id')})
      AND NOT EXISTS (SELECT 1 FROM ${lines} l WHERE l.${col('lyric_set_id')} = ${set}.${col('id')} AND l.${col('start_ms')} IS NULL)
      AND NOT EXISTS (SELECT 1 FROM (SELECT l.${col('start_ms')} AS start_ms, lag(l.${col('start_ms')}) OVER (ORDER BY l.${col('sequence')}) AS previous_start_ms
        FROM ${lines} l WHERE l.${col('lyric_set_id')} = ${set}.${col('id')}) o WHERE o.previous_start_ms IS NOT NULL AND o.start_ms < o.previous_start_ms)
      AND NOT EXISTS (SELECT 1 FROM (SELECT l.${col('end_ms')} AS end_ms, lead(l.${col('start_ms')}) OVER (ORDER BY l.${col('sequence')}) AS next_start_ms
        FROM ${lines} l WHERE l.${col('lyric_set_id')} = ${set}.${col('id')}) o WHERE o.end_ms IS NOT NULL AND o.next_start_ms IS NOT NULL AND o.end_ms > o.next_start_ms)`),
  ];
}

const RELEASES = t('music', 'releases');
const ASSETS = t('media', 'media_assets');
const releaseRow = (column: string) => `(SELECT ${col(column)} FROM ${RELEASES} WHERE rowid = NEW.rowid)`;

const TRIGGERS: Trigger[] = [
  publishProfileImage(['learning', 'cantors']),
  {
    name: 'learning_lesson_attach_audio_asset', table: ['learning', 'lessons'], timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['publication_status'],
    when: () => `${NEW('media_type')} = 'video' AND json_type(${NEW('metadata')}, '$.submissionItemId') IS NOT NULL`,
    body: () => {
      const audio = `(SELECT si.${col('audio_only_asset_id')} FROM ${t('media', 'submission_items')} si WHERE si.${col('id')} = json_extract(${NEW('metadata')}, '$.submissionItemId'))`;
      return [
        PAUSE,
        `UPDATE ${t('learning', 'lessons')} SET ${col('audio_asset_id')} = ${audio} WHERE rowid = NEW.rowid;`,
        RESUME,
        `UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_by')} = coalesce(${NEW('updated_by')}, ${NEW('created_by')}), ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col('id')} = ${audio} AND ${NEW('publication_status')} = 'published';`,
      ];
    },
  },
  {
    name: 'media_processing_jobs_wake', table: ['media', 'media_processing_jobs'], timing: 'AFTER', events: ['INSERT', 'UPDATE'],
    when: () => `${NEW('status')} = 'queued'`,
    body: () => [`INSERT INTO ${t('private', 'outbox')} (${col('kind')}, ${col('requested_at')}) VALUES ('wake_media_processor', ${NOW_SQL}) ON CONFLICT (${col('kind')}) DO NOTHING;`],
  },
  {
    name: 'notify_processing_failure', table: ['media', 'media_processing_jobs'], timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['status'],
    when: (event) => `${NEW('status')} = 'failed'${event === 'UPDATE' ? ` AND ${OLD('status')} <> 'failed'` : ''}`,
    body: () => {
      const payload = jsonbObject({ job_id: NEW('id') });
      return [
        ...enqueue(ADMINS, { app: 'chc_admin', category: 'processing_failures', event: sql('media_processing_failed'), title: sql('Media processing failed'), body: sql('A media processing job requires attention.'), link: sql('/processing'), payload }),
        ...enqueue(`SELECT DISTINCT m.${col('user_id')} FROM ${t('media', 'submission_items')} si JOIN ${t('media', 'submissions')} s ON s.${col('id')} = si.${col('submission_id')}
      JOIN ${t('creator', 'creator_account_members')} m ON m.${col('creator_account_id')} = s.${col('creator_account_id')} WHERE si.${col('media_processing_job_id')} = ${NEW('id')}`,
        { app: 'chc_artists', category: 'processing_errors', event: sql('media_processing_failed'), title: sql('Media processing needs attention'), body: sql('Coptic Vine could not finish processing one of your uploaded files.'), link: sql('/'), payload }),
      ];
    },
  },
  {
    name: 'notify_submission_status', table: ['media', 'submissions'], timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['status'],
    when: (event) => (event === 'UPDATE' ? `${OLD('status')} <> ${NEW('status')}` : null),
    body: () => {
      const status = NEW('status');
      const live = `${status} IN ('approved', 'changes_requested', 'rejected', 'published') AND NOT (${status} = 'published' AND ${NEW('submission_type')} = 'music_release')`;
      return [
        ...enqueue(`${ADMINS} AND ${status} = 'pending_review'`, {
          app: 'chc_admin', category: 'new_submissions', event: sql('submission_pending_review'), title: sql('New submission'),
          body: `${NEW('title')} || ' is ready for review.'`, link: `'/submission/' || ${NEW('id')}`,
          payload: jsonbObject({ submission_id: NEW('id'), submission_type: NEW('submission_type') }),
        }),
        ...enqueue(`${members(NEW('creator_account_id'))} AND ${live}`, {
          app: 'chc_artists', category: 'submission_updates', event: `'submission_' || ${status}`,
          title: `CASE ${status} WHEN 'approved' THEN 'Submission approved' WHEN 'changes_requested' THEN 'Changes requested' WHEN 'rejected' THEN 'Submission not approved' WHEN 'published' THEN 'Submission is live' END`,
          body: `CASE ${status} WHEN 'approved' THEN ${NEW('title')} || ' has been approved.' WHEN 'changes_requested' THEN 'Coptic Vine requested changes to ' || ${NEW('title')} || '.'
            WHEN 'rejected' THEN ${NEW('title')} || ' was not approved.' WHEN 'published' THEN ${NEW('title')} || ' is now available on Coptic Vine.' END`,
          link: `'/submission/' || ${NEW('id')}`,
          payload: jsonbObject({ submission_id: NEW('id'), submission_type: NEW('submission_type'), status }),
        }),
      ];
    },
  },
  publishProfileImage(['music', 'artists']),
  {
    name: 'music_artist_sync_learning_cantor_image', table: ['music', 'artists'], timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['profile_image_asset_id', 'display_name'],
    when: () => `${NEW('profile_image_asset_id')} IS NOT NULL`,
    body: (event) => [`UPDATE ${t('learning', 'cantors')} SET ${col('profile_image_asset_id')} = ${NEW('profile_image_asset_id')}, ${col('updated_at')} = ${NOW_SQL}
    WHERE lower(trim(${col('display_name')})) = lower(trim(${NEW('display_name')}))
      AND (${col('profile_image_asset_id')} IS NULL${event === 'UPDATE' ? ` OR ${col('profile_image_asset_id')} = ${OLD('profile_image_asset_id')}` : ''});`],
  },
  {
    name: 'sync_canonical_artist_to_learning', table: ['music', 'artists'], timing: 'AFTER', events: ['UPDATE'], of: ['display_name', 'profile_image_asset_id', 'publication_status', 'owner_creator_account_id'],
    when: () => ['display_name', 'profile_image_asset_id', 'publication_status', 'owner_creator_account_id'].map((c) => `${OLD(c)} IS NOT ${NEW(c)}`).join(' OR '),
    body: () => [`UPDATE ${t('learning', 'cantors')} SET ${col('display_name')} = ${NEW('display_name')}, ${col('profile_image_asset_id')} = ${NEW('profile_image_asset_id')},
      ${col('publication_status')} = CASE WHEN ${NEW('publication_status')} = 'published' OR ${NEW('is_credit_only')} THEN 'published' ELSE ${col('publication_status')} END,
      ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col('artist_id')} = ${NEW('id')}
      AND (${col('display_name')} IS NOT ${NEW('display_name')} OR ${col('profile_image_asset_id')} IS NOT ${NEW('profile_image_asset_id')}
        OR (${NEW('publication_status')} = 'published' AND ${col('publication_status')} <> 'published'));`],
  },
  {
    name: 'release_tracks_sync_release_type', table: ['music', 'release_tracks'], timing: 'AFTER', events: ['INSERT', 'UPDATE', 'DELETE'], of: ['release_id'],
    body: (event) => (event === 'DELETE' ? [syncReleaseType(OLD('release_id'))]
      : event === 'INSERT' ? [syncReleaseType(NEW('release_id'))]
        : [syncReleaseType(NEW('release_id')), `${syncReleaseType(OLD('release_id')).slice(0, -1)} AND ${OLD('release_id')} IS NOT ${NEW('release_id')};`]),
  },
  {
    name: 'music_release_retire_submission_on_delete', table: ['music', 'releases'], timing: 'BEFORE', events: ['DELETE'],
    body: () => [`UPDATE ${t('media', 'submissions')} SET ${col('status')} = 'rejected', ${col('rejected_at')} = coalesce(${col('rejected_at')}, ${NOW_SQL}),
      ${col('review_notes')} = coalesce(nullif(${col('review_notes')}, ''), 'The linked music release was deleted from the catalog.'), ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col('id')} = nullif(json_extract(${OLD('metadata')}, '$.submissionId'), '') AND ${col('status')} NOT IN ('published', 'rejected');`],
  },
  {
    name: 'releases_enforce_identity_artist', table: ['music', 'releases'], timing: 'BEFORE', events: ['INSERT', 'UPDATE'], of: ['owner_creator_account_id', 'primary_artist_id'],
    when: () => `${NEW('owner_creator_account_id')} IS NOT NULL AND ${NEW('primary_artist_id')} IS NOT NULL`,
    body: () => {
      const account = (column: string) => `(SELECT a.${col(column)} FROM ${t('creator', 'creator_accounts')} a WHERE a.${col('id')} = ${NEW('owner_creator_account_id')})`;
      return [
        `SELECT ${raise('22023', `'Creator account ' || coalesce(${account('display_name')}, ${NEW('owner_creator_account_id')}) || ' has no artist identity yet'`)} WHERE ${account('identity_artist_id')} IS NULL;`,
        `SELECT ${raise('42501', sql("A release can only be published under its own account's artist identity"))} WHERE ${NEW('primary_artist_id')} <> ${account('identity_artist_id')};`,
      ];
    },
  },
  {
    name: 'releases_enforce_scheduling_window', table: ['music', 'releases'], timing: 'BEFORE', events: ['INSERT', 'UPDATE'], of: ['scheduled_release_at'],
    when: (event) => `${NEW('scheduled_release_at')} IS NOT NULL${event === 'UPDATE' ? ` AND ${OLD('scheduled_release_at')} IS NOT ${NEW('scheduled_release_at')}` : ''}`,
    body: () => [`SELECT ${raise('22023', `'A release must be scheduled at least 48 hours out (earliest ' || strftime('%Y-%m-%d %H:00', 'now', '+48 hours') || ' UTC)'`)}
    WHERE ${NEW('scheduled_release_at')} < strftime('%Y-%m-%dT%H:00:00', 'now', '+48 hours') || '+00:00';`],
  },
  {
    // Postgres: BEFORE, setting NEW.cover_asset_id to the submission's newest processed artwork.
    name: 'music_release_prepare_artwork_for_publication', table: ['music', 'releases'], timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['publication_status'],
    when: () => `${NEW('publication_status')} = 'published'`,
    body: () => {
      const items = t('media', 'submission_items');
      const newest = `(SELECT item.${col('media_asset_id')} FROM ${items} item JOIN ${ASSETS} asset ON asset.${col('id')} = item.${col('media_asset_id')} AND asset.${col('processing_status')} = 'completed'
      WHERE item.${col('submission_id')} = nullif(json_extract(${NEW('metadata')}, '$.submissionId'), '') AND item.${col('role')} = 'artwork' AND item.${col('media_asset_id')} IS NOT NULL
      ORDER BY item.${col('created_at')} DESC, item.${col('id')} DESC LIMIT 1)`;
      const cover = releaseRow('cover_asset_id');
      const old = NEW('cover_asset_id');
      const inUse = (table: [string, string], column: string, extra = '') => `EXISTS (SELECT 1 FROM ${t(...table)} x WHERE x.${col(column)} = ${old}${extra})`;
      return [
        PAUSE,
        `UPDATE ${RELEASES} SET ${col('cover_asset_id')} = coalesce(${newest}, ${col('cover_asset_id')}) WHERE rowid = NEW.rowid;`,
        RESUME,
        `UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_at')} = ${NOW_SQL} WHERE ${col('id')} = ${cover} AND ${col('processing_status')} = 'completed';`,
        `UPDATE ${ASSETS} SET ${col('publication_status')} = 'archived', ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col('id')} = ${old} AND ${cover} IS NOT ${old}
      AND NOT ${inUse(['music', 'releases'], 'cover_asset_id', ` AND x.${col('id')} <> ${NEW('id')}`)}
      AND NOT ${inUse(['music', 'artists'], 'profile_image_asset_id')} AND NOT ${inUse(['learning', 'cantors'], 'profile_image_asset_id')};`,
        `UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_at')} = ${NOW_SQL}
    WHERE ${col('id')} IN (SELECT a.${col('profile_image_asset_id')} FROM ${t('music', 'artists')} a WHERE a.${col('profile_image_asset_id')} IS NOT NULL AND a.${col('id')} IN (${releaseArtists(NEW('id'))}))
      AND ${col('processing_status')} = 'completed';`,
      ];
    },
  },
  {
    name: 'music_release_publish_consumer_dependencies', table: ['music', 'releases'], timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['publication_status'],
    when: () => `${NEW('publication_status')} = 'published'`,
    body: () => publishReleaseDependencies(NEW('id'), `coalesce(${NEW('updated_by')}, ${NEW('created_by')})`),
  },
  {
    name: 'notify_release_published', table: ['music', 'releases'], timing: 'AFTER', events: ['INSERT', 'UPDATE'], of: ['publication_status'],
    when: (event) => `${NEW('publication_status')} = 'published'${event === 'UPDATE' ? ` AND ${OLD('publication_status')} <> 'published'` : ''}`,
    body: () => {
      const artist = `coalesce((SELECT a.${col('display_name')} FROM ${t('music', 'artists')} a WHERE a.${col('id')} = ${NEW('primary_artist_id')}), 'Coptic Vine')`;
      return [
        ...enqueue(`SELECT f.${col('user_id')} FROM ${t('music', 'artist_follows')} f WHERE f.${col('artist_id')} = ${NEW('primary_artist_id')}`, {
          app: 'chc', category: 'followed_artists', event: sql('release_published'), title: `'New from ' || ${artist}`,
          body: `${NEW('title')} || ' is now available on Coptic Vine.'`, link: `'/music/release/' || ${NEW('id')}`,
          payload: jsonbObject({ release_id: NEW('id'), artist_id: NEW('primary_artist_id') }),
        }),
        ...enqueue(members(NEW('owner_creator_account_id')), {
          app: 'chc_artists', category: 'release_updates', event: sql('release_published'), title: sql('Release is live'),
          body: `${NEW('title')} || ' is now available on Coptic Vine.'`, link: `'/release/' || ${NEW('id')}`,
          payload: jsonbObject({ release_id: NEW('id') }),
        }),
      ];
    },
  },
];

function render(trigger: Trigger): string[] {
  const [schema, table] = trigger.table;
  return trigger.events.map((event) => {
    const condition = [ACTIVE, trigger.when?.(event)].filter(Boolean).map((c) => `(${c})`).join(' AND ');
    const on = event === 'UPDATE' && trigger.of ? `UPDATE OF ${trigger.of.map(col).join(', ')}` : event;
    return [
      `CREATE TRIGGER ${indexName(schema, `${table}_${trigger.name}_${event.toLowerCase()}`)} ${trigger.timing} ${on} ON ${t(schema, table)}`,
      `FOR EACH ROW WHEN ${condition}`,
      'BEGIN',
      ...trigger.body(event).map((statement) => `  ${statement}`),
      'END;',
    ].join('\n');
  });
}

export function generate(): string {
  const users = JSON.parse(readFileSync(TABLES, 'utf8')) as { tables: { schema: string; table: string; workerTriggers: string[] }[] };
  const out = [
    '-- Generated by workers/api/scripts/gen-triggers.ts (npm run gen:triggers); do not edit.',
    "-- Supabase's triggers on the user data, as SQLite triggers. See the script for how they map.",
    '',
    `CREATE TABLE ${t('private', 'replica_mode')} (${col('id')} INTEGER PRIMARY KEY CHECK (${col('id')} = 1), ${col('depth')} INTEGER NOT NULL CHECK (${col('depth')} >= 0)) STRICT;`,
    `INSERT INTO ${t('private', 'replica_mode')} VALUES (1, 0);`,
    `CREATE TABLE ${t('private', 'trigger_marks')} (${col('name')} TEXT PRIMARY KEY, ${col('value')} INTEGER NOT NULL) STRICT;`,
    `INSERT INTO ${t('private', 'trigger_marks')} VALUES ('notifications', 0);`,
    `CREATE TABLE ${t('private', 'search_index_state')} (${col('id')} INTEGER PRIMARY KEY CHECK (${col('id')} = 1), ${col('version')} INTEGER NOT NULL, ${col('built_version')} INTEGER NOT NULL) STRICT;`,
    `INSERT INTO ${t('private', 'search_index_state')} VALUES (1, 0, 0);`,
    `CREATE TABLE ${t('private', 'outbox')} (${col('kind')} TEXT PRIMARY KEY, ${col('requested_at')} TEXT NOT NULL) STRICT;`,
    '',
    '-- set_updated_at, with the on/off guard.',
  ];
  const schema0007 = readFileSync(SCHEMA_0007, 'utf8');
  for (const match of schema0007.matchAll(/^CREATE TRIGGER ("[^"]+") AFTER UPDATE ON ("[^"]+")\nFOR EACH ROW WHEN NEW\."updated_at" IS OLD\."updated_at"\n/gm)) {
    out.push(
      `DROP TRIGGER ${match[1]};`,
      `CREATE TRIGGER ${match[1]} AFTER UPDATE ON ${match[2]}`,
      `FOR EACH ROW WHEN NEW.${col('updated_at')} IS OLD.${col('updated_at')} AND ${ACTIVE}`,
      'BEGIN',
      `  ${PAUSE}`,
      `  UPDATE ${match[2]} SET ${col('updated_at')} = ${NOW_SQL} WHERE rowid = NEW.rowid;`,
      `  ${RESUME}`,
      'END;',
    );
  }
  if (out.filter((line) => line.startsWith('DROP TRIGGER')).length !== 50) throw new Error('0007 should have 50 updated_at triggers');

  out.push('', "-- private.refresh_unified_search_index_trigger: the index is rebuilt after the write (src/db/searchIndex.ts).");
  const search = users.tables.filter((table) => table.workerTriggers.includes('private.refresh_unified_search_index_trigger'));
  for (const { schema, table } of search) {
    for (const event of ['INSERT', 'UPDATE', 'DELETE'] as Event[]) {
      out.push(render({
        name: 'refresh_unified_search', table: [schema, table], timing: 'AFTER', events: [event],
        body: () => [`UPDATE ${t('private', 'search_index_state')} SET ${col('version')} = ${col('version')} + 1;`],
      })[0]);
    }
  }

  // Every other worker trigger must be here (or explained above).
  const covered = new Set(['private.refresh_unified_search_index_trigger', 'private.normalize_search_alias_trigger']);
  const names = new Map(TRIGGERS.map((trigger) => [`${trigger.table.join('.')}:${trigger.name}`, trigger]));
  const expected: Record<string, string> = {
    'private.publish_public_profile_image': 'publish_profile_image', 'private.attach_lesson_audio_asset': 'learning_lesson_attach_audio_asset',
    'private.wake_media_processor': 'media_processing_jobs_wake', 'private.notify_processing_failure': 'notify_processing_failure',
    'private.notify_submission_status': 'notify_submission_status', 'private.sync_music_artist_image_to_learning_cantor': 'music_artist_sync_learning_cantor_image',
    'private.sync_learning_artist_identity': 'sync_canonical_artist_to_learning', 'private.sync_music_release_type_trigger': 'release_tracks_sync_release_type',
    'private.prepare_music_release_artwork_for_publication': 'music_release_prepare_artwork_for_publication',
    'private.on_music_release_publish_consumer_dependencies': 'music_release_publish_consumer_dependencies',
    'private.retire_submission_when_music_release_deleted': 'music_release_retire_submission_on_delete', 'private.notify_release_published': 'notify_release_published',
    'private.enforce_release_identity_artist': 'releases_enforce_identity_artist', 'private.enforce_release_scheduling_window': 'releases_enforce_scheduling_window',
  };
  for (const table of users.tables) {
    for (const fn of table.workerTriggers) {
      if (covered.has(fn)) continue;
      const suffix = expected[fn];
      if (!suffix || ![...names.keys()].some((key) => key.startsWith(`${table.schema}.${table.table}:`) && key.endsWith(suffix))) {
        throw new Error(`${table.schema}.${table.table}: ${fn} has no SQLite trigger`);
      }
    }
  }

  // Postgres fires a table's triggers in name order (BEFORE ones first); SQLite fires the newest first.
  const byTable = new Map<string, Trigger[]>();
  for (const trigger of TRIGGERS) byTable.set(trigger.table.join('.'), [...(byTable.get(trigger.table.join('.')) ?? []), trigger]);
  for (const [name, triggers] of byTable) {
    out.push('', `-- ${name}`);
    for (const trigger of [...triggers].sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))) out.push(...render(trigger));
  }
  return `${out.join('\n')}\n`;
}

const UNDO_OUT = new URL('../../content-api/migrations/0010_undo_log.sql', import.meta.url);

/**
 * Migration 0010: the undo log that makes a multi-statement function atomic
 * on D1 (src/db/transaction.ts). While "private.transaction".current names a
 * transaction, every write to a user table records its inverse: the rowid of
 * an inserted row, or the whole old row (as JSON) of an updated or deleted
 * one. Created after 0009's, these triggers fire first, so the log follows
 * the order of the writes. Generated columns aren't recorded: they follow.
 */
export function generateUndo(): string {
  const users = JSON.parse(readFileSync(TABLES, 'utf8')) as { tables: { schema: string; table: string; columns: { name: string; generated: boolean }[] }[] };
  const current = `(SELECT ${col('current')} FROM ${t('private', 'transaction')} WHERE ${col('id')} = 1)`;
  const out = [
    '-- Generated by workers/api/scripts/gen-triggers.ts (npm run gen:triggers); do not edit.',
    '-- The undo log of src/db/transaction.ts: what a transaction wrote, to roll it back.',
    '',
    `CREATE TABLE ${t('private', 'transaction')} (${col('id')} INTEGER PRIMARY KEY CHECK (${col('id')} = 1), ${col('current')} TEXT) STRICT;`,
    `INSERT INTO ${t('private', 'transaction')} VALUES (1, NULL);`,
    `CREATE TABLE ${t('private', 'undo_log')} (${col('seq')} INTEGER PRIMARY KEY AUTOINCREMENT, ${col('txn')} TEXT NOT NULL, ${col('table_name')} TEXT NOT NULL,`,
    `  ${col('op')} TEXT NOT NULL CHECK (${col('op')} IN ('insert', 'update', 'delete')), ${col('row')} INTEGER NOT NULL, ${col('old')} TEXT, ${col('at')} TEXT NOT NULL DEFAULT ${NOW_SQL}) STRICT;`,
    `CREATE INDEX ${indexName('private', 'undo_log_txn_idx')} ON ${t('private', 'undo_log')} (${col('txn')}, ${col('seq')});`,
  ];
  for (const table of users.tables) {
    const name = t(table.schema, table.table);
    const old = `json_object(${table.columns.filter((c) => !c.generated).map((c) => `'${c.name}', OLD.${col(c.name)}`).join(', ')})`;
    const log = (op: string, row: string, value: string) => `INSERT INTO ${t('private', 'undo_log')} (${['txn', 'table_name', 'op', 'row', 'old'].map(col).join(', ')}) VALUES (${current}, '${table.schema}.${table.table}', '${op}', ${row}, ${value});`;
    out.push('');
    for (const [event, row, value] of [['INSERT', 'NEW.rowid', 'NULL'], ['UPDATE', 'OLD.rowid', old], ['DELETE', 'OLD.rowid', old]]) {
      out.push(
        `CREATE TRIGGER ${indexName(table.schema, `${table.table}_undo_${event.toLowerCase()}`)} AFTER ${event} ON ${name}`,
        `FOR EACH ROW WHEN ${current} IS NOT NULL`,
        'BEGIN',
        `  ${log(event.toLowerCase(), row, value)}`,
        'END;',
      );
    }
  }
  return `${out.join('\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [file, migration] of [[OUT, generate()], [UNDO_OUT, generateUndo()]] as const) {
    const name = file.pathname.split('/').pop();
    if (process.argv.includes('--check')) {
      if (readFileSync(file, 'utf8') !== migration) {
        console.error(`${name} is out of date: npm run gen:triggers`);
        process.exit(1);
      }
      console.log(`${name} is up to date.`);
    } else {
      writeFileSync(file, migration);
      console.log(`Wrote ${name}.`);
    }
  }
}
