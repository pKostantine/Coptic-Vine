/**
 * The creator editor's reads: ports of public.get_creator_workspaces,
 * get_creator_dashboard, get_creator_catalog_options, get_creator_credit_options,
 * get_creator_artist_profile, get_creator_releases, get_creator_release,
 * get_creator_submission_items, get_submission_editor,
 * search_creator_contributors and find_reusable_uploaded_media_intent
 * (schema/pg-user-schema.sql), checked by tests/creator.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { compareText } from '../../../../content-api/src/pg.ts';
import { pgTimestamp } from '../../time.ts';
import { raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { cantorEditable } from '../learning/shared.ts';
import { similarity } from '../search/text.ts';
import {
  all, canEdit, canRead, canReadOwner, earliestReleaseAt, editorImage, first, IN_LIST, itemMediaReady, itemProcessingState, ME, meParams, metadataText, order,
  payload, previewCover, releaseDisplayDate, requireAuth, requiredItemsReady, UID, viewer, type Row,
} from './shared.ts';

const DENIED = 'Not authorized for creator account';

export async function getCreatorWorkspaces(ctx: ApiContext): Promise<unknown> {
  const userId = requireAuth(ctx);
  const rows = await all(ctx, `SELECT account.${col('id')} AS id, account.${col('display_name')} AS display_name, account.${col('status')} AS status, member.${col('role')} AS role, member.${col('created_at')} AS joined
    FROM ${t('creator', 'creator_account_members')} member JOIN ${t('creator', 'creator_accounts')} account ON account.${col('id')} = member.${col('creator_account_id')}
    WHERE member.${col('user_id')} = ?`, userId);
  rows.sort((a, b) => order.ascNullsLast(a.joined, b.joined));
  return payload(rows.map((r) => ({ id: r.id, displayName: r.display_name, status: r.status, role: r.role })));
}

export async function getCreatorDashboard(ctx: ApiContext, accountId: string): Promise<unknown> {
  requireAuth(ctx);
  if (!(await canRead(ctx, accountId))) raise(DENIED, '42501');
  const v = await viewer(ctx);
  const [submissions, artists, cantors] = await Promise.all([
    all(ctx, `SELECT s.*, (SELECT count(*) FROM ${t('media', 'submission_items')} i WHERE i.${col('submission_id')} = s.${col('id')}) AS item_count
      FROM ${t('media', 'submissions')} s WHERE s.${col('creator_account_id')} = ?`, accountId),
    all(ctx, `SELECT ${col('id')}, ${col('display_name')}, ${col('publication_status')} FROM ${t('music', 'artists')} WHERE ${col('owner_creator_account_id')} = ?`, accountId),
    all(ctx, `${ME} SELECT c.${col('id')}, c.${col('display_name')}, c.${col('publication_status')}, c.${col('metadata')} FROM ${t('learning', 'cantors')} c
      WHERE c.${col('publication_status')} = 'published' OR ${cantorEditable(`c.${col('id')}`)}`, ...meParams(v)),
  ]);
  submissions.sort((a, b) => order.descNullsLast(a.updated_at, b.updated_at));
  const byLowerName = (a: Row, b: Row) => compareText((a.display_name as string).toLowerCase(), (b.display_name as string).toLowerCase());
  return payload({
    submissions: submissions.map((s) => ({
      id: s.id, submissionType: s.submission_type, title: s.title, description: s.description, status: s.status, submittedAt: s.submitted_at,
      reviewDueAt: s.review_due_at, reviewNotes: s.review_notes, publishedAt: s.published_at, createdAt: s.created_at, updatedAt: s.updated_at, itemCount: s.item_count,
    })),
    artists: artists.sort(byLowerName).map((a) => ({ id: a.id, title: a.display_name, subtitle: a.publication_status })),
    cantors: cantors.sort(byLowerName).map((c) => ({
      id: c.id, title: c.display_name, subtitle: c.publication_status,
      kind: (metadataText(c.metadata, 'contributorType') ?? 'cantor').toLowerCase() === 'chorus' ? 'chorus' : 'cantor',
    })),
  });
}

export async function getCreatorCatalogOptions(ctx: ApiContext): Promise<unknown> {
  const userId = requireAuth(ctx);
  const v = await viewer(ctx);
  // SECURITY INVOKER: learning_*_select lets anyone read what is published, and admins everything.
  const [seasons, hymns] = await Promise.all([
    all(ctx, `SELECT s.${col('id')}, s.${col('title')}, s.${col('slug')}, s.${col('sort_order')},
        (SELECT l.${col('title')} FROM ${t('learning', 'season_localizations')} l WHERE l.${col('season_id')} = s.${col('id')} AND l.${col('locale')} = 'ar') AS title_ar
      FROM ${t('learning', 'seasons')} s WHERE s.${col('publication_status')} = 'published'`),
    all(ctx, `SELECT ${col('id')}, ${col('title')}, ${col('subtitle')} FROM ${t('learning', 'hymns')}
      WHERE ${col('publication_status')} = 'published' OR (${col('created_by')} = ? AND ?)`, userId, v.admin ? 1 : 0),
  ]);
  seasons.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.text(a.title, b.title));
  hymns.sort((a, b) => order.text(a.title, b.title));
  return payload({
    seasons: seasons.map((s) => ({ id: s.id, title: s.title, titleArabic: s.title_ar, subtitle: s.slug })),
    hymns: hymns.map((h) => ({ id: h.id, title: h.title, subtitle: h.subtitle })),
  });
}

async function identityArtistId(ctx: ApiContext, accountId: unknown): Promise<unknown> {
  return (await first(ctx, `SELECT ${col('identity_artist_id')} AS id FROM ${t('creator', 'creator_accounts')} WHERE ${col('id')} = ?`, accountId))?.id ?? null;
}

export async function getCreatorCreditOptions(ctx: ApiContext, accountId: string): Promise<unknown> {
  requireAuth(ctx);
  if (!(await canEdit(ctx, accountId))) raise(DENIED, '42501');
  const identity = await identityArtistId(ctx, accountId);
  const artists = await all(ctx, `SELECT ${col('id')}, ${col('display_name')}, ${col('is_credit_only')} FROM ${t('music', 'artists')} WHERE ${col('id')} = ? OR ${col('is_credit_only')} = 1`, identity);
  const own = artists.find((a) => a.id === identity);
  artists.sort((a, b) => (a.is_credit_only as number) - (b.is_credit_only as number) || order.text(a.display_name, b.display_name));
  return payload({
    identityArtist: own ? { id: own.id, displayName: own.display_name } : null,
    creditableArtists: artists.map((a) => ({ id: a.id, displayName: a.display_name, isCreditOnly: a.is_credit_only === 1 })),
  });
}

const releaseSummary = (r: Row) => ({ id: r.id, title: r.title, releaseType: r.release_type, publicationStatus: r.publication_status, displayDate: releaseDisplayDate(r) });

export async function getCreatorArtistProfile(ctx: ApiContext, accountId: string): Promise<unknown> {
  requireAuth(ctx);
  if (!(await canEdit(ctx, accountId))) raise(DENIED, '42501');
  const artist = await first(ctx, `SELECT artist.* FROM ${t('creator', 'creator_accounts')} account JOIN ${t('music', 'artists')} artist ON artist.${col('id')} = account.${col('identity_artist_id')}
    WHERE account.${col('id')} = ?`, accountId);
  if (!artist) raise('This account has no artist identity yet', 'P0002');
  const [image, links, pinned, releases] = await Promise.all([
    artist!.profile_image_asset_id == null ? null : first(ctx, `SELECT * FROM ${t('media', 'media_assets')} WHERE ${col('id')} = ?`, artist!.profile_image_asset_id),
    all(ctx, `SELECT * FROM ${t('music', 'artist_social_links')} WHERE ${col('artist_id')} = ?`, artist!.id),
    all(ctx, `SELECT r.*, p.${col('sort_order')} AS pinned_order FROM ${t('music', 'artist_pinned_releases')} p JOIN ${t('music', 'releases')} r ON r.${col('id')} = p.${col('release_id')} WHERE p.${col('artist_id')} = ?`, artist!.id),
    all(ctx, `SELECT * FROM ${t('music', 'releases')} WHERE ${col('owner_creator_account_id')} = ?`, accountId),
  ]);
  links.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.text(a.platform, b.platform));
  pinned.sort((a, b) => order.number(a.pinned_order, b.pinned_order));
  releases.sort((a, b) => order.descNullsLast(a.created_at, b.created_at));
  return payload({
    id: artist!.id, displayName: artist!.display_name, sortName: artist!.sort_name, biography: artist!.biography, publicationStatus: artist!.publication_status,
    profileImage: image ? { assetId: image.id, bucket: image.bucket, path: image.path, version: editorImage(image)!.version } : null,
    profileImagePending: metadataText(artist!.metadata, 'pendingProfileImageUploadIntentId'),
    socialLinks: links.map((l) => ({ id: l.id, platform: l.platform, label: l.label, url: l.url })),
    pinnedReleases: pinned.map(releaseSummary),
    releases: releases.map(releaseSummary),
  });
}

export async function getCreatorReleases(ctx: ApiContext, accountId: string): Promise<unknown> {
  requireAuth(ctx);
  if (!(await canEdit(ctx, accountId))) raise(DENIED, '42501');
  const submission = `s.${col('id')}`;
  const rows = await all(ctx, `SELECT r.*, s.${col('id')} AS submission_row_id, s.${col('status')} AS submission_status,
      CASE WHEN s.${col('id')} IS NULL THEN r.${col('publication_status')} = 'published' ELSE ${requiredItemsReady(submission)} END AS media_ready,
      (SELECT count(*) FROM ${t('music', 'release_tracks')} rt WHERE rt.${col('release_id')} = r.${col('id')}) AS track_count
    FROM ${t('music', 'releases')} r
    LEFT JOIN ${t('media', 'submissions')} s ON s.${col('id')} = nullif(json_extract(r.${col('metadata')}, '$.submissionId'), '')
    WHERE r.${col('owner_creator_account_id')} = ?
      AND (r.${col('publication_status')} = 'published' OR (s.${col('status')} = 'approved' AND ${requiredItemsReady(submission)}))`, accountId);
  const published = (r: Row) => (r.publication_status === 'published' ? 1 : 0);
  rows.sort((a, b) => published(a) - published(b) || order.ascNullsLast(a.scheduled_release_at ?? a.created_at, b.scheduled_release_at ?? b.created_at)
    || order.descNullsLast(a.created_at, b.created_at));
  const covers = await Promise.all(rows.map((r) => previewCover(ctx, r)));
  return payload(rows.map((r, i) => ({
    id: r.id, title: r.title, releaseType: r.release_type, publicationStatus: r.publication_status,
    musicType: metadataText(r.metadata, 'musicType'), recordingType: metadataText(r.metadata, 'recordingType'),
    releaseTimingMode: r.release_timing_mode, scheduledReleaseAt: r.scheduled_release_at, originalReleaseDate: r.original_release_date,
    displayDate: releaseDisplayDate(r), submissionId: r.submission_row_id ?? null, submissionStatus: r.submission_status ?? null,
    mediaReady: r.media_ready === 1, trackCount: r.track_count, cover: covers[i],
    releaseState: r.publication_status === 'published' ? 'released' : 'ready',
  })));
}

/** A localization's title for each locale, '' where there is none: the editor's localizedTitle(s). */
function titlesByLocale(rows: Row[], key: string, id: unknown, locales: string[]): Row {
  return Object.fromEntries(locales.map((locale) => [locale, rows.find((r) => r[key] === id && r.locale === locale)?.title ?? '']));
}

/** A track's credits: the first primary artist, the others, and the featured ones. */
function trackCredits(credits: Row[], trackId: unknown) {
  const mine = credits.filter((c) => c.track_id === trackId).sort((a, b) => order.number(a.sort_order, b.sort_order));
  return {
    main: mine.find((c) => c.role === 'primary') ?? null,
    others: mine.filter((c) => c.role !== 'primary').sort((a, b) => order.number(a.sort_order, b.sort_order) || order.text(a.display_name, b.display_name)),
    featured: mine.filter((c) => c.role === 'featured'),
  };
}

async function creditsOf(ctx: ApiContext, trackIds: unknown[]): Promise<Row[]> {
  if (!trackIds.length) return [];
  return all(ctx, `SELECT ta.*, a.${col('display_name')} AS display_name FROM ${t('music', 'track_artists')} ta JOIN ${t('music', 'artists')} a ON a.${col('id')} = ta.${col('artist_id')}
    WHERE ta.${col('track_id')} IN ${IN_LIST}`, JSON.stringify(trackIds));
}

export async function getCreatorRelease(ctx: ApiContext, releaseId: string): Promise<unknown> {
  requireAuth(ctx);
  const release = await first(ctx, `SELECT * FROM ${t('music', 'releases')} WHERE ${col('id')} = ?`, releaseId);
  if (!release) raise('Release not found', 'P0002');
  if (!(await canEdit(ctx, release!.owner_creator_account_id))) raise('Not authorized for this release', '42501');
  const identity = await identityArtistId(ctx, release!.owner_creator_account_id);
  const [primary, localizations, tracks, cover] = await Promise.all([
    first(ctx, `SELECT ${col('id')}, ${col('display_name')} FROM ${t('music', 'artists')} WHERE ${col('id')} = ?`, release!.primary_artist_id),
    all(ctx, `SELECT * FROM ${t('music', 'release_localizations')} WHERE ${col('release_id')} = ?`, releaseId),
    all(ctx, `SELECT tr.*, rt.${col('track_number')} AS track_number, rt.${col('disc_number')} AS disc_number FROM ${t('music', 'release_tracks')} rt
      JOIN ${t('music', 'tracks')} tr ON tr.${col('id')} = rt.${col('track_id')} WHERE rt.${col('release_id')} = ?`, releaseId),
    previewCover(ctx, release!),
  ]);
  const trackIds = tracks.map((tr) => tr.id);
  const [trackL, credits] = await Promise.all([
    trackIds.length ? all(ctx, `SELECT * FROM ${t('music', 'track_localizations')} WHERE ${col('track_id')} IN ${IN_LIST}`, JSON.stringify(trackIds)) : [],
    creditsOf(ctx, trackIds),
  ]);
  localizations.sort((a, b) => (b.is_primary as number) - (a.is_primary as number) || order.text(a.locale, b.locale));
  tracks.sort((a, b) => order.number(a.disc_number, b.disc_number) || order.number(a.track_number, b.track_number));
  return payload({
    id: release!.id, title: release!.title, subtitle: release!.subtitle, description: release!.description, releaseType: release!.release_type,
    publicationStatus: release!.publication_status, musicType: metadataText(release!.metadata, 'musicType'), recordingType: metadataText(release!.metadata, 'recordingType'),
    releaseTimingMode: release!.release_timing_mode, scheduledReleaseAt: release!.scheduled_release_at, originalReleaseDate: release!.original_release_date,
    displayDate: releaseDisplayDate(release!), earliestReleaseAt: earliestReleaseAt(),
    primaryArtist: primary ? { id: primary.id, displayName: primary.display_name } : null,
    cover,
    localizations: localizations.map((l) => ({ locale: l.locale, title: l.title })),
    tracks: tracks.map((tr) => {
      const c = trackCredits(credits, tr.id);
      return {
        id: tr.id, trackNumber: tr.track_number, discNumber: tr.disc_number, title: tr.title, durationMs: tr.duration_ms, publicationStatus: tr.publication_status,
        hasMedia: tr.media_asset_id != null,
        localizedTitle: titlesByLocale(trackL, 'track_id', tr.id, ['en', 'ar', 'cop', 'fr']),
        mainArtistName: c.main ? (c.main.artist_id === identity ? '' : c.main.display_name) : '',
        contributors: c.others.map((o) => ({ id: `${o.artist_id}:${o.role}`, name: o.display_name, role: o.role })),
        mainArtist: c.main ? { id: c.main.artist_id, displayName: c.main.display_name } : null,
        featuredArtists: c.featured.map((f) => ({ id: f.artist_id, displayName: f.display_name })),
      };
    }),
  });
}

/** The job each item's upload is on now (not the one stamped on the item): the delivery job of its kind first, then the furthest along, newest first. */
function liveJobOrder(intentType: unknown) {
  const delivery = intentType === 'video' ? 'video_delivery' : intentType === 'image' ? 'image_delivery' : 'audio_delivery';
  const stage = (status: unknown) => ({ completed: 0, processing: 1, queued: 2 } as Record<string, number>)[status as string] ?? 3;
  return (a: Row, b: Row) => (a.job_type === delivery ? 0 : 1) - (b.job_type === delivery ? 0 : 1) || stage(a.status) - stage(b.status) || order.descNullsLast(a.created_at, b.created_at);
}

export async function getCreatorSubmissionItems(ctx: ApiContext, submissionId: string): Promise<unknown> {
  requireAuth(ctx);
  // SECURITY INVOKER: submissions_select_creator_or_admin and submission_items_select_submission_reader.
  const submission = await first(ctx, `SELECT ${col('creator_account_id')} AS account FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submissionId);
  if (!submission || !(await canRead(ctx, submission.account))) raise('Submission not found', 'P0002');
  // upload_intents_select_requester_or_creator and media_processing_jobs_select_creator hide the rest.
  const v = await viewer(ctx);
  const intentVisible = (u: string) => `(${u}.${col('requested_by')} = ${UID} OR ${canReadOwner(`${u}.${col('creator_account_id')}`)})`;
  const items = await all(ctx, `${ME} SELECT i.*, u.${col('media_type')} AS intent_type, u.${col('content_length')} AS content_length, u.${col('status')} AS upload_status
    FROM ${t('media', 'submission_items')} i LEFT JOIN ${t('media', 'upload_intents')} u ON u.${col('id')} = i.${col('upload_intent_id')} AND ${intentVisible('u')}
    WHERE i.${col('submission_id')} = ?`, ...meParams(v), submissionId);
  const intents = [...new Set(items.map((i) => i.upload_intent_id).filter((id) => id != null))];
  const jobs = intents.length ? await all(ctx, `${ME} SELECT j.* FROM ${t('media', 'media_processing_jobs')} j WHERE j.${col('upload_intent_id')} IN ${IN_LIST}
    AND (EXISTS (SELECT 1 FROM ${t('media', 'upload_intents')} u WHERE u.${col('id')} = j.${col('upload_intent_id')} AND ${intentVisible('u')})
      OR EXISTS (SELECT 1 FROM ${t('media', 'media_assets')} a WHERE a.${col('id')} = j.${col('media_asset_id')} AND ${canReadOwner(`a.${col('owner_creator_account_id')}`)}))`,
  ...meParams(v), JSON.stringify(intents)) : [];
  items.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.created_at, b.created_at));
  return payload(items.map((i) => {
    const job = jobs.filter((j) => j.upload_intent_id === i.upload_intent_id).sort(liveJobOrder(i.intent_type))[0];
    return {
      id: i.id, title: i.title, role: i.role, sortOrder: i.sort_order, required: i.required === 1, mediaAssetId: i.media_asset_id, uploadIntentId: i.upload_intent_id,
      mediaType: i.intent_type ?? null, contentLength: i.content_length ?? null, uploadStatus: i.upload_status ?? null,
      processingStatus: job?.status ?? null, processingJobType: job?.job_type ?? null, processingAttemptCount: job?.attempt_count ?? null,
      processingMaxAttempts: job?.max_attempts ?? null, processingError: job?.error_message ?? null, processingAvailableAt: job?.available_at ?? null,
      processingProgress: job?.progress ?? null,
    };
  }));
}

const LOCALES = ['en', 'ar', 'fr'];

/** private.edit_localized_titles: en, ar and fr from a jsonb object, trimmed, '' where missing. */
function editLocalizedTitles(stored: unknown): Row {
  const value = stored == null ? null : JSON.parse(stored as string);
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
  return Object.fromEntries(LOCALES.map((locale) => {
    const entry = object?.[locale];
    const text = entry == null ? null : typeof entry === 'string' ? entry : JSON.stringify(entry);
    return [locale, text == null ? '' : text.replace(/^ +| +$/g, '')];
  }));
}

export async function getSubmissionEditor(ctx: ApiContext, submissionId: string): Promise<unknown> {
  requireAuth(ctx);
  const v = await viewer(ctx);
  const sub = await first(ctx, `SELECT * FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submissionId);
  if (!sub) raise('Submission not found', 'P0002');
  if (!(await canEdit(ctx, sub!.creator_account_id))) raise('Not authorized for this submission', '42501');
  const identity = await identityArtistId(ctx, sub!.creator_account_id);
  const result: Row = {
    submissionId: sub!.id, kind: sub!.submission_type, status: sub!.status, reviewNotes: sub!.review_notes, creatorAccountId: sub!.creator_account_id,
    isAdmin: v.admin, canEdit: !['rejected', 'archived'].includes(sub!.status as string), earliestReleaseAt: earliestReleaseAt(),
  };
  const items = t('media', 'submission_items');
  const intents = t('media', 'upload_intents');
  const replacementOf = async (itemId: unknown) => {
    const waiting = await first(ctx, `SELECT w.${col('id')} AS id, wi.${col('original_filename')} AS file_name, wi.${col('media_type')} AS media_type, ${itemProcessingState(`w.${col('id')}`)} AS state
      FROM ${items} w LEFT JOIN ${intents} wi ON wi.${col('id')} = w.${col('upload_intent_id')} WHERE w.${col('replaces_item_id')} = ? LIMIT 1`, itemId);
    return waiting ? { itemId: waiting.id, fileName: waiting.file_name, mediaType: waiting.media_type, processingStatus: waiting.state } : null;
  };
  let collectionCover: unknown = null;

  if (sub!.submission_type === 'music_release') {
    const rel = await first(ctx, `SELECT * FROM ${t('music', 'releases')} WHERE nullif(json_extract(${col('metadata')}, '$.submissionId'), '') = ?`, sub!.id);
    if (!rel) raise('This submission has no release to edit', 'P0002');
    collectionCover = rel!.cover_asset_id;
    const [releaseL, artist, tracks] = await Promise.all([
      all(ctx, `SELECT * FROM ${t('music', 'release_localizations')} WHERE ${col('release_id')} = ?`, rel!.id),
      first(ctx, `SELECT ${col('id')}, ${col('display_name')} FROM ${t('music', 'artists')} WHERE ${col('id')} = ?`, rel!.primary_artist_id),
      // Each track's newest item of this submission (not a replacement), and its upload.
      all(ctx, `SELECT tr.*, rt.${col('disc_number')} AS disc_number, rt.${col('track_number')} AS track_number, item.${col('id')} AS item_id,
          u.${col('media_type')} AS intent_type, u.${col('original_filename')} AS file_name,
          CASE WHEN item.${col('id')} IS NULL THEN NULL ELSE ${itemProcessingState(`item.${col('id')}`)} END AS item_state
        FROM ${t('music', 'release_tracks')} rt JOIN ${t('music', 'tracks')} tr ON tr.${col('id')} = rt.${col('track_id')}
        LEFT JOIN ${items} item ON item.${col('id')} = (SELECT c.${col('id')} FROM ${items} c WHERE c.${col('submission_id')} = ? AND c.${col('music_track_id')} = tr.${col('id')}
          AND c.${col('replaces_item_id')} IS NULL ORDER BY c.${col('created_at')} DESC LIMIT 1)
        LEFT JOIN ${intents} u ON u.${col('id')} = item.${col('upload_intent_id')}
        WHERE rt.${col('release_id')} = ?`, sub!.id, rel!.id),
    ]);
    const trackIds = tracks.map((tr) => tr.id);
    const [trackL, credits] = await Promise.all([
      trackIds.length ? all(ctx, `SELECT * FROM ${t('music', 'track_localizations')} WHERE ${col('track_id')} IN ${IN_LIST}`, JSON.stringify(trackIds)) : [],
      creditsOf(ctx, trackIds),
    ]);
    tracks.sort((a, b) => order.number(a.disc_number, b.disc_number) || order.number(a.track_number, b.track_number));
    Object.assign(result, {
      catalogId: rel!.id, isLive: rel!.publication_status === 'published', publicationStatus: rel!.publication_status, title: rel!.title,
      localizedTitles: titlesByLocale(releaseL, 'release_id', rel!.id, LOCALES), description: rel!.description, releaseType: rel!.release_type,
      musicType: metadataText(rel!.metadata, 'musicType'), recordingType: metadataText(rel!.metadata, 'recordingType'),
      releaseTimingMode: rel!.release_timing_mode, scheduledReleaseAt: rel!.scheduled_release_at, originalReleaseDate: rel!.original_release_date,
      artist: artist ? { id: artist.id, displayName: artist.display_name } : null,
      items: await Promise.all(tracks.map(async (tr) => {
        const c = trackCredits(credits, tr.id);
        return {
          id: tr.id, itemId: tr.item_id ?? null, title: tr.title, localizedTitles: titlesByLocale(trackL, 'track_id', tr.id, LOCALES),
          durationMs: tr.duration_ms, publicationStatus: tr.publication_status, mediaType: tr.intent_type ?? 'audio', fileName: tr.file_name ?? null,
          processingStatus: tr.item_id == null ? (tr.media_asset_id == null ? 'missing' : 'completed') : tr.item_state,
          mainArtist: c.main ? { id: c.main.artist_id, displayName: c.main.display_name, isIdentity: c.main.artist_id === identity } : null,
          contributors: c.others.map((o) => ({ id: `${o.artist_id}:${o.role}`, artistId: o.artist_id, name: o.display_name, role: o.role })),
          replacement: tr.item_id == null ? null : await replacementOf(tr.item_id),
        };
      })),
    });
  } else {
    const album = sub!.submission_type === 'learning_album';
    const table = album ? t('learning', 'albums') : t('learning', 'lesson_sets');
    const collection = await first(ctx, `SELECT * FROM ${table} WHERE ${col('submission_id')} = ?`, sub!.id);
    if (!collection) raise(`This submission has no ${album ? 'album' : 'lesson set'} to edit`, 'P0002');
    collectionCover = collection!.cover_asset_id;
    const [localizations, cantor, hymn] = await Promise.all([
      all(ctx, album
        ? `SELECT ${col('album_id')} AS owner, ${col('locale')}, ${col('title')} FROM ${t('learning', 'album_localizations')} WHERE ${col('album_id')} = ?`
        : `SELECT ${col('lesson_set_id')} AS owner, ${col('locale')}, ${col('title')} FROM ${t('learning', 'lesson_set_localizations')} WHERE ${col('lesson_set_id')} = ?`, collection!.id),
      first(ctx, `SELECT * FROM ${t('learning', 'cantors')} WHERE ${col('id')} = ?`, collection!.cantor_id),
      album ? null : first(ctx, `SELECT ${col('id')}, ${col('title')} FROM ${t('learning', 'hymns')} WHERE ${col('id')} = ?`, collection!.hymn_id),
    ]);
    Object.assign(result, {
      catalogId: collection!.id, isLive: collection!.publication_status === 'published', publicationStatus: collection!.publication_status, title: collection!.title,
      localizedTitles: titlesByLocale(localizations, 'owner', collection!.id, LOCALES), description: collection!.description, seasonId: collection!.season_id,
      ...(album ? {} : { hymn: hymn ? { id: hymn.id, title: hymn.title } : null }),
      releaseTimingMode: collection!.release_timing_mode, scheduledReleaseAt: collection!.scheduled_release_at, originalReleaseDate: collection!.original_release_date,
      artist: cantor ? { id: cantor.artist_id ?? cantor.id, displayName: cantor.display_name } : null,
    });
    const recordings = album ? t('learning', 'album_recordings') : t('learning', 'lessons');
    const parent = album ? col('album_id') : col('lesson_set_id');
    const rows = await all(ctx, `SELECT item.*, u.${col('media_type')} AS intent_type, u.${col('original_filename')} AS file_name, a.${col('media_type')} AS asset_type,
        a.${col('duration_ms')} AS asset_duration, rec.${col('title')} AS rec_title, rec.${col('duration_ms')} AS rec_duration, rec.${col('publication_status')} AS rec_status,
        ${itemProcessingState(`item.${col('id')}`)} AS state
      FROM ${items} item
      LEFT JOIN ${intents} u ON u.${col('id')} = item.${col('upload_intent_id')}
      LEFT JOIN ${t('media', 'media_assets')} a ON a.${col('id')} = item.${col('media_asset_id')}
      LEFT JOIN ${recordings} rec ON rec.${parent} = ? AND json_extract(rec.${col('metadata')}, '$.submissionItemId') = item.${col('id')}
      WHERE item.${col('submission_id')} = ? AND item.${col('role')} <> 'artwork' AND item.${col('replaces_item_id')} IS NULL`, collection!.id, sub!.id);
    rows.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.created_at, b.created_at) || order.ascNullsLast(a.id, b.id));
    result.items = await Promise.all(rows.map(async (item) => ({
      id: item.id, itemId: item.id, title: item.rec_title ?? item.title, localizedTitles: editLocalizedTitles(item.localized_titles),
      durationMs: item.rec_duration ?? item.asset_duration ?? null, publicationStatus: item.rec_status ?? 'draft',
      mediaType: item.intent_type ?? item.asset_type ?? null, fileName: item.file_name ?? null, processingStatus: item.state,
      replacement: await replacementOf(item.id),
    })));
  }

  // The cover: the newest processed artwork, or the live one.
  const artwork = await first(ctx, `SELECT a.* FROM ${items} item JOIN ${t('media', 'media_assets')} a ON a.${col('id')} = item.${col('media_asset_id')} AND a.${col('processing_status')} = 'completed'
    WHERE item.${col('submission_id')} = ? AND item.${col('role')} = 'artwork' ORDER BY item.${col('created_at')} DESC, item.${col('id')} DESC LIMIT 1`, sub!.id);
  let cover = artwork ? editorImage(artwork, { isLive: artwork.id === collectionCover }) : null;
  if (!cover && collectionCover != null) cover = editorImage(await first(ctx, `SELECT * FROM ${t('media', 'media_assets')} WHERE ${col('id')} = ?`, collectionCover), { isLive: true });
  // Artwork still being processed.
  const pending = await first(ctx, `SELECT item.${col('id')} AS id, u.${col('original_filename')} AS file_name, ${itemProcessingState(`item.${col('id')}`)} AS state
    FROM ${items} item LEFT JOIN ${intents} u ON u.${col('id')} = item.${col('upload_intent_id')}
    WHERE item.${col('submission_id')} = ? AND item.${col('role')} = 'artwork' AND NOT ${itemMediaReady(`item.${col('id')}`)}
    ORDER BY item.${col('created_at')} DESC LIMIT 1`, sub!.id);
  return payload({ ...result, cover, pendingCover: pending ? { itemId: pending.id, fileName: pending.file_name, processingStatus: pending.state } : null });
}

/** private.normalize_creator_name: lowercased, a leading title (Cantor, Mo'allem, المعلم…) dropped, then no spaces, punctuation or Arabic marks. */
export function normalizeCreatorName(name: string | null): string {
  return (name ?? '').replace(/^ +| +$/g, '').toLowerCase()
    .replace(/^(cantor|moallem|mouallem|muallem|mo.allim|المعلم|المرتل)\p{White_Space}+/isu, '')
    .replace(/[\p{White_Space}\p{P}ً-ْـ]+/gu, '');
}

/** round(double precision): half to even (rint). */
const roundHalfEven = (value: number) => {
  const floor = Math.floor(value);
  const diff = value - floor;
  return diff > 0.5 ? floor + 1 : diff < 0.5 ? floor : floor % 2 === 0 ? floor : floor + 1;
};

export async function searchCreatorContributors(ctx: ApiContext, accountId: string, query: string | null, kind: string | null, limit: number | null): Promise<unknown> {
  const normalized = normalizeCreatorName([...(query ?? '')].slice(0, 120).join(''));
  const most = Math.max(1, Math.min(limit ?? 12, 25));
  const mode = (kind ?? 'artist').replace(/^ +| +$/g, '').toLowerCase();
  if (!ctx.userId || !(await canEdit(ctx, accountId))) raise(DENIED, '42501');
  if (!['artist', 'cantor', 'all'].includes(mode)) raise('Invalid artist search kind', '22023');
  if ([...normalized].length < 2) return [];
  const candidates = await all(ctx, `SELECT a.${col('id')}, a.${col('display_name')}, a.${col('is_credit_only')}, a.${col('publication_status')} AS status, a.${col('owner_creator_account_id')} AS owner,
      asset.${col('id')} AS asset_id, asset.${col('bucket')} AS bucket, asset.${col('path')} AS path, asset.${col('version')} AS version
    FROM ${t('music', 'artists')} a
    LEFT JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = a.${col('profile_image_asset_id')} AND asset.${col('publication_status')} = 'published' AND asset.${col('media_type')} = 'image'
    WHERE a.${col('publication_status')} = 'published' OR a.${col('is_credit_only')} = 1 OR a.${col('owner_creator_account_id')} = ?`, accountId);
  const scored = candidates.flatMap((c) => {
    const name = normalizeCreatorName(c.display_name as string);
    const similar = similarity(name, normalized);
    if (!(name === normalized || name.includes(normalized) || similar >= 0.21)) return [];
    const photo = c.asset_id != null ? { bucket: c.bucket, path: c.path, version: c.version } : null;
    const score = (name === normalized ? 1000 : name.startsWith(normalized) ? 700 : name.includes(normalized) ? 470 : 0)
      + roundHalfEven(similar * 300) + (c.status === 'published' ? 350 : 0) + (c.owner != null ? 150 : 0) + (photo ? 130 : 0);
    return [{ c, photo, score }];
  });
  scored.sort((a, b) => b.score - a.score || Number(b.photo != null) - Number(a.photo != null) || order.text(a.c.display_name, b.c.display_name));
  return payload(scored.slice(0, most).map(({ c, photo, score }) => ({
    id: c.id, title: c.display_name, kind: mode === 'cantor' ? 'cantor' : 'artist', isCreditOnly: c.is_credit_only === 1, status: c.status, profileImage: photo, matchScore: score,
  })));
}

export async function findReusableUploadedMediaIntent(ctx: ApiContext, accountId: string, fileName: string | null, contentLength: number | null, mediaType: string | null): Promise<string | null> {
  if (!ctx.userId || !(await canEdit(ctx, accountId))) return null;
  const since = pgTimestamp(new Date(Date.now() - 7 * 24 * 3600_000));
  const intent = await first(ctx, `SELECT i.${col('id')} AS id FROM ${t('media', 'upload_intents')} i
    WHERE i.${col('creator_account_id')} = ? AND i.${col('requested_by')} = ? AND i.${col('original_filename')} = ? AND i.${col('content_length')} = ?
      AND i.${col('uploaded_size')} = ? AND i.${col('media_type')} = ? AND i.${col('status')} = 'uploaded' AND i.${col('uploaded_at')} > ?
      AND NOT EXISTS (SELECT 1 FROM ${t('media', 'submission_items')} item WHERE item.${col('upload_intent_id')} = i.${col('id')})
      AND (i.${col('original_deleted_at')} IS NULL OR EXISTS (SELECT 1 FROM ${t('media', 'media_processing_jobs')} job
        JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = job.${col('media_asset_id')}
        WHERE job.${col('upload_intent_id')} = i.${col('id')} AND job.${col('job_type')} = 'video_delivery' AND job.${col('status')} = 'completed'))
    ORDER BY i.${col('uploaded_at')} DESC LIMIT 1`, accountId, ctx.userId, fileName, contentLength, contentLength, mediaType, since);
  return (intent?.id as string | undefined) ?? null;
}
