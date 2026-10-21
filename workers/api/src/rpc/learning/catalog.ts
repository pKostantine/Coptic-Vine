/**
 * The published learning catalog: ports of public.get_learning_home,
 * get_published_learning_cantor, get_published_learning_season,
 * get_published_learning_hymn, get_published_learning_album,
 * get_published_learning_lesson_set and get_published_learning_item_lyrics
 * (schema/pg-user-schema.sql), checked by tests/learning.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import type { ApiContext } from '../../rest/context.ts';
import {
  all, assetObject, COVER, displayDate, first, IN_LIST, learningAsset, lessonTitle, loadAssets, loadLocalizations, localized, order, payload, type Row,
} from './shared.ts';

const published = (table: string, alias: string) => `${alias}.${col('publication_status')} = 'published'`;

export async function getLearningHome(ctx: ApiContext, locale: string | null): Promise<unknown> {
  const cantors = await all(ctx, `SELECT * FROM ${t('learning', 'cantors')} c WHERE ${published('cantors', 'c')}`);
  const seasons = await all(ctx, `SELECT * FROM ${t('learning', 'seasons')} s WHERE ${published('seasons', 's')}`);
  const [cantorL, seasonL, images] = await Promise.all([
    loadLocalizations(ctx, 'cantor_localizations', 'cantor_id', cantors.map((c) => c.id), locale),
    loadLocalizations(ctx, 'season_localizations', 'season_id', seasons.map((s) => s.id), locale),
    loadAssets(ctx, cantors.map((c) => c.profile_image_asset_id)),
  ]);
  const cantorKey = (c: Row) => c.sort_name ?? cantorL.get(c.id as string)?.display_name ?? c.display_name;
  const seasonTitle = (s: Row) => localized(seasonL.get(s.id as string), s, 'title');
  return payload({
    cantors: [...cantors].sort((a, b) => order.text(cantorKey(a), cantorKey(b))).map((c) => {
      const l = cantorL.get(c.id as string);
      return { id: c.id, displayName: localized(l, c, 'display_name'), biography: localized(l, c, 'biography'), profileImageAsset: assetObject(images.get(c.profile_image_asset_id as string), COVER) };
    }),
    seasons: [...seasons].sort((a, b) => order.number(a.sort_order, b.sort_order) || order.text(seasonTitle(a), seasonTitle(b))).map((s) => ({
      id: s.id, slug: s.slug, title: seasonTitle(s), description: localized(seasonL.get(s.id as string), s, 'description'), sortOrder: s.sort_order,
    })),
  });
}

export async function getPublishedLearningCantor(ctx: ApiContext, cantorId: string, locale: string | null): Promise<unknown> {
  const cantor = await first(ctx, `SELECT * FROM ${t('learning', 'cantors')} c WHERE c.${col('id')} = ? AND ${published('cantors', 'c')}`, cantorId);
  if (!cantor) return null;
  const albums = await all(ctx, `SELECT * FROM ${t('learning', 'albums')} a WHERE a.${col('cantor_id')} = ? AND ${published('albums', 'a')}`, cantorId);
  const sets = await all(ctx, `SELECT * FROM ${t('learning', 'lesson_sets')} ls WHERE ls.${col('cantor_id')} = ? AND ${published('lesson_sets', 'ls')}`, cantorId);
  const [cantorL, albumL, setL, assets] = await Promise.all([
    loadLocalizations(ctx, 'cantor_localizations', 'cantor_id', [cantorId], locale),
    loadLocalizations(ctx, 'album_localizations', 'album_id', albums.map((a) => a.id), locale),
    loadLocalizations(ctx, 'lesson_set_localizations', 'lesson_set_id', sets.map((s) => s.id), locale),
    loadAssets(ctx, [cantor.profile_image_asset_id, ...albums.map((a) => a.cover_asset_id)]),
  ]);
  const l = cantorL.get(cantorId);
  return payload({
    id: cantor.id, displayName: localized(l, cantor, 'display_name'), biography: localized(l, cantor, 'biography'),
    profileImageAsset: assetObject(assets.get(cantor.profile_image_asset_id as string), COVER),
    albums: albums.sort((a, b) => order.descNullsLast(a.created_at, b.created_at)).map((a) => {
      const al = albumL.get(a.id as string);
      return { id: a.id, title: localized(al, a, 'title'), description: localized(al, a, 'description'), seasonId: a.season_id, coverAsset: assetObject(assets.get(a.cover_asset_id as string), COVER) };
    }),
    lessonSets: sets.sort((a, b) => order.descNullsLast(a.created_at, b.created_at)).map((s) => {
      const sl = setL.get(s.id as string);
      return { id: s.id, title: localized(sl, s, 'title'), description: localized(sl, s, 'description'), seasonId: s.season_id, hymnId: s.hymn_id };
    }),
  });
}

/** Published albums or lesson sets with their published cantor, for the season view. */
async function collectionsWithCantor(ctx: ApiContext, table: 'albums' | 'lesson_sets', seasonId: string): Promise<Row[]> {
  return all(ctx, `SELECT x.*, c.${col('id')} AS cantor_row_id, c.${col('display_name')} AS cantor_display_name FROM ${t('learning', table)} x
    JOIN ${t('learning', 'cantors')} c ON c.${col('id')} = x.${col('cantor_id')} AND c.${col('publication_status')} = 'published'
    WHERE x.${col('season_id')} = ? AND x.${col('publication_status')} = 'published'`, seasonId);
}

export async function getPublishedLearningSeason(ctx: ApiContext, seasonId: string, locale: string | null): Promise<unknown> {
  const season = await first(ctx, `SELECT * FROM ${t('learning', 'seasons')} s WHERE s.${col('id')} = ? AND ${published('seasons', 's')}`, seasonId);
  if (!season) return null;
  const hymns = await all(ctx, `SELECT hs.${col('sort_order')} AS link_order, h.* FROM ${t('learning', 'hymn_seasons')} hs
    JOIN ${t('learning', 'hymns')} h ON h.${col('id')} = hs.${col('hymn_id')} AND h.${col('publication_status')} = 'published'
    WHERE hs.${col('season_id')} = ?`, seasonId);
  const albums = await collectionsWithCantor(ctx, 'albums', seasonId);
  const sets = await collectionsWithCantor(ctx, 'lesson_sets', seasonId);
  const [seasonL, hymnL, albumL, setL, cantorL, covers] = await Promise.all([
    loadLocalizations(ctx, 'season_localizations', 'season_id', [seasonId], locale),
    loadLocalizations(ctx, 'hymn_localizations', 'hymn_id', hymns.map((h) => h.id), locale),
    loadLocalizations(ctx, 'album_localizations', 'album_id', albums.map((a) => a.id), locale),
    loadLocalizations(ctx, 'lesson_set_localizations', 'lesson_set_id', sets.map((s) => s.id), locale),
    loadLocalizations(ctx, 'cantor_localizations', 'cantor_id', [...albums, ...sets].map((x) => x.cantor_row_id), locale),
    loadAssets(ctx, [...albums, ...sets].map((x) => x.cover_asset_id)),
  ]);
  const hymnTitle = (h: Row) => localized(hymnL.get(h.id as string), h, 'title');
  const collection = (x: Row, l: Row | undefined) => ({
    id: x.id, title: localized(l, x, 'title'), description: localized(l, x, 'description'), cantorId: x.cantor_row_id,
    cantorName: cantorL.get(x.cantor_row_id as string)?.display_name ?? x.cantor_display_name,
  });
  const sl = seasonL.get(seasonId);
  return payload({
    id: season.id, slug: season.slug, title: localized(sl, season, 'title'), description: localized(sl, season, 'description'),
    hymns: hymns.sort((a, b) => order.number(a.link_order, b.link_order) || order.text(hymnTitle(a), hymnTitle(b))).map((h) => {
      const hl = hymnL.get(h.id as string);
      return { id: h.id, sourceHymnKey: h.source_hymn_key, title: hymnTitle(h), subtitle: localized(hl, h, 'subtitle'), sortOrder: h.link_order };
    }),
    albums: albums.sort((a, b) => order.descNullsLast(a.created_at, b.created_at)).map((a) => ({
      ...collection(a, albumL.get(a.id as string)), coverAsset: assetObject(covers.get(a.cover_asset_id as string), COVER),
    })),
    lessonSets: sets.sort((a, b) => order.descNullsLast(a.created_at, b.created_at)).map((s) => ({
      ...collection(s, setL.get(s.id as string)), hymnId: s.hymn_id, coverAsset: assetObject(covers.get(s.cover_asset_id as string), COVER),
    })),
  });
}

export async function getPublishedLearningHymn(ctx: ApiContext, hymnId: string, locale: string | null): Promise<unknown> {
  const hymn = await first(ctx, `SELECT * FROM ${t('learning', 'hymns')} h WHERE h.${col('id')} = ? AND ${published('hymns', 'h')}`, hymnId);
  if (!hymn) return null;
  const seasons = await all(ctx, `SELECT hs.${col('sort_order')} AS link_order, s.* FROM ${t('learning', 'hymn_seasons')} hs
    JOIN ${t('learning', 'seasons')} s ON s.${col('id')} = hs.${col('season_id')} AND s.${col('publication_status')} = 'published' WHERE hs.${col('hymn_id')} = ?`, hymnId);
  const related = await all(ctx, `SELECT rel.${col('relationship_type')} AS relationship_type, rel.${col('sort_order')} AS link_order, rh.* FROM ${t('learning', 'hymn_relationships')} rel
    JOIN ${t('learning', 'hymns')} rh ON rh.${col('id')} = rel.${col('related_hymn_id')} AND rh.${col('publication_status')} = 'published' WHERE rel.${col('hymn_id')} = ?`, hymnId);
  const sets = await all(ctx, `SELECT * FROM ${t('learning', 'lesson_sets')} ls WHERE ls.${col('hymn_id')} = ? AND ${published('lesson_sets', 'ls')}`, hymnId);
  const [hymnL, seasonL, relatedL, setL] = await Promise.all([
    loadLocalizations(ctx, 'hymn_localizations', 'hymn_id', [hymnId], locale),
    loadLocalizations(ctx, 'season_localizations', 'season_id', seasons.map((s) => s.id), locale),
    loadLocalizations(ctx, 'hymn_localizations', 'hymn_id', related.map((h) => h.id), locale),
    loadLocalizations(ctx, 'lesson_set_localizations', 'lesson_set_id', sets.map((s) => s.id), locale),
  ]);
  const hl = hymnL.get(hymnId);
  return payload({
    id: hymn.id, sourceHymnKey: hymn.source_hymn_key, title: localized(hl, hymn, 'title'), subtitle: localized(hl, hymn, 'subtitle'), description: localized(hl, hymn, 'description'),
    seasons: seasons.sort((a, b) => order.number(a.link_order, b.link_order)).map((s) => ({ id: s.id, slug: s.slug, title: localized(seasonL.get(s.id as string), s, 'title'), sortOrder: s.link_order })),
    relatedHymns: related.sort((a, b) => order.number(a.link_order, b.link_order)).map((h) => ({
      id: h.id, sourceHymnKey: h.source_hymn_key, title: localized(relatedL.get(h.id as string), h, 'title'), relationshipType: h.relationship_type,
    })),
    lessonSets: sets.sort((a, b) => order.descNullsLast(a.created_at, b.created_at)).map((s) => ({ id: s.id, title: localized(setL.get(s.id as string), s, 'title'), cantorId: s.cantor_id, seasonId: s.season_id })),
  });
}

/** A published album or lesson set's cantor and (published) season, for the album and lesson set views. */
async function header(ctx: ApiContext, row: Row, locale: string | null): Promise<{ cantor: Row; season: Row | null } | null> {
  const cantor = await first(ctx, `SELECT * FROM ${t('learning', 'cantors')} c WHERE c.${col('id')} = ? AND ${published('cantors', 'c')}`, row.cantor_id);
  if (!cantor) return null;
  const season = row.season_id ? await first(ctx, `SELECT * FROM ${t('learning', 'seasons')} s WHERE s.${col('id')} = ? AND ${published('seasons', 's')}`, row.season_id) : null;
  const [cantorL, seasonL] = await Promise.all([
    loadLocalizations(ctx, 'cantor_localizations', 'cantor_id', [cantor.id], locale),
    loadLocalizations(ctx, 'season_localizations', 'season_id', [season?.id], locale),
  ]);
  return {
    cantor: { id: cantor.id, displayName: localized(cantorL.get(cantor.id as string), cantor, 'display_name') },
    season: season ? { id: season.id, slug: season.slug, title: localized(seasonL.get(season.id as string), season, 'title') } : null,
  };
}

export async function getPublishedLearningAlbum(ctx: ApiContext, albumId: string, locale: string | null): Promise<unknown> {
  const album = await first(ctx, `SELECT * FROM ${t('learning', 'albums')} a WHERE a.${col('id')} = ? AND ${published('albums', 'a')}`, albumId);
  if (!album) return null;
  const top = await header(ctx, album, locale);
  if (!top) return null;
  const recordings = await all(ctx, `SELECT r.* FROM ${t('learning', 'album_recordings')} r
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = r.${col('media_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE r.${col('album_id')} = ? AND r.${col('publication_status')} = 'published'`, albumId);
  const [albumL, recordingL, assets] = await Promise.all([
    loadLocalizations(ctx, 'album_localizations', 'album_id', [albumId], locale),
    loadLocalizations(ctx, 'recording_localizations', 'recording_id', recordings.map((r) => r.id), locale),
    loadAssets(ctx, [album.cover_asset_id, ...recordings.map((r) => r.media_asset_id)]),
  ]);
  const al = albumL.get(albumId);
  return payload({
    id: album.id, title: localized(al, album, 'title'), description: localized(al, album, 'description'),
    releaseTimingMode: album.release_timing_mode, scheduledReleaseAt: album.scheduled_release_at, originalReleaseDate: album.original_release_date,
    displayDate: displayDate(album), cantor: top.cantor, season: top.season, coverAsset: assetObject(assets.get(album.cover_asset_id as string), COVER),
    recordings: recordings.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.id, b.id)).map((r) => {
      const rl = recordingL.get(r.id as string);
      const asset = assets.get(r.media_asset_id as string);
      return {
        id: r.id, title: localized(rl, r, 'title'), subtitle: localized(rl, r, 'subtitle'), durationMs: r.duration_ms ?? asset?.duration_ms ?? null,
        sortOrder: r.sort_order, hymnId: r.hymn_id, mediaAsset: assetObject(asset, ['id', 'provider', 'bucket', 'path', 'mimeType', 'durationMs', 'fileSizeBytes', 'checksum']),
      };
    }),
  });
}

export async function getPublishedLearningLessonSet(ctx: ApiContext, setId: string, locale: string | null): Promise<unknown> {
  const set = await first(ctx, `SELECT * FROM ${t('learning', 'lesson_sets')} ls WHERE ls.${col('id')} = ? AND ${published('lesson_sets', 'ls')}`, setId);
  if (!set) return null;
  const hymn = await first(ctx, `SELECT * FROM ${t('learning', 'hymns')} h WHERE h.${col('id')} = ? AND ${published('hymns', 'h')}`, set.hymn_id);
  const top = hymn ? await header(ctx, set, locale) : null;
  if (!hymn || !top) return null;
  // The lessons with published media; their numbers count these, in sort order then id.
  const lessons = await all(ctx, `SELECT l.* FROM ${t('learning', 'lessons')} l
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = l.${col('media_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE l.${col('lesson_set_id')} = ? AND l.${col('publication_status')} = 'published'`, setId);
  lessons.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.id, b.id));
  const [setL, hymnL, lessonL, assets] = await Promise.all([
    loadLocalizations(ctx, 'lesson_set_localizations', 'lesson_set_id', [setId], locale),
    loadLocalizations(ctx, 'hymn_localizations', 'hymn_id', [hymn.id], locale),
    loadLocalizations(ctx, 'lesson_localizations', 'lesson_id', lessons.map((l) => l.id), locale),
    loadAssets(ctx, [set.cover_asset_id, ...lessons.flatMap((l) => [l.media_asset_id, l.audio_asset_id])]),
  ]);
  const sl = setL.get(setId);
  const hl = hymnL.get(hymn.id as string);
  return payload({
    id: set.id, title: localized(sl, set, 'title'), description: localized(sl, set, 'description'),
    releaseTimingMode: set.release_timing_mode, scheduledReleaseAt: set.scheduled_release_at, originalReleaseDate: set.original_release_date,
    displayDate: displayDate(set), cantor: top.cantor, season: top.season,
    hymn: { id: hymn.id, sourceHymnKey: hymn.source_hymn_key, title: localized(hl, hymn, 'title'), subtitle: localized(hl, hymn, 'subtitle') },
    coverAsset: assetObject(assets.get(set.cover_asset_id as string), COVER),
    lessons: lessons.map((lesson, index) => {
      const ll = lessonL.get(lesson.id as string);
      const media = assets.get(lesson.media_asset_id as string);
      const audio = assets.get(lesson.audio_asset_id as string);
      return {
        id: lesson.id, mediaType: lesson.media_type, title: ll?.title ?? lessonTitle(locale, index + 1), description: localized(ll, lesson, 'description'),
        durationMs: lesson.duration_ms ?? audio?.duration_ms ?? media?.duration_ms ?? null, sortOrder: lesson.sort_order,
        mediaAsset: learningAsset(media), audioAsset: learningAsset(audio),
      };
    }),
  });
}

export async function getPublishedLearningItemLyrics(ctx: ApiContext, kind: string, itemId: string, locale: string | null): Promise<unknown> {
  const visible = kind === 'album_recording'
    ? await first(ctx, `SELECT 1 AS yes FROM ${t('learning', 'album_recordings')} r JOIN ${t('learning', 'albums')} a ON a.${col('id')} = r.${col('album_id')}
        WHERE r.${col('id')} = ? AND r.${col('publication_status')} = 'published' AND a.${col('publication_status')} = 'published'`, itemId)
    : await first(ctx, `SELECT 1 AS yes FROM ${t('learning', 'lessons')} l JOIN ${t('learning', 'lesson_sets')} s ON s.${col('id')} = l.${col('lesson_set_id')}
        WHERE l.${col('id')} = ? AND l.${col('publication_status')} = 'published' AND s.${col('publication_status')} = 'published'`, itemId);
  let lyricSets: Row[] = [];
  if (visible) {
    const sets = await all(ctx, `SELECT * FROM ${t('learning', 'lyric_sets')} WHERE ${col('item_kind')} = ? AND coalesce(${col('album_recording_id')}, ${col('lesson_id')}) = ?
      AND ${col('publication_status')} = 'published' AND (? IS NULL OR ${col('locale')} = ?)`, kind, itemId, locale, locale);
    const lines = sets.length ? await all(ctx, `SELECT * FROM ${t('learning', 'lyric_lines')} WHERE ${col('lyric_set_id')} IN ${IN_LIST} ORDER BY ${col('sequence')}`, JSON.stringify(sets.map((s) => s.id))) : [];
    lyricSets = sets.sort((a, b) => order.text(a.locale, b.locale)).map((s) => ({
      id: s.id, itemKind: s.item_kind, itemId: s.album_recording_id ?? s.lesson_id, locale: s.locale, kind: 'original', syncPrecision: s.sync_precision,
      description: s.description, publicationStatus: s.publication_status,
      lines: lines.filter((line) => line.lyric_set_id === s.id).map((line) => ({ id: line.id, sequence: line.sequence, startMs: line.start_ms, endMs: line.end_ms, text: line.text, words: [] })),
    }));
  }
  return payload({ itemKind: kind, itemId, lyricSets });
}
