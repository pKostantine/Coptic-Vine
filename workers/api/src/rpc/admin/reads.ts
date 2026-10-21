/**
 * CV-Admin's reads: ports of public.is_chc_admin, get_admin_review_queue,
 * get_admin_submission_detail, get_admin_publication_overview,
 * get_admin_processing_jobs, get_admin_artists, get_admin_artist_profile,
 * get_admin_creator_artist_claims and
 * get_admin_notification_broadcast_overview (schema/pg-user-schema.sql),
 * checked by tests/admin.parity.test.ts.
 *
 * They are SECURITY DEFINER: an admin sees every row, so there are no
 * visibility fragments here, only the admin check each one starts with.
 * Where Postgres takes an unordered `LIMIT 1`, the port takes the first row
 * written (rowid order), as Postgres's scan of these small tables does.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { compareText } from '../../../../content-api/src/pg.ts';
import { raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { pgTimestamp } from '../../time.ts';
import { trimSpaces } from '../creator/core.ts';
import { normalizeCreatorName } from '../creator/reads.ts';
import {
  all, enumOrder, enumValues, epochVersion, first, ilike, IN_LIST, metadataText, order, payload, releaseDisplayDate, requireAdmin, requiredItemsReady,
  requireSignedInAdmin, stripNullsDeep, viewer, type Row,
} from './shared.ts';

const SUBMISSIONS = t('media', 'submissions');
const ITEMS = t('media', 'submission_items');
const INTENTS = t('media', 'upload_intents');
const ASSETS = t('media', 'media_assets');
const JOBS = t('media', 'media_processing_jobs');
const ACCOUNTS = t('creator', 'creator_accounts');
const ARTISTS = t('music', 'artists');
const RELEASES = t('music', 'releases');
const RELEASE_TRACKS = t('music', 'release_tracks');
const TRACK_ARTISTS = t('music', 'track_artists');
const USERS = t('auth', 'users');

const list = (values: unknown[]) => JSON.stringify([...new Set(values.filter((value) => value != null))]);
const bool = (value: unknown) => (value == null ? null : value === 1 || value === true);
/** A date as a timestamptz (date::timestamptz, in UTC). */
const dateAsTimestamp = (date: unknown) => (date == null ? null : `${date as string}T00:00:00+00:00`);
const nowStored = () => pgTimestamp(new Date());
const plusHours = (at: string, hours: number) => pgTimestamp(new Date(Date.parse(at) + hours * 3600_000));
/** uuid order: by the bytes, which for the lowercase text is plain string order. */
const byUuid = (a: unknown, b: unknown) => ((a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0);

// ── is_chc_admin ──────────────────────────────────────────────────────────

/** public.is_chc_admin(): private.is_admin(). */
export async function isChcAdmin(ctx: ApiContext): Promise<boolean> {
  return (await viewer(ctx)).admin;
}

// ── Artists ───────────────────────────────────────────────────────────────

/** private.admin_artist_json for each artist, in the order given. */
async function adminArtistsJson(ctx: ApiContext, artists: Row[]): Promise<Row[]> {
  if (!artists.length) return [];
  const ids = list(artists.map((a) => a.id));
  const [accounts, images, links, credits, releases, membership] = await Promise.all([
    all(ctx, `SELECT ${col('id')}, ${col('display_name')}, ${col('identity_artist_id')} FROM ${ACCOUNTS} WHERE ${col('identity_artist_id')} IN ${IN_LIST} ORDER BY rowid`, ids),
    all(ctx, `SELECT * FROM ${ASSETS} WHERE ${col('id')} IN ${IN_LIST}`, list(artists.map((a) => a.profile_image_asset_id))),
    all(ctx, `SELECT * FROM ${t('music', 'artist_social_links')} WHERE ${col('artist_id')} IN ${IN_LIST}`, ids),
    all(ctx, `SELECT ${col('artist_id')} AS id, count(DISTINCT ${col('track_id')}) AS n FROM ${TRACK_ARTISTS} WHERE ${col('artist_id')} IN ${IN_LIST} GROUP BY ${col('artist_id')}`, ids),
    all(ctx, `SELECT ${col('primary_artist_id')} AS id, count(*) AS n FROM ${RELEASES} WHERE ${col('primary_artist_id')} IN ${IN_LIST} GROUP BY ${col('primary_artist_id')}`, ids),
    // private.admin_artist_upload_account's last resort: the admin's own first workspace they may upload to.
    first(ctx, `SELECT ${col('creator_account_id')} AS id FROM ${t('creator', 'creator_account_members')} WHERE ${col('user_id')} = ? AND ${col('role')} IN ('owner', 'manager', 'editor', 'uploader')
      ORDER BY ${col('created_at')}, rowid LIMIT 1`, ctx.userId),
  ]);
  const workspaceOf = new Map<unknown, Row>();
  for (const account of accounts) if (!workspaceOf.has(account.identity_artist_id)) workspaceOf.set(account.identity_artist_id, account);
  const imageOf = new Map(images.map((image) => [image.id, image]));
  const creditsOf = new Map(credits.map((row) => [row.id, row.n]));
  const releasesOf = new Map(releases.map((row) => [row.id, row.n]));
  return artists.map((artist) => {
    const workspace = workspaceOf.get(artist.id);
    const image = imageOf.get(artist.profile_image_asset_id);
    const own = links.filter((link) => link.artist_id === artist.id).sort((a, b) => order.number(a.sort_order, b.sort_order) || order.text(a.platform, b.platform));
    return {
      id: artist.id,
      displayName: artist.display_name,
      biography: artist.biography,
      isCreditOnly: bool(artist.is_credit_only),
      publicationStatus: artist.publication_status,
      workspace: workspace ? { id: workspace.id, displayName: workspace.display_name } : null,
      profileImage: image ? { assetId: image.id, bucket: image.bucket, path: image.path, version: epochVersion(image.updated_at) } : null,
      profileImagePending: metadataText(artist.metadata, 'pendingProfileImageUploadIntentId'),
      socialLinks: own.map((link) => ({ id: link.id, platform: link.platform, label: link.label, url: link.url })),
      creditCount: creditsOf.get(artist.id) ?? 0,
      releaseCount: releasesOf.get(artist.id) ?? 0,
      uploadAccountId: artist.owner_creator_account_id ?? workspace?.id ?? membership?.id ?? null,
    };
  });
}

/** private.admin_artist_json(artist), or null for no such artist. */
export async function adminArtistJson(ctx: ApiContext, artistId: unknown): Promise<Row | null> {
  const artist = await first(ctx, `SELECT * FROM ${ARTISTS} WHERE ${col('id')} = ?`, artistId);
  return artist ? (await adminArtistsJson(ctx, [artist]))[0] : null;
}

export async function getAdminArtists(ctx: ApiContext, search: string | null): Promise<unknown> {
  const wanted = search == null ? null : trimSpaces(search) || null;
  await requireAdmin(ctx);
  const artists = (await all(ctx, `SELECT * FROM ${ARTISTS}`))
    .filter((artist) => wanted == null || ilike(artist.display_name as string, `%${wanted}%`))
    .sort((a, b) => compareText((a.display_name as string).toLowerCase(), (b.display_name as string).toLowerCase()) || byUuid(a.id, b.id));
  return payload(await adminArtistsJson(ctx, artists));
}

export async function getAdminArtistProfile(ctx: ApiContext, artistId: string): Promise<unknown> {
  await requireAdmin(ctx);
  const result = await adminArtistJson(ctx, artistId);
  if (!result) raise('Artist not found', 'P0002');
  return payload(result);
}

/**
 * The unclaimed artists a submission's workspace could be: same name, no
 * owner, no workspace's identity; only while the workspace's own identity and
 * releases are unpublished.
 */
export async function getAdminCreatorArtistClaims(ctx: ApiContext, submissionId: string): Promise<unknown> {
  await requireAdmin(ctx);
  const account = await first(ctx, `SELECT ca.${col('id')} AS id, ca.${col('identity_artist_id')} AS existing, ca.${col('display_name')} AS name
    FROM ${SUBMISSIONS} sub JOIN ${ACCOUNTS} ca ON ca.${col('id')} = sub.${col('creator_account_id')} WHERE sub.${col('id')} = ?`, submissionId);
  if (!account || account.id == null || account.existing == null) return [];
  if (await first(ctx, `SELECT 1 AS yes FROM ${ARTISTS} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, account.existing)) return [];
  if (await first(ctx, `SELECT 1 AS yes FROM ${RELEASES} WHERE ${col('owner_creator_account_id')} = ? AND ${col('publication_status')} = 'published'`, account.id)) return [];
  const target = normalizeCreatorName(account.name as string | null);
  const candidates = (await all(ctx, `SELECT artist.*, photo.${col('id')} AS photo_id, photo.${col('bucket')} AS photo_bucket, photo.${col('path')} AS photo_path, photo.${col('version')} AS photo_version,
      (SELECT count(*) FROM ${TRACK_ARTISTS} ta WHERE ta.${col('artist_id')} = artist.${col('id')}) AS credits
    FROM ${ARTISTS} artist
    LEFT JOIN ${ASSETS} photo ON photo.${col('id')} = artist.${col('profile_image_asset_id')} AND photo.${col('publication_status')} = 'published'
    WHERE artist.${col('id')} <> ? AND artist.${col('owner_creator_account_id')} IS NULL
      AND NOT EXISTS (SELECT 1 FROM ${ACCOUNTS} other WHERE other.${col('identity_artist_id')} = artist.${col('id')})`, account.existing))
    .filter((artist) => normalizeCreatorName(artist.display_name as string) === target)
    .sort((a, b) => (b.credits as number) - (a.credits as number) || order.ascNullsLast(a.created_at, b.created_at));
  return payload(candidates.map((artist) => ({
    artistId: artist.id,
    title: artist.display_name,
    profileImage: artist.photo_id != null ? { bucket: artist.photo_bucket, path: artist.photo_path, version: artist.photo_version } : null,
    existingCredits: artist.credits,
    creditOnly: bool(artist.is_credit_only),
  })));
}

// ── Notifications ─────────────────────────────────────────────────────────

const DEVICES = t('public', 'notification_devices');
const DELIVERIES = t('private', 'notification_deliveries');

/** private.broadcast_audience(category): the app's enabled push devices, less the accounts that turned the category off. */
export function audienceSql(alias: string): string {
  const p = `${alias}_pref`;
  return `${alias}.${col('app_key')} = 'chc' AND ${alias}.${col('enabled')} = 1 AND ${alias}.${col('provider')} IN ('expo', 'web_push')
    AND (${alias}.${col('user_id')} IS NULL OR NOT EXISTS (SELECT 1 FROM ${t('public', 'notification_preferences')} ${p}
      WHERE ${p}.${col('user_id')} = ${alias}.${col('user_id')} AND ${p}.${col('app_key')} = 'chc' AND ${p}.${col('category')} = ? AND ${p}.${col('enabled')} = 0))`;
}

/** greatest(a, b), which ignores nulls. */
const greatest = (a: string, b: string) => `CASE WHEN ${a} IS NULL THEN ${b} WHEN ${b} IS NULL THEN ${a} WHEN ${a} > ${b} THEN ${a} ELSE ${b} END`;
const countWhere = (condition: string) => `count(CASE WHEN ${condition} THEN 1 END)`;

export async function getAdminNotificationBroadcastOverview(ctx: ApiContext, category: string | null, historyLimit: number | null): Promise<unknown> {
  const wanted = trimSpaces(category ?? '');
  const limit = Math.max(1, Math.min(historyLimit ?? 20, 50));
  const userId = await requireSignedInAdmin(ctx);
  if (!['feast_celebrations', 'announcements'].includes(wanted)) raise('Unsupported notification category', '22023');
  const at = nowStored();
  const [audience, mine, dispatcher, broadcasts] = await Promise.all([
    first(ctx, `SELECT count(*) AS devices, count(DISTINCT a.${col('user_id')}) AS users, ${countWhere(`a.${col('user_id')} IS NULL`)} AS anonymous,
        ${countWhere(`a.${col('platform')} = 'ios'`)} AS ios, ${countWhere(`a.${col('platform')} = 'android'`)} AS android, ${countWhere(`a.${col('platform')} IN ('web', 'windows')`)} AS web
      FROM ${DEVICES} a WHERE ${audienceSql('a')}`, wanted),
    first(ctx, `SELECT count(*) AS n FROM ${DEVICES} WHERE ${col('user_id')} = ? AND ${col('app_key')} = 'chc' AND ${col('enabled')} = 1 AND ${col('provider')} IN ('expo', 'web_push')`, userId),
    first(ctx, `SELECT min(CASE WHEN d.${col('status')} = 'queued' AND d.${col('available_at')} <= ? THEN d.${col('available_at')} END) AS oldest,
        ${countWhere(`d.${col('status')} IN ('queued', 'processing')`)} AS waiting, max(${greatest(`d.${col('accepted_at')}`, `d.${col('delivered_at')}`)}) AS last_sent
      FROM ${DELIVERIES} d JOIN ${DEVICES} dev ON dev.${col('id')} = d.${col('device_id')} WHERE dev.${col('app_key')} = 'chc'`, at),
    all(ctx, `SELECT b.*, ${countWhere(`d.${col('status')} IN ('queued', 'processing')`)} AS waiting, ${countWhere(`d.${col('status')} = 'accepted'`)} AS sent,
        ${countWhere(`d.${col('status')} = 'delivered'`)} AS delivered, ${countWhere(`d.${col('status')} = 'failed'`)} AS failed, ${countWhere(`d.${col('status')} = 'disabled'`)} AS unreachable
      FROM ${t('public', 'notification_broadcasts')} b LEFT JOIN ${DELIVERIES} d ON d.${col('broadcast_id')} = b.${col('id')}
      WHERE b.${col('app_key')} = 'chc' GROUP BY b.${col('id')} ORDER BY b.${col('created_at')} DESC LIMIT ?`, limit),
  ]);
  const crowd = {
    devices: audience!.devices, signedInUsers: audience!.users, devicesWithoutAccount: audience!.anonymous, ios: audience!.ios, android: audience!.android, web: audience!.web,
  };
  return payload({
    eligibleUserCount: crowd.signedInUsers,
    eligibleDeviceCount: crowd.devices,
    audience: crowd,
    myDeviceCount: mine!.n,
    dispatcher: { oldestWaitingAt: dispatcher!.oldest, waiting: dispatcher!.waiting, lastSentAt: dispatcher!.last_sent },
    // to_jsonb(row): the columns under their own names.
    recentBroadcasts: broadcasts.map((b) => ({
      id: b.id, category: b.category, title: b.title, body: b.body, deep_link: b.deep_link, recipient_count: b.recipient_count, delivery_count: b.delivery_count, created_at: b.created_at,
      delivery_status: { waiting: b.waiting, sent: b.sent, delivered: b.delivered, failed: b.failed, unreachable: b.unreachable },
    })),
  });
}

// ── The review queue ──────────────────────────────────────────────────────

/** 'overdue', 'due_soon' or 'on_track', only for a submission still awaiting a decision. */
function dueState(submission: Row, at: string): string | null {
  if (submission.status !== 'pending_review' || submission.review_due_at == null) return null;
  const due = submission.review_due_at as string;
  if (due < at) return 'overdue';
  if (due < plusHours(at, 12)) return 'due_soon';
  return 'on_track';
}

/** The first artwork item of each submission (by sort order, then creation). */
async function firstArtwork(ctx: ApiContext, submissionIds: unknown[]): Promise<Map<unknown, unknown>> {
  const rows = await all(ctx, `SELECT ${col('id')}, ${col('submission_id')} FROM ${ITEMS} WHERE ${col('submission_id')} IN ${IN_LIST} AND ${col('role')} = 'artwork'
    ORDER BY ${col('sort_order')}, ${col('created_at')}, rowid`, list(submissionIds));
  const out = new Map<unknown, unknown>();
  for (const row of rows) if (!out.has(row.submission_id)) out.set(row.submission_id, row.id);
  return out;
}

export async function getAdminReviewQueue(ctx: ApiContext, statuses: (string | null)[] | null): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  let wanted: (string | null)[];
  if (statuses == null || statuses.length === 0) {
    wanted = ['pending_review', 'changes_requested', 'approved', 'processing'];
  } else {
    if (statuses.some((status) => status != null && !enumValues('publication_status').includes(status))) raise('Unknown submission status in filter', '22023');
    wanted = statuses;
  }
  const at = nowStored();
  const [counts, submissions] = await Promise.all([
    all(ctx, `SELECT ${col('status')} AS status, count(*) AS total FROM ${SUBMISSIONS} GROUP BY ${col('status')}`),
    all(ctx, `SELECT s.*, account.${col('display_name')} AS creator_name, submitter.${col('email')} AS submitter_email
      FROM ${SUBMISSIONS} s JOIN ${ACCOUNTS} account ON account.${col('id')} = s.${col('creator_account_id')}
      LEFT JOIN ${USERS} submitter ON submitter.${col('id')} = s.${col('created_by')}
      WHERE s.${col('status')} IN ${IN_LIST}`, list(wanted)),
  ]);
  const ids = submissions.map((s) => s.id);
  const [items, artwork] = await Promise.all([
    all(ctx, `SELECT item.${col('submission_id')} AS submission_id, intent.${col('media_type')} AS media_type, asset.${col('processing_status')} AS asset_status, job.${col('status')} AS job_status
      FROM ${ITEMS} item LEFT JOIN ${INTENTS} intent ON intent.${col('id')} = item.${col('upload_intent_id')}
      LEFT JOIN ${ASSETS} asset ON asset.${col('id')} = item.${col('media_asset_id')} LEFT JOIN ${JOBS} job ON job.${col('id')} = item.${col('media_processing_job_id')}
      WHERE item.${col('submission_id')} IN ${IN_LIST}`, list(ids)),
    firstArtwork(ctx, ids),
  ]);
  submissions.sort((a, b) => (a.status === 'pending_review' ? 0 : 1) - (b.status === 'pending_review' ? 0 : 1)
    || order.ascNullsLast(a.review_due_at, b.review_due_at) || order.ascNullsLast(a.submitted_at, b.submitted_at) || order.ascNullsLast(a.created_at, b.created_at));
  return payload({
    counts: Object.fromEntries(counts.map((row) => [row.status, row.total])),
    submissions: submissions.map((s) => {
      const own = items.filter((item) => item.submission_id === s.id);
      const count = (test: (item: Row) => boolean) => own.filter(test).length;
      return {
        id: s.id, title: s.title, description: s.description, submissionType: s.submission_type, status: s.status, submittedAt: s.submitted_at,
        reviewDueAt: s.review_due_at, reviewedAt: s.reviewed_at, publishedAt: s.published_at, updatedAt: s.updated_at, creatorAccountId: s.creator_account_id,
        creatorName: s.creator_name, submitterEmail: s.submitter_email ?? null, dueState: dueState(s, at),
        itemCount: own.length, audioCount: count((i) => i.media_type === 'audio'), imageCount: count((i) => i.media_type === 'image'), videoCount: count((i) => i.media_type === 'video'),
        readyCount: count((i) => i.asset_status === 'completed'), failedCount: count((i) => i.job_status === 'failed'), artworkItemId: artwork.get(s.id) ?? null,
      };
    }),
  });
}

// ── A submission in detail ────────────────────────────────────────────────

/** The catalog record a submission made, as the detail shows it ({} for none, null for a missing one). */
async function detailCatalog(ctx: ApiContext, submission: Row): Promise<Row | null> {
  if (submission.submission_type === 'music_release') {
    const release = await first(ctx, `SELECT r.*, artist.${col('id')} AS artist_id, artist.${col('display_name')} AS artist_name, artist.${col('publication_status')} AS artist_status
      FROM ${RELEASES} r LEFT JOIN ${ARTISTS} artist ON artist.${col('id')} = r.${col('primary_artist_id')}
      WHERE json_extract(r.${col('metadata')}, '$.submissionId') = ? ORDER BY r.${col('created_at')} DESC, r.rowid LIMIT 1`, submission.id);
    if (!release) return null;
    const [tracks, credits, localizations] = await Promise.all([
      all(ctx, `SELECT rt.${col('track_number')}, rt.${col('disc_number')}, tr.* FROM ${RELEASE_TRACKS} rt JOIN ${t('music', 'tracks')} tr ON tr.${col('id')} = rt.${col('track_id')}
        WHERE rt.${col('release_id')} = ? ORDER BY rt.${col('disc_number')}, rt.${col('track_number')}`, release.id),
      all(ctx, `SELECT ta.${col('track_id')} AS track_id, ta.${col('role')} AS role, ta.${col('sort_order')} AS sort_order, a.${col('display_name')} AS name
        FROM ${RELEASE_TRACKS} rt JOIN ${TRACK_ARTISTS} ta ON ta.${col('track_id')} = rt.${col('track_id')} JOIN ${ARTISTS} a ON a.${col('id')} = ta.${col('artist_id')}
        WHERE rt.${col('release_id')} = ? AND ta.${col('role')} IN ('primary', 'featured') ORDER BY ta.${col('artist_id')}`, release.id),
      all(ctx, `SELECT * FROM ${t('music', 'release_localizations')} WHERE ${col('release_id')} = ?`, release.id),
    ]);
    localizations.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || order.text(a.locale, b.locale));
    return {
      kind: 'music_release', id: release.id, title: release.title, subtitle: release.subtitle, description: release.description, releaseType: release.release_type,
      releaseTimingMode: release.release_timing_mode, releaseDate: release.release_date, scheduledReleaseAt: release.scheduled_release_at,
      originalReleaseDate: release.original_release_date, displayDate: releaseDisplayDate(release),
      tracks: tracks.map((track) => {
        const own = credits.filter((credit) => credit.track_id === track.id);
        return {
          id: track.id, trackNumber: track.track_number, discNumber: track.disc_number, title: track.title, durationMs: track.duration_ms,
          publicationStatus: track.publication_status, hasMedia: track.media_asset_id != null,
          mainArtist: own.find((credit) => credit.role === 'primary')?.name ?? null,
          featuredArtists: own.filter((credit) => credit.role === 'featured').sort((a, b) => order.number(a.sort_order, b.sort_order)).map((credit) => credit.name),
        };
      }),
      publicationStatus: release.publication_status, coverAssetId: release.cover_asset_id,
      artist: { id: release.artist_id ?? null, displayName: release.artist_name ?? null, publicationStatus: release.artist_status ?? null },
      localizations: localizations.map((l) => ({
        locale: l.locale, title: l.title, subtitle: l.subtitle, description: l.description, isPrimary: bool(l.is_primary), publicationStatus: l.publication_status,
      })),
      metadata: release.metadata == null ? null : JSON.parse(release.metadata as string),
    };
  }
  const album = submission.submission_type === 'learning_album';
  if (!album && submission.submission_type !== 'learning_lesson_set') return {};
  const table = album ? t('learning', 'albums') : t('learning', 'lesson_sets');
  const collection = await first(ctx, `SELECT c.*, cantor.${col('id')} AS cantor_row, cantor.${col('display_name')} AS cantor_name, cantor.${col('publication_status')} AS cantor_status,
      season.${col('id')} AS season_row, season.${col('title')} AS season_title, season.${col('slug')} AS season_slug,
      (SELECT sub.${col('published_at')} FROM ${SUBMISSIONS} sub WHERE sub.${col('id')} = c.${col('submission_id')}) AS submission_published_at
      ${album ? '' : `, hymn.${col('id')} AS hymn_row, hymn.${col('title')} AS hymn_title, hymn.${col('subtitle')} AS hymn_subtitle, hymn.${col('source_hymn_key')} AS hymn_key`}
    FROM ${table} c LEFT JOIN ${t('learning', 'cantors')} cantor ON cantor.${col('id')} = c.${col('cantor_id')}
    LEFT JOIN ${t('learning', 'seasons')} season ON season.${col('id')} = c.${col('season_id')}
    ${album ? '' : `LEFT JOIN ${t('learning', 'hymns')} hymn ON hymn.${col('id')} = c.${col('hymn_id')}`}
    WHERE c.${col('submission_id')} = ? ORDER BY c.rowid LIMIT 1`, submission.id);
  if (!collection) return null;
  const localizations = await all(ctx, album
    ? `SELECT * FROM ${t('learning', 'album_localizations')} WHERE ${col('album_id')} = ?`
    : `SELECT * FROM ${t('learning', 'lesson_set_localizations')} WHERE ${col('lesson_set_id')} = ?`, collection.id);
  localizations.sort((a, b) => order.text(a.locale, b.locale));
  return {
    kind: album ? 'learning_album' : 'learning_lesson_set', id: collection.id, title: collection.title, description: collection.description,
    releaseTimingMode: collection.release_timing_mode, scheduledReleaseAt: collection.scheduled_release_at, originalReleaseDate: collection.original_release_date,
    displayDate: dateAsTimestamp(collection.original_release_date) ?? collection.scheduled_release_at ?? collection.submission_published_at ?? collection.created_at,
    publicationStatus: collection.publication_status, coverAssetId: collection.cover_asset_id,
    cantor: { id: collection.cantor_row ?? null, displayName: collection.cantor_name ?? null, publicationStatus: collection.cantor_status ?? null },
    season: collection.season_row == null ? null : { id: collection.season_row, title: collection.season_title, slug: collection.season_slug },
    ...(album ? {} : {
      hymn: collection.hymn_row == null ? null : { id: collection.hymn_row, title: collection.hymn_title, subtitle: collection.hymn_subtitle, sourceHymnKey: collection.hymn_key },
    }),
    localizations: localizations.map((l) => ({ locale: l.locale, title: l.title, description: l.description })),
    metadata: collection.metadata == null ? null : JSON.parse(collection.metadata as string),
  };
}

const plural = (n: number, one: string, many: string) => `${n}${n === 1 ? one : many}`;

export async function getAdminSubmissionDetail(ctx: ApiContext, submissionId: string): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  const submission = await first(ctx, `SELECT * FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, submissionId);
  if (!submission) raise('Submission not found', 'P0002');
  const sub = submission!;
  const [account, submitter, catalog, items, artwork, events, lyricSets] = await Promise.all([
    first(ctx, `SELECT ${col('display_name')} AS name FROM ${ACCOUNTS} WHERE ${col('id')} = ?`, sub.creator_account_id),
    first(ctx, `SELECT ${col('email')} FROM ${USERS} WHERE ${col('id')} = ?`, sub.created_by),
    detailCatalog(ctx, sub),
    all(ctx, `SELECT item.*, intent.${col('id')} AS intent_id, intent.${col('original_filename')} AS original_filename, intent.${col('media_type')} AS intent_media_type,
        intent.${col('content_type')} AS content_type, intent.${col('content_length')} AS content_length, intent.${col('status')} AS upload_status, intent.${col('uploaded_at')} AS uploaded_at,
        job.${col('id')} AS job_id, job.${col('job_type')} AS job_type, job.${col('status')} AS job_status, job.${col('attempt_count')} AS job_attempts, job.${col('max_attempts')} AS job_max,
        job.${col('error_message')} AS job_error, job.${col('available_at')} AS job_available, job.${col('queued_at')} AS job_queued, job.${col('started_at')} AS job_started, job.${col('finished_at')} AS job_finished,
        asset.${col('id')} AS asset_id, asset.${col('bucket')} AS asset_bucket, asset.${col('path')} AS asset_path, asset.${col('media_type')} AS asset_media_type, asset.${col('mime_type')} AS asset_mime,
        asset.${col('duration_ms')} AS asset_duration, asset.${col('file_size_bytes')} AS asset_size, asset.${col('processing_status')} AS asset_processing, asset.${col('publication_status')} AS asset_publication
      FROM ${ITEMS} item LEFT JOIN ${INTENTS} intent ON intent.${col('id')} = item.${col('upload_intent_id')}
      LEFT JOIN ${JOBS} job ON job.${col('id')} = item.${col('media_processing_job_id')} LEFT JOIN ${ASSETS} asset ON asset.${col('id')} = item.${col('media_asset_id')}
      WHERE item.${col('submission_id')} = ? ORDER BY item.${col('sort_order')}, item.${col('created_at')}, item.rowid`, sub.id),
    // The artwork the reviewer should look at: the delivery cover once it exists, the original upload until then.
    first(ctx, `SELECT item.${col('id')} AS id, item.${col('title')} AS title, intent.${col('original_filename')} AS original_filename, intent.${col('status')} AS upload_status,
        asset.${col('bucket')} AS bucket, asset.${col('path')} AS path, coalesce(asset.${col('processing_status')}, job.${col('status')}) AS processing_status
      FROM ${ITEMS} item LEFT JOIN ${INTENTS} intent ON intent.${col('id')} = item.${col('upload_intent_id')}
      LEFT JOIN ${ASSETS} asset ON asset.${col('id')} = item.${col('media_asset_id')} LEFT JOIN ${JOBS} job ON job.${col('id')} = item.${col('media_processing_job_id')}
      WHERE item.${col('submission_id')} = ? AND item.${col('role')} = 'artwork' ORDER BY item.${col('created_at')} DESC, item.${col('id')} DESC LIMIT 1`, sub.id),
    all(ctx, `SELECT event.*, actor.${col('email')} AS actor_email FROM ${t('media', 'submission_events')} event LEFT JOIN ${USERS} actor ON actor.${col('id')} = event.${col('actor_id')}
      WHERE event.${col('submission_id')} = ? ORDER BY event.${col('created_at')} DESC, event.${col('id')} DESC`, sub.id),
    // Lyrics reach a submission through the tracks its delivered audio produced.
    all(ctx, `SELECT ls.*, track.${col('id')} AS track_row, track.${col('title')} AS track_title,
        (SELECT count(*) FROM ${t('music', 'lyric_lines')} line WHERE line.${col('lyric_set_id')} = ls.${col('id')}) AS line_count,
        (SELECT json_group_array(preview.${col('text')}) FROM (SELECT line.${col('text')} FROM ${t('music', 'lyric_lines')} line WHERE line.${col('lyric_set_id')} = ls.${col('id')}
          ORDER BY line.${col('sequence')} LIMIT 4) preview) AS first_lines
      FROM ${ITEMS} item JOIN ${t('music', 'tracks')} track ON track.${col('media_asset_id')} = item.${col('media_asset_id')}
      JOIN ${t('music', 'lyric_sets')} ls ON ls.${col('track_id')} = track.${col('id')}
      WHERE item.${col('submission_id')} = ? AND item.${col('media_asset_id')} IS NOT NULL`, sub.id),
  ]);
  lyricSets.sort((a, b) => order.text(a.track_title, b.track_title) || order.text(a.locale, b.locale) || enumOrder('lyric_kind')(a.kind, b.kind));
  const preview = (item: Row) => `/admin/submission-items/${item.id as string}/preview`;
  const localizationCount = Array.isArray(catalog?.localizations) ? (catalog!.localizations as unknown[]).length : 0;

  // Blocking issues stop a decision; warnings are worth a reviewer's attention but don't prevent one.
  const issues: Row[] = [];
  if (!items.length) issues.push({ severity: 'blocking', code: 'no_items', message: 'This submission has no files attached.' });
  const notUploaded = items.filter((item) => item.required === 1 && (item.intent_id == null || item.upload_status !== 'uploaded')).length;
  if (notUploaded > 0) issues.push({ severity: 'blocking', code: 'upload_incomplete', message: `${plural(notUploaded, ' required file has', ' required files have')} not finished uploading.` });
  const failed = items.filter((item) => item.job_id != null && item.job_status === 'failed').length;
  if (failed > 0) issues.push({ severity: 'blocking', code: 'processing_failed', message: `${plural(failed, ' file', ' files')} failed processing and will not be retried.` });
  const waiting = ['pending_review', 'approved', 'processing'].includes(sub.status as string)
    ? items.filter((item) => item.required === 1 && item.asset_processing !== 'completed' && ['audio', 'image', 'video'].includes(item.intent_media_type as string)).length : 0;
  if (waiting > 0) issues.push({ severity: 'blocking', code: 'processing_incomplete', message: `${plural(waiting, ' required file is', ' required files are')} still waiting on processing.` });
  if (!items.some((item) => item.role === 'artwork')) issues.push({ severity: 'warning', code: 'no_artwork', message: 'No artwork was submitted, so this will publish without a cover.' });
  const noCatalog = catalog == null || Object.keys(catalog).length === 0;
  if (noCatalog) issues.push({ severity: 'warning', code: 'no_catalog_record', message: 'No catalog record is linked to this submission.' });
  if (localizationCount === 0 && !noCatalog) issues.push({ severity: 'warning', code: 'no_localizations', message: 'No localized titles were provided.' });

  return payload(stripNullsDeep({
    id: sub.id, creatorAccountId: sub.creator_account_id, creatorName: account?.name ?? null, submitterEmail: submitter?.email ?? null,
    submissionType: sub.submission_type, title: sub.title, description: sub.description, status: sub.status, submittedAt: sub.submitted_at, reviewDueAt: sub.review_due_at,
    dueState: dueState(sub, nowStored()), reviewerId: sub.reviewer_id, reviewedAt: sub.reviewed_at, reviewNotes: sub.review_notes, approvedAt: sub.approved_at,
    publishedAt: sub.published_at, rejectedAt: sub.rejected_at, createdAt: sub.created_at, updatedAt: sub.updated_at,
    catalog: catalog ?? {},
    artwork: artwork ? {
      itemId: artwork.id, title: artwork.title, originalFilename: artwork.original_filename, previewPath: artwork.upload_status === 'uploaded' ? preview(artwork) : null,
      deliveryBucket: artwork.bucket, deliveryPath: artwork.path, processingStatus: artwork.processing_status,
    } : null,
    items: items.map((item) => ({
      id: item.id, musicTrackId: item.music_track_id, title: item.title, role: item.role, sortOrder: item.sort_order, required: bool(item.required),
      uploadIntentId: item.intent_id, originalFilename: item.original_filename, mediaType: item.intent_media_type, contentType: item.content_type,
      contentLength: item.content_length, uploadStatus: item.upload_status, uploadedAt: item.uploaded_at,
      previewPath: item.intent_id != null && item.upload_status === 'uploaded' ? preview(item) : null,
      processingJob: item.job_id == null ? null : {
        id: item.job_id, type: item.job_type, status: item.job_status, attemptCount: item.job_attempts, maxAttempts: item.job_max, errorMessage: item.job_error,
        availableAt: item.job_available, queuedAt: item.job_queued, startedAt: item.job_started, finishedAt: item.job_finished,
      },
      mediaAsset: item.asset_id == null ? null : {
        id: item.asset_id, bucket: item.asset_bucket, path: item.asset_path, mediaType: item.asset_media_type, mimeType: item.asset_mime, durationMs: item.asset_duration,
        fileSizeBytes: item.asset_size, processingStatus: item.asset_processing, publicationStatus: item.asset_publication,
      },
    })),
    lyricSets: lyricSets.map((set) => ({
      id: set.id, trackId: set.track_row, trackTitle: set.track_title, locale: set.locale, kind: set.kind, syncPrecision: set.sync_precision, title: set.title,
      publicationStatus: set.publication_status, lineCount: set.line_count, firstLines: JSON.parse(set.first_lines as string),
    })),
    events: events.map((event) => {
      const metadata = event.metadata == null ? null : JSON.parse(event.metadata as string);
      return {
        id: event.id, action: event.action, fromStatus: event.from_status, toStatus: event.to_status, notes: event.notes,
        metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) && !Object.keys(metadata).length ? null : metadata,
        actorId: event.actor_id, actorEmail: event.actor_email ?? null, createdAt: event.created_at,
      };
    }),
    validationIssues: issues,
  }));
}

// ── Publication ───────────────────────────────────────────────────────────

/** The catalog record each submission made, as the publication overview shows it. */
async function overviewCatalogs(ctx: ApiContext, submissions: Row[]): Promise<Map<unknown, Row | null>> {
  const out = new Map<unknown, Row | null>();
  for (const sub of submissions) {
    let row: Row | null = null;
    if (sub.submission_type === 'music_release') {
      row = await first(ctx, `SELECT r.${col('id')} AS id, r.${col('title')} AS title, r.${col('publication_status')} AS status, r.${col('cover_asset_id')} AS cover,
          (SELECT count(*) FROM ${RELEASE_TRACKS} rt WHERE rt.${col('release_id')} = r.${col('id')}) AS items,
          (SELECT count(*) FROM ${RELEASE_TRACKS} rt JOIN ${t('music', 'tracks')} tr ON tr.${col('id')} = rt.${col('track_id')} WHERE rt.${col('release_id')} = r.${col('id')} AND tr.${col('media_asset_id')} IS NOT NULL) AS with_media
        FROM ${RELEASES} r WHERE json_extract(r.${col('metadata')}, '$.submissionId') = ? ORDER BY r.${col('created_at')} DESC, r.rowid LIMIT 1`, sub.id);
    } else if (sub.submission_type === 'learning_album' || sub.submission_type === 'learning_lesson_set') {
      const album = sub.submission_type === 'learning_album';
      const children = album ? t('learning', 'album_recordings') : t('learning', 'lessons');
      const parent = album ? col('album_id') : col('lesson_set_id');
      row = await first(ctx, `SELECT c.${col('id')} AS id, c.${col('title')} AS title, c.${col('publication_status')} AS status, c.${col('cover_asset_id')} AS cover,
          (SELECT count(*) FROM ${children} x WHERE x.${parent} = c.${col('id')}) AS items,
          (SELECT count(*) FROM ${children} x WHERE x.${parent} = c.${col('id')} AND x.${col('media_asset_id')} IS NOT NULL) AS with_media
        FROM ${album ? t('learning', 'albums') : t('learning', 'lesson_sets')} c WHERE c.${col('submission_id')} = ? ORDER BY c.rowid LIMIT 1`, sub.id);
    }
    out.set(sub.id, row ? { kind: sub.submission_type, id: row.id, title: row.title, publicationStatus: row.status, itemCount: row.items, itemsWithMedia: row.with_media, coverAssetId: row.cover } : null);
  }
  return out;
}

export async function getAdminPublicationOverview(ctx: ApiContext): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  const submissions = await all(ctx, `SELECT s.*, account.${col('display_name')} AS creator_name, ${requiredItemsReady(`s.${col('id')}`)} AS ready,
      (SELECT count(*) FROM ${ITEMS} i WHERE i.${col('submission_id')} = s.${col('id')}) AS item_count,
      (SELECT count(*) FROM ${ITEMS} i WHERE i.${col('submission_id')} = s.${col('id')} AND i.${col('media_asset_id')} IS NOT NULL) AS asset_count,
      EXISTS (SELECT 1 FROM ${RELEASES} r WHERE json_extract(r.${col('metadata')}, '$.submissionId') = s.${col('id')}) AS has_release,
      EXISTS (SELECT 1 FROM ${t('learning', 'albums')} al WHERE al.${col('submission_id')} = s.${col('id')}) AS has_album,
      EXISTS (SELECT 1 FROM ${t('learning', 'lesson_sets')} ls WHERE ls.${col('submission_id')} = s.${col('id')}) AS has_lesson_set
    FROM ${SUBMISSIONS} s JOIN ${ACCOUNTS} account ON account.${col('id')} = s.${col('creator_account_id')}
    WHERE s.${col('status')} IN ('approved', 'processing', 'published')`);
  const ready = submissions.filter((s) => s.status !== 'published' && s.ready === 1);
  const waiting = submissions.filter((s) => s.status !== 'published' && s.ready !== 1);
  const published = submissions.filter((s) => s.status === 'published' && ((s.submission_type === 'music_release' && s.has_release === 1)
    || (s.submission_type === 'learning_album' && s.has_album === 1) || (s.submission_type === 'learning_lesson_set' && s.has_lesson_set === 1)));
  const [artwork, catalogs] = await Promise.all([firstArtwork(ctx, submissions.map((s) => s.id)), overviewCatalogs(ctx, [...ready, ...published])]);
  const entry = (s: Row, withCatalog: boolean, itemsReady: boolean) => stripNullsDeep({
    id: s.id, title: s.title, description: s.description, submissionType: s.submission_type, status: s.status, creatorName: s.creator_name,
    approvedAt: s.approved_at, publishedAt: s.published_at, itemsReady, itemCount: s.item_count, assetCount: s.asset_count, artworkItemId: artwork.get(s.id) ?? null,
    ...(withCatalog ? { catalog: catalogs.get(s.id) ?? null } : {}),
  });
  const newestFirst = (field: string) => (a: Row, b: Row) => order.descNullsLast(a[field] ?? a.updated_at ?? a.created_at, b[field] ?? b.updated_at ?? b.created_at);
  return payload({
    ready: ready.sort(newestFirst('approved_at')).map((s) => entry(s, true, true)),
    waiting: waiting.sort(newestFirst('approved_at')).map((s) => entry(s, false, false)),
    published: published.sort(newestFirst('published_at')).map((s) => entry(s, true, s.ready === 1)),
  });
}

// ── Processing ────────────────────────────────────────────────────────────

const JOB_STATUS_RANK: Record<string, number> = { processing: 0, queued: 1, failed: 2, completed: 3 };

/** One row per file: a video's audio-only job rides inside its video's row. */
export async function getAdminProcessingJobs(ctx: ApiContext): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  const jobs = await all(ctx, `SELECT job.*,
      item.${col('id')} AS item_id, item.${col('title')} AS item_title, item.${col('role')} AS item_role, item.${col('sort_order')} AS item_sort, item.${col('required')} AS item_required,
      upload.${col('id')} AS upload_id, upload.${col('original_filename')} AS upload_filename, upload.${col('media_type')} AS upload_media_type, upload.${col('content_type')} AS upload_content_type,
      upload.${col('content_length')} AS upload_length, upload.${col('original_deleted_at')} AS upload_deleted_at,
      sub.${col('id')} AS sub_id, sub.${col('title')} AS sub_title, sub.${col('submission_type')} AS sub_type, sub.${col('status')} AS sub_status, account.${col('display_name')} AS creator_name,
      (SELECT artwork.${col('id')} FROM ${ITEMS} artwork WHERE artwork.${col('submission_id')} = sub.${col('id')} AND artwork.${col('role')} = 'artwork'
        ORDER BY artwork.${col('sort_order')}, artwork.${col('created_at')}, artwork.rowid LIMIT 1) AS artwork_item_id,
      audio.${col('id')} AS audio_id, audio.${col('status')} AS audio_status, audio.${col('attempt_count')} AS audio_attempts, audio.${col('max_attempts')} AS audio_max,
      audio.${col('output_size_bytes')} AS audio_size, audio.${col('error_message')} AS audio_error
    FROM ${JOBS} job
    LEFT JOIN ${INTENTS} upload ON upload.${col('id')} = job.${col('upload_intent_id')}
    LEFT JOIN ${ITEMS} item ON item.${col('media_processing_job_id')} = job.${col('id')}
    LEFT JOIN ${SUBMISSIONS} sub ON sub.${col('id')} = item.${col('submission_id')}
    LEFT JOIN ${ACCOUNTS} account ON account.${col('id')} = sub.${col('creator_account_id')}
    LEFT JOIN ${JOBS} audio ON job.${col('job_type')} = 'video_delivery' AND audio.${col('upload_intent_id')} = job.${col('upload_intent_id')} AND audio.${col('job_type')} = 'audio_delivery'
    WHERE NOT (job.${col('job_type')} = 'audio_delivery' AND coalesce(upload.${col('media_type')} = 'video', 0)
      AND EXISTS (SELECT 1 FROM ${JOBS} video WHERE video.${col('upload_intent_id')} = job.${col('upload_intent_id')} AND video.${col('job_type')} = 'video_delivery'))`);
  // The summary counts each job once, however many items name it.
  const seen = new Map<unknown, string>();
  for (const job of jobs) seen.set(job.id, job.status as string);
  const summary = { queued: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 } as Record<string, number>;
  for (const status of seen.values()) summary[status] += 1;
  jobs.sort((a, b) => (JOB_STATUS_RANK[a.status as string] ?? 4) - (JOB_STATUS_RANK[b.status as string] ?? 4) || order.descNullsLast(a.queued_at, b.queued_at));
  return payload({
    summary,
    jobs: jobs.map((job) => stripNullsDeep({
      id: job.id, jobType: job.job_type, status: job.status, attemptCount: job.attempt_count, maxAttempts: job.max_attempts, workerId: job.worker_id,
      inputBucket: job.input_bucket, inputPath: job.input_path, outputBucket: job.output_bucket, outputPath: job.output_path, outputMimeType: job.output_mime_type,
      outputSizeBytes: job.output_size_bytes, errorMessage: job.error_message, queuedAt: job.queued_at, availableAt: job.available_at, claimedAt: job.claimed_at,
      startedAt: job.started_at, finishedAt: job.finished_at, createdAt: job.created_at, updatedAt: job.updated_at, heartbeatAt: job.heartbeat_at, progress: job.progress,
      audioOnly: job.audio_id == null ? null : {
        id: job.audio_id, status: job.audio_status, attemptCount: job.audio_attempts, maxAttempts: job.audio_max, outputSizeBytes: job.audio_size, errorMessage: job.audio_error,
      },
      item: job.item_id == null ? null : { id: job.item_id, title: job.item_title, role: job.item_role, sortOrder: job.item_sort, required: bool(job.item_required) },
      upload: job.upload_id == null ? null : {
        id: job.upload_id, originalFilename: job.upload_filename, mediaType: job.upload_media_type, contentType: job.upload_content_type,
        contentLength: job.upload_length, originalDeletedAt: job.upload_deleted_at,
      },
      submission: job.sub_id == null ? null : {
        id: job.sub_id, title: job.sub_title, submissionType: job.sub_type, status: job.sub_status, creatorName: job.creator_name ?? null, artworkItemId: job.artwork_item_id,
      },
    })),
  });
}
