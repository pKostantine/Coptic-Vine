/**
 * The creator editor's writes: ports of public.ensure_creator_workspace,
 * create_creator_artist, create_creator_cantor, create_creator_hymn,
 * update_creator_artist_profile, enqueue_media_processing_job,
 * add_media_submission_item, submit_media_submission, delete_submission,
 * delete_creator_music_release and delete_creator_music_release_track
 * (schema/pg-user-schema.sql), each in one transaction (src/db/transaction.ts).
 * Checked by tests/creator.writes.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction, type Tx } from '../../db/transaction.ts';
import { jsonbText, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import {
  addEvent, addSubmissionItem, arrowText, cleanText, deleteReleaseCore, deleteReleaseTrackCore, enqueueJob, resolveLearningArtist, submitSubmission,
  trimSpaces, trueFirst,
} from './core.ts';
import { getCreatorArtistProfile, normalizeCreatorName } from './reads.ts';
import { canEdit, order, payload, requireAuth, type Row } from './shared.ts';

const ARTISTS = t('music', 'artists');
const ACCOUNTS = t('creator', 'creator_accounts');

export async function ensureCreatorWorkspace(ctx: ApiContext, displayName: string | null): Promise<unknown> {
  const userId = requireAuth(ctx);
  return transaction(ctx, async (tx) => {
    const user = await tx.first(`SELECT ${col('email')}, ${col('raw_user_meta_data')} AS meta FROM ${t('auth', 'users')} WHERE ${col('id')} = ?`, userId);
    const meta = user?.meta == null ? null : JSON.parse(user.meta as string);
    const resolved = (user ? cleanText(displayName) ?? cleanText(arrowText(meta, 'full_name')) ?? cleanText(arrowText(meta, 'name'))
      ?? (((user.email as string | null) ?? '').split('@')[0] || null) : null) ?? 'Coptic Vine Creator';
    await tx.batch([
      tx.db.prepare(`INSERT INTO ${t('creator', 'profiles')} (${col('id')}, ${col('display_name')}, ${col('created_at')}, ${col('updated_at')}) VALUES (?, ?, ?, ?)
        ON CONFLICT (${col('id')}) DO UPDATE SET ${col('display_name')} = coalesce(${t('creator', 'profiles')}.${col('display_name')}, excluded.${col('display_name')}), ${col('updated_at')} = ?`)
        .bind(userId, resolved, tx.at, tx.at, tx.at),
      tx.db.prepare(`INSERT INTO ${t('creator', 'user_roles')} (${['user_id', 'role', 'granted_by', 'granted_at', 'revoked_at', 'notes'].map(col).join(', ')})
        VALUES (?, 'creator', ?, ?, NULL, 'Self-service Coptic Vine Artists onboarding')
        ON CONFLICT (${col('user_id')}, ${col('role')}) DO UPDATE SET ${col('granted_by')} = ?, ${col('granted_at')} = ?, ${col('revoked_at')} = NULL, ${col('notes')} = 'Self-service Coptic Vine Artists onboarding'`)
        .bind(userId, userId, tx.at, userId, tx.at),
    ]);
    const memberships = await tx.all(`SELECT m.${col('creator_account_id')} AS id, a.${col('display_name')} AS name, m.${col('created_at')} AS joined
      FROM ${t('creator', 'creator_account_members')} m JOIN ${ACCOUNTS} a ON a.${col('id')} = m.${col('creator_account_id')} WHERE m.${col('user_id')} = ? AND a.${col('status')} = 'active'`, userId);
    memberships.sort((a, b) => order.ascNullsLast(a.joined, b.joined));
    let accountId = (memberships[0]?.id as string | undefined) ?? null;
    let accountName = (memberships[0]?.name as string | null | undefined) ?? null;
    if (accountId == null) {
      accountId = crypto.randomUUID();
      accountName = resolved;
      await tx.batch([
        tx.db.prepare(`INSERT INTO ${ACCOUNTS} (${['id', 'display_name', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, ?, 'active', ?, ?, ?, ?)`)
          .bind(accountId, resolved, userId, userId, tx.at, tx.at),
        tx.db.prepare(`INSERT INTO ${t('creator', 'creator_account_members')} (${['creator_account_id', 'user_id', 'role', 'invited_by', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, ?, 'owner', ?, ?, ?)`)
          .bind(accountId, userId, userId, tx.at, tx.at),
      ]);
    }
    let identity = ((await tx.first(`SELECT ${col('identity_artist_id')} AS id FROM ${ACCOUNTS} WHERE ${col('id')} = ?`, accountId))?.id as string | null | undefined) ?? null;
    if (identity == null) {
      // A credit this same user made before having a workspace is reclaimed; one by anyone else never is.
      const name = normalizeCreatorName(accountName ?? resolved);
      const mine = (await tx.all(`SELECT * FROM ${ARTISTS} WHERE ${col('owner_creator_account_id')} IS NULL AND ${col('created_by')} = ?`, userId))
        .filter((artist) => normalizeCreatorName(artist.display_name as string) === name)
        .sort((a, b) => trueFirst(a.publication_status === 'published', b.publication_status === 'published') || order.ascNullsLast(a.created_at, b.created_at));
      if (mine[0]) {
        // Supabase also set is_credit_only = false here, which a generated column refuses (so the reclaim always
        // failed there); is_credit_only follows the owner by itself.
        identity = mine[0].id as string;
        await tx.run(`UPDATE ${ARTISTS} SET ${col('owner_creator_account_id')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, accountId, userId, tx.at, identity);
      } else {
        identity = crypto.randomUUID();
        await tx.run(`INSERT INTO ${ARTISTS} (${['id', 'owner_creator_account_id', 'display_name', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          identity, accountId, accountName ?? resolved, userId, userId, tx.at, tx.at);
      }
      await tx.run(`UPDATE ${ACCOUNTS} SET ${col('identity_artist_id')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, identity, userId, tx.at, accountId);
    }
    return [{ creator_account_id: accountId, display_name: accountName }];
  });
}

export async function createCreatorArtist(ctx: ApiContext, accountId: string, displayName: string | null): Promise<unknown> {
  const userId = requireAuth(ctx);
  const clean = cleanText(displayName);
  if (clean == null) raise('Artist name is required', '22023');
  if (!(await canEdit(ctx, accountId))) raise('Not authorized for creator account', '42501');
  return transaction(ctx, async (tx) => {
    // The same name is the same artist: two "Cantor Tharwat" rows would split his catalogue.
    const name = normalizeCreatorName(clean);
    const existing = (await tx.all(`SELECT * FROM ${ARTISTS}`)).filter((artist) => normalizeCreatorName(artist.display_name as string) === name)
      .sort((a, b) => order.ascNullsLast(a.owner_creator_account_id, b.owner_creator_account_id) || order.ascNullsLast(a.created_at, b.created_at))[0];
    if (existing) return payload({ id: existing.id, title: existing.display_name, subtitle: existing.is_credit_only === 1 ? 'credit only' : 'artist' });
    const id = crypto.randomUUID();
    await tx.run(`INSERT INTO ${ARTISTS} (${['id', 'owner_creator_account_id', 'display_name', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      id, clean, userId, userId, tx.at, tx.at);
    return payload({ id, title: clean, subtitle: 'credit only' });
  });
}

export async function createCreatorCantor(ctx: ApiContext, accountId: string, displayName: string | null, contributorType: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    const cantorId = await resolveLearningArtist(ctx, tx, accountId, null, displayName);
    const cantor = (await tx.first(`SELECT * FROM ${t('learning', 'cantors')} WHERE ${col('id')} = ?`, cantorId))!;
    const artist = await tx.first(`SELECT * FROM ${ARTISTS} WHERE ${col('id')} = ?`, cantor.artist_id);
    return payload({
      id: cantor.id, artistId: artist?.id ?? null, title: artist?.display_name ?? null, subtitle: cantor.publication_status,
      kind: (contributorType ?? '').toLowerCase() === 'chorus' ? 'chorus' : 'cantor',
    });
  });
}

export async function createCreatorHymn(ctx: ApiContext, accountId: string, title: string | null): Promise<unknown> {
  const clean = cleanText(title);
  if (!ctx.userId || !(await canEdit(ctx, accountId))) raise('Not authorized for creator account', '42501');
  if (clean == null || [...clean].length > 180) raise('Enter a hymn title of at most 180 characters', '22023');
  return transaction(ctx, async (tx) => {
    const wanted = clean!.toLowerCase();
    let hymn: Row | null = (await tx.all(`SELECT * FROM ${t('learning', 'hymns')} WHERE ${col('publication_status')} = 'published' OR ${col('created_by')} = ?`, ctx.userId))
      .filter((h) => trimSpaces(h.title as string).toLowerCase() === wanted)
      .sort((a, b) => trueFirst(a.publication_status === 'published', b.publication_status === 'published'))[0] ?? null;
    if (!hymn) {
      hymn = await tx.writeFirst(`INSERT INTO ${t('learning', 'hymns')} (${['id', 'title', 'publication_status', 'metadata', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, 'draft', ?, ?, ?, ?, ?) RETURNING *`, crypto.randomUUID(), clean, jsonbText({ creatorAccountId: accountId }), ctx.userId, ctx.userId, tx.at, tx.at);
    }
    return payload({ id: hymn!.id, title: hymn!.title, subtitle: hymn!.publication_status === 'published' ? 'Existing hymn' : 'New hymn awaiting Coptic Vine review' });
  });
}

const PLATFORMS = ['website', 'linktree', 'youtube', 'soundcloud', 'spotify', 'apple_music', 'facebook', 'instagram', 'tiktok', 'x', 'bandcamp'];
const PLATFORM_URLS: [string, RegExp, string][] = [
  ['linktree', /^https?:\/\/(www\.)?linktr\.ee(\/|$)/i, 'The Linktree field must contain a linktr.ee URL'],
  ['youtube', /^https?:\/\/(([^/]+\.)?youtube\.com|youtu\.be)(\/|$)/i, 'The YouTube field must contain a YouTube URL'],
  ['soundcloud', /^https?:\/\/([^/]+\.)?soundcloud\.com(\/|$)/i, 'The SoundCloud field must contain a SoundCloud URL'],
  ['spotify', /^https?:\/\/(([^/]+\.)?spotify\.com|spotify\.link)(\/|$)/i, 'The Spotify field must contain a Spotify URL'],
  ['apple_music', /^https?:\/\/music\.apple\.com(\/|$)/i, 'The Apple Music field must contain a music.apple.com URL'],
  ['facebook', /^https?:\/\/(([^/]+\.)?facebook\.com|fb\.com|fb\.me)(\/|$)/i, 'The Facebook field must contain a Facebook URL'],
  ['instagram', /^https?:\/\/([^/]+\.)?instagram\.com(\/|$)/i, 'The Instagram field must contain an Instagram URL'],
];

/** private.replace_artist_social_links: the links checked and saved in order (a platform once). */
async function replaceSocialLinks(tx: Tx, artistId: unknown, links: unknown): Promise<void> {
  if (!Array.isArray(links)) raise('Social links must be a list', '22023');
  const LINKS = t('music', 'artist_social_links');
  await tx.run(`DELETE FROM ${LINKS} WHERE ${col('artist_id')} = ?`, artistId);
  let position = 0;
  for (const link of links as unknown[]) {
    const platform = trimSpaces(arrowText(link, 'platform') ?? '').toLowerCase();
    const label = cleanText(arrowText(link, 'label'));
    let url = cleanText(arrowText(link, 'url'));
    if (url == null) continue;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!/^https?:\/\/[^\p{White_Space}]+$/iu.test(url)) raise(`Enter a valid web link for ${label ?? platform}`, '22023');
    if (!PLATFORMS.includes(platform) && !platform.startsWith('custom:')) raise(`Unknown artist link type: ${platform}`, '22023');
    if (platform.startsWith('custom:') && label == null) raise('Extra links need a name', '22023');
    const rule = PLATFORM_URLS.find(([name]) => name === platform);
    if (rule && !rule[1].test(url)) raise(rule[2], '22023');
    await tx.run(`INSERT INTO ${LINKS} (${['id', 'artist_id', 'platform', 'label', 'url', 'sort_order', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (${col('artist_id')}, ${col('platform')}) DO UPDATE SET ${col('label')} = excluded.${col('label')}, ${col('url')} = excluded.${col('url')},
        ${col('sort_order')} = excluded.${col('sort_order')}, ${col('updated_at')} = ?`,
    crypto.randomUUID(), artistId, platform, platform.startsWith('custom:') ? label : null, url, position, tx.at, tx.at, tx.at);
    position += 1;
  }
}

export async function updateCreatorArtistProfile(ctx: ApiContext, a: {
  accountId: string; displayName: string | null; sortName: string | null; biography: string | null; socialLinks: unknown; pinned: (string | null)[] | null; profileIntent: string | null;
}): Promise<unknown> {
  const userId = requireAuth(ctx);
  if (!(await canEdit(ctx, a.accountId))) raise('Not authorized for creator account', '42501');
  await transaction(ctx, async (tx) => {
    const artistId = (await tx.first(`SELECT ${col('identity_artist_id')} AS id FROM ${ACCOUNTS} WHERE ${col('id')} = ?`, a.accountId))?.id;
    if (artistId == null) raise('This account has no artist identity yet', 'P0002');
    const clean = cleanText(a.displayName);
    await tx.run(`UPDATE ${ARTISTS} SET ${col('display_name')} = coalesce(?, ${col('display_name')}), ${col('sort_name')} = coalesce(?, ${col('sort_name')}),
      ${col('biography')} = CASE WHEN ? THEN ${col('biography')} ELSE ? END, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`,
    clean, cleanText(a.sortName), a.biography == null ? 1 : 0, a.biography == null ? null : cleanText(a.biography), userId, tx.at, artistId);
    // The account is the artist: renaming one renames the other.
    if (clean != null) await tx.run(`UPDATE ${ACCOUNTS} SET ${col('display_name')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, clean, userId, tx.at, a.accountId);
    if (a.socialLinks != null) await replaceSocialLinks(tx, artistId, a.socialLinks);
    if (a.pinned != null) {
      const PINS = t('music', 'artist_pinned_releases');
      await tx.run(`DELETE FROM ${PINS} WHERE ${col('artist_id')} = ?`, artistId);
      let position = 0;
      for (const releaseId of a.pinned) {
        // Only your own work can be pinned.
        if (await tx.first(`SELECT 1 AS yes FROM ${t('music', 'releases')} WHERE ${col('id')} = ? AND ${col('owner_creator_account_id')} = ?`, releaseId, a.accountId)) {
          await tx.run(`INSERT INTO ${PINS} (${col('artist_id')}, ${col('release_id')}, ${col('sort_order')}, ${col('created_at')}) VALUES (?, ?, ?, ?)
            ON CONFLICT (${col('artist_id')}, ${col('release_id')}) DO UPDATE SET ${col('sort_order')} = excluded.${col('sort_order')}`, artistId, releaseId, position, tx.at);
          position += 1;
        }
      }
    }
    if (a.profileIntent != null) {
      const intent = await tx.first(`SELECT * FROM ${t('media', 'upload_intents')} WHERE ${col('id')} = ?`, a.profileIntent);
      if (!intent || intent.creator_account_id !== a.accountId) raise('Profile picture upload not found for this account', 'P0002');
      // private.queue_artist_profile_image
      if (intent!.media_type !== 'image') raise('A profile picture must be an image', '22023');
      await enqueueJob(ctx, tx, a.profileIntent, 'image_delivery', 'chc-images');
      const artist = (await tx.first(`SELECT ${col('metadata')} FROM ${ARTISTS} WHERE ${col('id')} = ?`, artistId))!;
      const metadata = { ...(JSON.parse((artist.metadata as string) ?? '{}') as Row), pendingProfileImageUploadIntentId: a.profileIntent };
      await tx.run(`UPDATE ${ARTISTS} SET ${col('metadata')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, jsonbText(metadata), userId, tx.at, artistId);
    }
  });
  return getCreatorArtistProfile(ctx, a.accountId);
}

export async function enqueueMediaProcessingJob(ctx: ApiContext, intentId: string | null, jobType: string | null, outputBucket: string | null): Promise<unknown> {
  return [await transaction(ctx, (tx) => enqueueJob(ctx, tx, intentId, jobType, outputBucket))];
}

export async function submitMediaSubmission(ctx: ApiContext, submissionId: string): Promise<unknown> {
  return [await transaction(ctx, (tx) => submitSubmission(ctx, tx, submissionId))];
}

export async function addMediaSubmissionItem(ctx: ApiContext, a: {
  submissionId: string; intentId: string | null; assetId: string | null; title: string | null; sortOrder: number | null; required: boolean | null; role: string | null;
}): Promise<unknown> {
  return [await transaction(ctx, (tx) => addSubmissionItem(ctx, tx, a))];
}

export async function deleteSubmission(ctx: ApiContext, submissionId: string): Promise<unknown> {
  requireAuth(ctx);
  return transaction(ctx, async (tx) => {
    const sub = await tx.first(`SELECT * FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submissionId);
    if (!sub) raise('Submission not found', 'P0002');
    if (!(await canEdit(ctx, sub!.creator_account_id))) raise('Not authorized for this submission', '42501');
    let deletedTracks = 0;
    let deletedItems = 0;
    if (sub!.submission_type === 'music_release') {
      const release = await tx.first(`SELECT ${col('id')} FROM ${t('music', 'releases')} WHERE nullif(json_extract(${col('metadata')}, '$.submissionId'), '') = ?`, sub!.id);
      if (release) deletedTracks = (await deleteReleaseCore(tx, release.id)).deletedTrackCount as number;
    } else if (sub!.submission_type === 'learning_album') {
      deletedItems = (await tx.first(`SELECT count(*) AS n FROM ${t('learning', 'album_recordings')} r JOIN ${t('learning', 'albums')} a ON a.${col('id')} = r.${col('album_id')} WHERE a.${col('submission_id')} = ?`, sub!.id))!.n as number;
      await tx.run(`DELETE FROM ${t('learning', 'albums')} WHERE ${col('submission_id')} = ?`, sub!.id);
    } else if (sub!.submission_type === 'learning_lesson_set') {
      deletedItems = (await tx.first(`SELECT count(*) AS n FROM ${t('learning', 'lessons')} l JOIN ${t('learning', 'lesson_sets')} s ON s.${col('id')} = l.${col('lesson_set_id')} WHERE s.${col('submission_id')} = ?`, sub!.id))!.n as number;
      await tx.run(`DELETE FROM ${t('learning', 'lesson_sets')} WHERE ${col('submission_id')} = ?`, sub!.id);
    }
    await tx.run(`DELETE FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, sub!.id);
    return payload({ submissionId: sub!.id, kind: sub!.submission_type, deleted: true, deletedTrackCount: deletedTracks, deletedItemCount: deletedItems });
  });
}

/** The release's account and submission (metadata.submissionId, '' as none). */
async function releaseOwner(tx: Tx, releaseId: string): Promise<{ account: unknown; submission: string | null }> {
  const release = await tx.first(`SELECT ${col('owner_creator_account_id')} AS account, nullif(json_extract(${col('metadata')}, '$.submissionId'), '') AS submission FROM ${t('music', 'releases')} WHERE ${col('id')} = ?`, releaseId);
  return { account: release?.account ?? null, submission: (release?.submission as string | null | undefined) ?? null };
}

export async function deleteCreatorMusicRelease(ctx: ApiContext, releaseId: string): Promise<unknown> {
  const userId = requireAuth(ctx);
  return transaction(ctx, async (tx) => {
    const { account, submission } = await releaseOwner(tx, releaseId);
    if (account == null) raise('Release not found', 'P0002');
    if (!(await canEdit(ctx, account))) raise('Not authorized for this release', '42501');
    if (submission != null) {
      const status = (await tx.first(`SELECT ${col('status')} FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submission))?.status;
      if (status != null) {
        await addEvent(tx, submission, userId, 'release_deleted_by_creator', status, status, 'The creator permanently deleted the release from the Coptic Vine music catalog.', { releaseId });
      }
    }
    return payload(await deleteReleaseCore(tx, releaseId));
  });
}

export async function deleteCreatorMusicReleaseTrack(ctx: ApiContext, releaseId: string, trackId: string): Promise<unknown> {
  const userId = requireAuth(ctx);
  return transaction(ctx, async (tx) => {
    const { account, submission } = await releaseOwner(tx, releaseId);
    if (account == null) raise('Release not found', 'P0002');
    if (!(await canEdit(ctx, account))) raise('Not authorized for this release', '42501');
    const result = await deleteReleaseTrackCore(tx, releaseId, trackId);
    if (submission != null) {
      const status = (await tx.first(`SELECT ${col('status')} FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submission))?.status;
      if (status != null) {
        await addEvent(tx, submission, userId, 'track_deleted_by_creator', status, status, 'The creator permanently deleted a track from the release.', { releaseId, trackId });
      }
    }
    return payload(result);
  });
}

