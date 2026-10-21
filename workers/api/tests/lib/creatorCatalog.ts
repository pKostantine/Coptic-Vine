/**
 * A creator catalog for the creator editor's parity tests, seeded the same
 * into the oracle and the Worker: three creator accounts (with an owner, an
 * editor and a viewer), identity and credit-only artists, releases with and
 * without submissions, uploads in every state (processed, still processing,
 * failed, a silent video, a replacement waiting), and a learning album and
 * lesson set with their recordings and lessons.
 */
import type { Oracle } from './oracle.ts';
import { seed, type Seed } from './seed.ts';
import type { WorkerSide } from './worker.ts';

export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const ALICE = id(1); export const BOB = id(2); export const CAROL = id(3); export const DAVE = id(4); export const VERA = id(5); export const ERIN = id(6);
export const USERS: [string, string][] = [[ALICE, 'alice@example.com'], [BOB, 'bob@example.com'], [CAROL, 'carol@example.com'], [DAVE, 'dave@example.com'], [VERA, 'vera@example.com'], [ERIN, 'erin@example.com']];
export const C1 = id(10); export const C2 = id(11); export const C3 = id(12);
export const A1 = id(20); export const A2 = id(21); export const A3 = id(22); export const A4 = id(23); export const A5 = id(24); export const A6 = id(25);
export const R1 = id(40); export const R2 = id(41); export const R3 = id(42); export const R4 = id(43); export const R5 = id(44); export const R6 = id(45);
export const T1 = id(50); export const T2 = id(51); export const T3 = id(52); export const T4 = id(53);
export const S1 = id(60); export const S2 = id(61); export const S3 = id(62); export const S4 = id(63); export const S5 = id(64); export const S6 = id(65); export const S7 = id(66);
export const K1 = id(70); export const K2 = id(71);
export const AL1 = id(80); export const LS1 = id(81); export const H1 = id(82); export const H2 = id(83); export const SE1 = id(84); export const SE2 = id(85);
export const asset = (n: number) => id(100 + n);
export const intent = (n: number) => id(200 + n);
export const job = (n: number) => id(300 + n);
export const item = (n: number) => id(400 + n);
const AT = (day: number, fraction = '') => `2026-03-${String(day + 1).padStart(2, '0')}T08:00:00${fraction}+00:00`;
const stamps = (day = 0) => ({ created_at: AT(day), updated_at: AT(day) });

/** Timestamps relative to now, for what looks at the last seven days. */
const ago = (hours: number) => `${new Date(Date.now() - hours * 3600_000).toISOString().replace('Z', '')}+00:00`;

export function catalog(): Seed {
  const media = (n: number, type: string, extra: Record<string, unknown> = {}) => ({
    id: asset(n), owner_creator_account_id: C1, bucket: type === 'image' ? 'chc-images' : 'chc-music', path: `${type}/${n}`, media_type: type,
    mime_type: type === 'image' ? 'image/webp' : type === 'video' ? 'video/mp4' : 'audio/mp4', duration_ms: type === 'image' ? null : 1000 * n, version: n % 3 + 1,
    processing_status: 'completed', publication_status: 'published', created_by: ALICE, ...stamps(n % 5), ...extra,
  });
  const upload = (n: number, type: string, status: string, extra: Record<string, unknown> = {}) => ({
    id: intent(n), creator_account_id: C1, requested_by: ALICE, bucket: 'chc-submissions', media_type: type, original_filename: `file-${n}.${type === 'image' ? 'png' : type === 'video' ? 'mov' : 'wav'}`,
    content_type: `${type}/x`, content_length: 1000 + n, status, upload_expires_at: AT(9), uploaded_size: status === 'uploaded' ? 1000 + n : null,
    uploaded_at: status === 'uploaded' ? AT(1) : null, ...stamps(1), ...extra,
    path: `submissions/${extra.creator_account_id ?? C1}/${intent(n)}/original.${type === 'image' ? 'png' : type === 'video' ? 'mov' : 'wav'}`,
  });
  const work = (n: number, intentN: number | null, type: string, status: string, day: number, extra: Record<string, unknown> = {}) => ({
    id: job(n), upload_intent_id: intentN == null ? null : intent(intentN), job_type: type, status, input_bucket: 'chc-submissions', input_path: `up/${n}`,
    output_bucket: type === 'image_delivery' ? 'chc-images' : 'chc-music', attempt_count: 1, max_attempts: 3, ...stamps(day), ...extra,
  });
  return [
    ['media.locales', ['en', 'ar', 'fr', 'cop'].map((code, i) => ({ code, english_name: code, native_name: code, text_direction: code === 'ar' ? 'rtl' : 'ltr', sort_order: i, ...stamps() }))],
    ['creator.creator_accounts', [
      { id: C1, display_name: 'Choir Account', status: 'active', created_by: ALICE, ...stamps(0) },
      { id: C2, display_name: 'No Identity', status: 'active', created_by: ALICE, ...stamps(1) },
      { id: C3, display_name: 'Erin Music', status: 'suspended', created_by: ERIN, ...stamps(2) },
    ]],
    ['creator.creator_account_members', [
      { creator_account_id: C1, user_id: ALICE, role: 'owner', ...stamps(0) },
      { creator_account_id: C2, user_id: ALICE, role: 'manager', ...stamps(1) },
      { creator_account_id: C1, user_id: DAVE, role: 'editor', ...stamps(2) },
      { creator_account_id: C1, user_id: VERA, role: 'viewer', ...stamps(3) },
      { creator_account_id: C3, user_id: ERIN, role: 'owner', ...stamps(0) },
    ]],
    ['creator.user_roles', [{ user_id: CAROL, role: 'admin', granted_at: AT(0) }]],
    ['media.media_assets', [
      media(1, 'image', { updated_at: AT(1, '.5') }), media(2, 'image', { updated_at: AT(2, '.499999') }), media(3, 'image', { processing_status: 'processing', publication_status: 'draft' }),
      media(4, 'image'), media(5, 'audio'), media(6, 'audio'), media(7, 'video'), media(8, 'audio', { publication_status: 'draft' }), media(9, 'audio'),
      media(10, 'video', { processing_status: 'completed' }), media(11, 'audio', { processing_status: 'processing' }), media(12, 'image', { owner_creator_account_id: C3 }),
      media(13, 'audio'), media(14, 'image', { media_type: 'image', publication_status: 'draft' }),
    ]],
    ['music.artists', [
      { id: A1, owner_creator_account_id: C1, display_name: 'Choir of Saint Mark', sort_name: 'saint mark', biography: 'A choir', profile_image_asset_id: asset(1), publication_status: 'published', metadata: { pendingProfileImageUploadIntentId: intent(9) }, ...stamps(0) },
      { id: A2, display_name: 'Deacon Mina', publication_status: 'published', profile_image_asset_id: asset(4), ...stamps(1) },
      { id: A3, display_name: "Mo'allem Ibrahim Ayad", publication_status: 'draft', ...stamps(2) },
      { id: A4, owner_creator_account_id: C3, display_name: 'Erin', publication_status: 'draft', ...stamps(3) },
      { id: A5, display_name: 'Cantor Tharwat', publication_status: 'published', profile_image_asset_id: asset(14), ...stamps(4) },
      { id: A6, display_name: 'deacon mina', publication_status: 'draft', ...stamps(5) },
    ]],
    ['music.artist_social_links', [
      { id: id(30), artist_id: A1, platform: 'youtube', url: 'https://youtube.com/@stmark', label: 'YouTube', sort_order: 2, ...stamps() },
      { id: id(31), artist_id: A1, platform: 'website', url: 'https://stmark.example', sort_order: 1, ...stamps() },
      { id: id(32), artist_id: A1, platform: 'instagram', url: 'https://instagram.com/stmark', sort_order: 1, ...stamps() },
    ]],
    ['music.tracks', [
      { id: T1, owner_creator_account_id: C1, title: 'Tenen', duration_ms: 61000, media_asset_id: asset(5), publication_status: 'published', ...stamps(1) },
      { id: T2, owner_creator_account_id: C1, title: 'Ten Thenou', media_asset_id: asset(6), publication_status: 'draft', ...stamps(2) },
      { id: T3, owner_creator_account_id: C1, title: 'Psalm 150', media_asset_id: null, publication_status: 'draft', ...stamps(3) },
      { id: T4, owner_creator_account_id: C1, title: 'Old Hymn', media_asset_id: asset(9), publication_status: 'published', ...stamps(4) },
    ]],
    ['music.track_localizations', [
      { id: id(90), track_id: T1, locale: 'ar', title: 'تينين', ...stamps() },
      { id: id(91), track_id: T1, locale: 'cop', title: 'Ⲧⲉⲛⲉⲛ', ...stamps() },
      { id: id(92), track_id: T1, locale: 'en', title: 'Tenen (en)', ...stamps() },
      { id: id(93), track_id: T2, locale: 'fr', title: 'Nous te', ...stamps() },
    ]],
    ['media.submissions', [
      { id: S1, creator_account_id: C1, submission_type: 'music_release', title: 'Midnight Praises', status: 'approved', submitted_at: AT(2), review_due_at: AT(5), created_by: ALICE, ...stamps(3) },
      { id: S2, creator_account_id: C1, submission_type: 'music_release', title: 'Unlinked', status: 'pending_review', created_by: DAVE, ...stamps(4) },
      { id: S3, creator_account_id: C1, submission_type: 'learning_album', title: 'Kiahk Album', status: 'changes_requested', review_notes: 'Fix the cover', created_by: ALICE, ...stamps(2) },
      { id: S4, creator_account_id: C1, submission_type: 'learning_lesson_set', title: 'Tenen Lessons', status: 'rejected', created_by: ALICE, ...stamps(1) },
      { id: S5, creator_account_id: C3, submission_type: 'music_release', title: 'Erin Single', status: 'draft', created_by: ERIN, ...stamps(0) },
      // A video with no sound: ready when its audio job was skipped for silence (S6), not otherwise (S7).
      { id: S6, creator_account_id: C1, submission_type: 'music_release', title: 'Silent Video', status: 'approved', created_by: ALICE, ...stamps(5) },
      { id: S7, creator_account_id: C1, submission_type: 'music_release', title: 'Waiting Video', status: 'approved', created_by: ALICE, ...stamps(6) },
    ]],
    ['music.releases', [
      { id: R1, owner_creator_account_id: C1, primary_artist_id: A1, cover_asset_id: asset(4), release_type: 'ep', title: 'Midnight Praises', subtitle: 'Live', description: 'Tasbeha',
        metadata: { submissionId: S1, musicType: 'hymns', recordingType: 'live' }, publication_status: 'approved', release_timing_mode: 'scheduled', scheduled_release_at: AT(20, '.25'), ...stamps(3) },
      { id: R2, owner_creator_account_id: C1, primary_artist_id: A1, cover_asset_id: asset(4), release_type: 'single', title: 'Old Hymn', release_date: '2025-12-01', publication_status: 'published', ...stamps(1) },
      { id: R3, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Draft Single', original_release_date: '2020-05-05', metadata: { submissionId: '' }, publication_status: 'draft', ...stamps(5) },
      { id: R4, owner_creator_account_id: C3, primary_artist_id: A4, release_type: 'single', title: 'Erin Single', metadata: { submissionId: S5 }, publication_status: 'draft', ...stamps(2) },
      { id: R5, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Silent Video', metadata: { submissionId: S6 }, publication_status: 'approved', ...stamps(6) },
      { id: R6, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Waiting Video', metadata: { submissionId: S7 }, publication_status: 'approved', ...stamps(7) },
    ]],
    ['music.release_localizations', [
      { id: id(94), release_id: R1, locale: 'ar', title: 'تسبحة نصف الليل', is_primary: false, ...stamps() },
      { id: id(95), release_id: R1, locale: 'en', title: 'Midnight Praises (en)', is_primary: true, ...stamps() },
    ]],
    ['music.release_tracks', [
      { id: id(96), release_id: R1, track_id: T2, disc_number: 1, track_number: 2, created_at: AT(2) },
      { id: id(97), release_id: R1, track_id: T1, disc_number: 1, track_number: 1, created_at: AT(1) },
      { id: id(98), release_id: R1, track_id: T3, disc_number: 2, track_number: 1, created_at: AT(0) },
      { id: id(99), release_id: R2, track_id: T4, disc_number: 1, track_number: 1, created_at: AT(0) },
    ]],
    ['music.track_artists', [
      { track_id: T1, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT(0) },
      { track_id: T1, artist_id: A2, role: 'featured', sort_order: 1, created_at: AT(0) },
      { track_id: T1, artist_id: A3, role: 'composer', sort_order: 1, created_at: AT(0) },
      { track_id: T2, artist_id: A2, role: 'primary', sort_order: 0, created_at: AT(0) },
      { track_id: T2, artist_id: A1, role: 'primary', sort_order: 1, created_at: AT(0) },
      { track_id: T4, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT(0) },
    ]],
    ['music.artist_pinned_releases', [{ artist_id: A1, release_id: R2, sort_order: 1, created_at: AT(0) }, { artist_id: A1, release_id: R1, sort_order: 2, created_at: AT(0) }]],
    ['media.upload_intents', [
      upload(1, 'audio', 'uploaded'), upload(2, 'audio', 'uploaded'), upload(3, 'video', 'uploaded'), upload(4, 'video', 'uploaded'), upload(5, 'image', 'uploaded'),
      upload(6, 'image', 'authorized'), upload(7, 'audio', 'failed', { requested_by: DAVE }), upload(8, 'audio', 'uploaded', { creator_account_id: C3, requested_by: ERIN }),
      upload(9, 'image', 'authorized'),
      // Reusable: uploaded this week, not used by any item.
      upload(10, 'audio', 'uploaded', { uploaded_at: ago(30), original_filename: 'take-2.wav' }),
      upload(11, 'video', 'uploaded', { uploaded_at: ago(40), original_filename: 'clip.mov', original_deleted_at: ago(10) }),
      upload(12, 'video', 'uploaded', { uploaded_at: ago(50), original_filename: 'clip.mov', original_deleted_at: ago(10) }),
      upload(13, 'audio', 'uploaded', { uploaded_at: ago(24 * 8), original_filename: 'old.wav' }),
      upload(14, 'audio', 'uploaded', { uploaded_at: ago(20), original_filename: 'take-2.wav' }),
      upload(15, 'video', 'uploaded'),
      upload(16, 'video', 'uploaded'), upload(17, 'video', 'uploaded'),
      // An audio upload with no audio delivery job: the further along of its other jobs shows.
      upload(18, 'audio', 'uploaded'),
    ]],
    ['media.media_processing_jobs', [
      work(1, 1, 'audio_delivery', 'completed', 1, { media_asset_id: asset(5) }),
      work(2, 2, 'audio_delivery', 'failed', 2, { error_message: 'Decoder error', progress: 0.25 }),
      work(3, 2, 'metadata_probe', 'processing', 3, { progress: 0.5 }),
      work(4, 3, 'video_delivery', 'completed', 1, { media_asset_id: asset(7) }),
      work(5, 3, 'audio_delivery', 'queued', 2),
      work(6, 4, 'video_delivery', 'completed', 1, { media_asset_id: asset(10) }),
      work(7, 4, 'audio_delivery', 'cancelled', 2, { error_message: 'No audio track found' }),
      work(8, 5, 'image_delivery', 'queued', 1, { output_bucket: 'chc-images' }),
      work(9, 5, 'metadata_probe', 'completed', 2),
      work(10, 11, 'video_delivery', 'completed', 1, { media_asset_id: asset(7) }),
      work(11, 12, 'video_delivery', 'failed', 1),
      work(12, 16, 'video_delivery', 'completed', 1, { media_asset_id: asset(10) }),
      work(13, 16, 'audio_delivery', 'cancelled', 2, { error_message: 'No audio track in this file' }),
      work(14, 17, 'video_delivery', 'completed', 1, { media_asset_id: asset(10) }),
      work(15, 17, 'audio_delivery', 'cancelled', 2, { error_message: 'no audio track (lowercase)' }),
      work(16, 18, 'metadata_probe', 'completed', 1),
      work(17, 18, 'video_delivery', 'processing', 2),
    ]],
    ['media.submission_items', [
      { id: item(1), submission_id: S1, role: 'track', title: 'Tenen', sort_order: 1, upload_intent_id: intent(1), media_asset_id: asset(5), media_processing_job_id: job(1), music_track_id: T1, ...stamps(1) },
      { id: item(2), submission_id: S1, role: 'track', title: 'Ten Thenou', sort_order: 2, upload_intent_id: intent(2), media_asset_id: null, media_processing_job_id: job(2), music_track_id: T2, ...stamps(1) },
      { id: item(3), submission_id: S1, role: 'artwork', title: 'Cover', sort_order: 0, upload_intent_id: intent(5), media_asset_id: asset(2), ...stamps(2) },
      { id: item(4), submission_id: S1, role: 'artwork', title: 'New cover', sort_order: 0, upload_intent_id: intent(6), media_asset_id: asset(3), required: false, ...stamps(3) },
      { id: item(5), submission_id: S1, role: 'track', title: 'Tenen v2', sort_order: 1, upload_intent_id: intent(7), replaces_item_id: item(1), music_track_id: T1, required: false, ...stamps(4) },
      { id: item(6), submission_id: S3, role: 'track', title: 'Recording one', sort_order: 1, upload_intent_id: intent(3), media_asset_id: asset(7), localized_titles: { en: ' One ', ar: 'واحد', xx: 'ignored' }, ...stamps(1) },
      { id: item(7), submission_id: S3, role: 'track', title: 'Recording two', sort_order: 1, upload_intent_id: intent(4), media_asset_id: asset(10), localized_titles: { en: 7, fr: null }, ...stamps(2) },
      { id: item(8), submission_id: S3, role: 'artwork', title: 'Album cover', sort_order: 0, media_asset_id: asset(1), ...stamps(1) },
      { id: item(9), submission_id: S4, role: 'lesson', title: 'Lesson one', sort_order: 1, upload_intent_id: null, media_asset_id: asset(13), ...stamps(1) },
      { id: item(10), submission_id: S4, role: 'lesson', title: 'Lesson two', sort_order: 2, upload_intent_id: intent(15), media_asset_id: asset(11), audio_only_asset_id: asset(9), ...stamps(2) },
      { id: item(11), submission_id: S5, role: 'track', title: 'Erin', sort_order: 1, upload_intent_id: intent(8), ...stamps(1) },
      { id: item(12), submission_id: S6, role: 'track', title: 'Silent', sort_order: 1, upload_intent_id: intent(16), media_asset_id: asset(10), ...stamps(1) },
      { id: item(13), submission_id: S7, role: 'track', title: 'Waiting', sort_order: 1, upload_intent_id: intent(17), media_asset_id: asset(10), ...stamps(1) },
      { id: item(14), submission_id: S2, role: 'track', title: 'Probe', sort_order: 1, upload_intent_id: intent(18), ...stamps(1) },
    ]],
    ['learning.cantors', [
      { id: K1, owner_creator_account_id: C1, artist_id: A1, display_name: 'Choir of Saint Mark', publication_status: 'published', metadata: { contributorType: 'Chorus' }, ...stamps() },
      { id: K2, owner_creator_account_id: C3, display_name: 'Erin Cantor', publication_status: 'draft', ...stamps() },
    ]],
    ['learning.seasons', [
      { id: SE1, slug: 'kiahk', title: 'Kiahk', sort_order: 2, publication_status: 'published', ...stamps() },
      { id: SE2, slug: 'lent', title: 'Great Lent', sort_order: 1, publication_status: 'published', ...stamps() },
      { id: id(86), slug: 'draft', title: 'Draft Season', sort_order: 0, publication_status: 'draft', ...stamps() },
    ]],
    ['learning.season_localizations', [{ season_id: SE1, locale: 'ar', title: 'كيهك', ...stamps() }]],
    ['learning.hymns', [
      { id: H1, title: 'Tenen', subtitle: 'Three Saintly Children', publication_status: 'published', ...stamps() },
      { id: H2, title: 'Admin Draft Hymn', publication_status: 'draft', created_by: CAROL, ...stamps() },
      { id: id(87), title: 'Alice Draft Hymn', publication_status: 'draft', created_by: ALICE, ...stamps() },
    ]],
    ['learning.albums', [{ id: AL1, owner_creator_account_id: C1, cantor_id: K1, season_id: SE1, cover_asset_id: asset(4), submission_id: S3, title: 'Kiahk Album', description: 'Praises',
      publication_status: 'draft', release_timing_mode: 'asap', ...stamps() }]],
    ['learning.album_localizations', [{ album_id: AL1, locale: 'fr', title: 'Album de Kiahk', ...stamps() }]],
    ['learning.album_recordings', [{ id: id(88), album_id: AL1, media_asset_id: asset(7), title: 'Recorded One', duration_ms: 4242, publication_status: 'approved', metadata: { submissionItemId: item(6) }, ...stamps() }]],
    ['learning.lesson_sets', [{ id: LS1, owner_creator_account_id: C1, cantor_id: K1, hymn_id: H1, submission_id: S4, title: 'Tenen Lessons', publication_status: 'draft', ...stamps() }]],
    ['learning.lesson_set_localizations', [{ lesson_set_id: LS1, locale: 'ar', title: 'دروس تينين', ...stamps() }]],
    ['learning.lessons', [{ id: id(89), lesson_set_id: LS1, media_asset_id: asset(13), media_type: 'audio', title: 'First lesson', duration_ms: 777, metadata: { submissionItemId: item(9) }, ...stamps() }]],
  ];
}

/** Seeds the catalog into both sides, then gives C1 and C3 their identity artists (the accounts and artists point at each other). */
export async function seedCatalog(oracle: Oracle, worker: WorkerSide): Promise<void> {
  for (const [user, email] of USERS) {
    await oracle.addUser(user, email);
    await worker.addUser(user, email);
  }
  await seed(oracle, worker, catalog());
  await oracle.sql('set session_replication_role = replica');
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" + 1');
  for (const [account, artist] of [[C1, A1], [C3, A4]]) {
    await oracle.sql(`update creator.creator_accounts set identity_artist_id = '${artist}' where id = '${account}'`);
    worker.db.exec(`UPDATE "creator.creator_accounts" SET "identity_artist_id" = '${artist}' WHERE "id" = '${account}'`);
  }
  await oracle.sql('set session_replication_role = origin');
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" - 1');
}
