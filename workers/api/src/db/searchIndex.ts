/**
 * The catalog search index, media.search_documents' 'unified_catalog' rows:
 * private.refresh_unified_search_index and the private.published_media_search_source
 * it reads (schema/pg-user-schema.sql), ported. Supabase rebuilt the whole
 * index after every statement that touched the catalog; here 0009's triggers
 * count those writes in "private.search_index_state", and the Worker rebuilds
 * once the write has committed (src/db/afterWrites.ts).
 *
 * Every published artist, release, track, cantor, season, hymn, album and
 * lesson gives one document per enabled locale it has text in (English from
 * the row itself, the others from its published localizations).
 */
import { compareText } from '../../../content-api/src/pg.ts';
import { col, t } from '../../../content-api/src/db/names.ts';
import { lessonTitle } from '../rpc/learning/shared.ts';
import { normalizeSearchText } from '../rpc/search/text.ts';
import { jsonbText, now } from '../pg.ts';
import type { D1Database } from '../types.ts';

type Row = Record<string, unknown>;
type Document = { owner: unknown; type: string; id: unknown; locale: string; title: unknown; subtitle: unknown; body: unknown; metadata: Row };

const all = async (db: D1Database, sql: string) => (await db.prepare(sql).all<Row>()).results;
const published = (table: [string, string]) => `SELECT * FROM ${t(...table)} WHERE ${col('publication_status')} = 'published'`;

/** concat_ws(' ', …): the values that aren't null, between single spaces. */
const concatWs = (...values: unknown[]) => values.filter((value) => value != null).join(' ');

const asset = (row: Row | undefined, extra: string[] = []): Row | null => (row ? {
  id: row.id, provider: row.provider, bucket: row.bucket, path: row.path, mimeType: row.mime_type,
  ...Object.fromEntries(extra.map((name) => [name, row[name]])),
} : null);

function groupBy(rows: Row[], key: string): Map<unknown, Row[]> {
  const out = new Map<unknown, Row[]>();
  for (const row of rows) out.set(row[key], [...(out.get(row[key]) ?? []), row]);
  return out;
}

export async function searchSource(db: D1Database): Promise<Document[]> {
  const [locales, assetRows, artists, artistL, releases, releaseL, tracks, trackL, trackArtists, releaseTracks, cantors, cantorL, seasons, seasonL, hymns, hymnL, albums, albumL, lessonSets, lessonSetL, lessons, lessonL] = await Promise.all([
    all(db, `SELECT ${col('code')} FROM ${t('media', 'locales')} WHERE ${col('enabled')} = 1`),
    all(db, published(['media', 'media_assets'])),
    all(db, published(['music', 'artists'])),
    all(db, published(['music', 'artist_localizations'])),
    all(db, published(['music', 'releases'])),
    all(db, published(['music', 'release_localizations'])),
    all(db, published(['music', 'tracks'])),
    all(db, published(['music', 'track_localizations'])),
    all(db, `SELECT * FROM ${t('music', 'track_artists')}`),
    all(db, `SELECT * FROM ${t('music', 'release_tracks')}`),
    all(db, published(['learning', 'cantors'])),
    all(db, `SELECT * FROM ${t('learning', 'cantor_localizations')}`),
    all(db, published(['learning', 'seasons'])),
    all(db, `SELECT * FROM ${t('learning', 'season_localizations')}`),
    all(db, published(['learning', 'hymns'])),
    all(db, `SELECT * FROM ${t('learning', 'hymn_localizations')}`),
    all(db, published(['learning', 'albums'])),
    all(db, `SELECT * FROM ${t('learning', 'album_localizations')}`),
    all(db, published(['learning', 'lesson_sets'])),
    all(db, `SELECT * FROM ${t('learning', 'lesson_set_localizations')}`),
    all(db, published(['learning', 'lessons'])),
    all(db, `SELECT * FROM ${t('learning', 'lesson_localizations')}`),
  ]);
  const enabled = new Set(locales.map((row) => row.code));
  const assets = new Map(assetRows.map((row) => [row.id, row]));
  const byId = (rows: Row[]) => new Map(rows.map((row) => [row.id, row]));
  const localizationOf = (rows: Row[], key: string) => {
    const index = new Map(rows.map((row) => [`${row[key]}\u0000${row.locale}`, row]));
    return (id: unknown, locale: string) => index.get(`${id}\u0000${locale}`);
  };

  /** The lateral "distinct on (locale)": English from the row, each localization over it, enabled locales only. */
  function localized<T extends Row>(base: T, localizations: Row[] | undefined, pick: (row: Row) => T): (T & { locale: string })[] {
    const byLocale = new Map<string, T & { locale: string }>();
    byLocale.set('en', { ...base, locale: 'en' });
    for (const row of localizations ?? []) byLocale.set(row.locale as string, { ...pick(row), locale: row.locale as string });
    return [...byLocale.values()].filter((candidate) => enabled.has(candidate.locale));
  }

  const out: Document[] = [];
  const artistById = byId(artists);
  const artistLocal = localizationOf(artistL, 'artist_id');

  for (const artist of artists) {
    for (const l of localized({ title: artist.display_name, body: artist.biography }, groupBy(artistL, 'artist_id').get(artist.id), (row) => ({ title: row.display_name, body: row.biography }))) {
      out.push({ owner: artist.owner_creator_account_id, type: 'music_artist', id: artist.id, locale: l.locale, title: l.title, subtitle: null, body: l.body,
        metadata: { profileImageAsset: asset(assets.get(artist.profile_image_asset_id)) } });
    }
  }

  const releaseLocal = localizationOf(releaseL, 'release_id');
  const releaseLByRelease = groupBy(releaseL, 'release_id');
  for (const release of releases) {
    const artist = artistById.get(release.primary_artist_id);
    for (const l of localized({ title: release.title, subtitle: release.subtitle, body: release.description }, releaseLByRelease.get(release.id),
      (row) => ({ title: row.title, subtitle: row.subtitle, body: row.description }))) {
      const artistName = artist ? (artistLocal(artist.id, l.locale)?.display_name ?? artist.display_name) : null;
      out.push({ owner: release.owner_creator_account_id, type: 'music_release', id: release.id, locale: l.locale, title: l.title, subtitle: l.subtitle,
        body: concatWs(l.body, artistName),
        metadata: {
          releaseType: release.release_type, releaseDate: release.release_date,
          primaryArtist: artist ? { id: artist.id, displayName: artistName } : null,
          coverAsset: asset(assets.get(release.cover_asset_id)),
        } });
    }
  }

  const releaseById = byId(releases);
  const trackArtistsByTrack = groupBy(trackArtists, 'track_id');
  const releaseTracksByTrack = groupBy(releaseTracks, 'track_id');
  for (const track of tracks) {
    const media = assets.get(track.media_asset_id);
    if (!media) continue;
    const credits = (trackArtistsByTrack.get(track.id) ?? []).filter((credit) => artistById.has(credit.artist_id));
    // The newest release it is on (by release date, then disc and track number).
    const context = (releaseTracksByTrack.get(track.id) ?? []).filter((rt) => releaseById.has(rt.release_id)).sort((a, b) => {
      const da = releaseById.get(a.release_id)!.release_date as string | null;
      const db = releaseById.get(b.release_id)!.release_date as string | null;
      return (da == null ? (db == null ? 0 : 1) : db == null ? -1 : da < db ? 1 : da > db ? -1 : 0)
        || (a.disc_number as number) - (b.disc_number as number) || (a.track_number as number) - (b.track_number as number);
    })[0];
    const release = context ? releaseById.get(context.release_id)! : null;
    for (const l of localized({ title: track.title, subtitle: track.subtitle }, groupBy(trackL, 'track_id').get(track.id), (row) => ({ title: row.title, subtitle: row.subtitle }))) {
      const named = credits.map((credit) => {
        const artist = artistById.get(credit.artist_id)!;
        return { credit, artist, name: artistLocal(artist.id, l.locale)?.display_name ?? artist.display_name };
      });
      const bySort = [...named].sort((a, b) => (a.credit.sort_order as number) - (b.credit.sort_order as number));
      const releaseTitle = release ? (releaseLocal(release.id, l.locale)?.title ?? release.title) : null;
      out.push({ owner: track.owner_creator_account_id, type: 'music_track', id: track.id, locale: l.locale, title: l.title, subtitle: l.subtitle,
        body: concatWs(named.length ? bySort.map((n) => n.name).join(' ') : null, releaseTitle),
        metadata: {
          durationMs: track.duration_ms, releaseId: release?.id ?? null, releaseTitle,
          coverAsset: release ? asset(assets.get(release.cover_asset_id)) : null,
          mediaAsset: asset(media),
          artists: [...named].sort((a, b) => (a.credit.sort_order as number) - (b.credit.sort_order as number) || compareText(a.artist.display_name as string, b.artist.display_name as string))
            .map((n) => ({ id: n.artist.id, displayName: n.name, role: n.credit.role, sortOrder: n.credit.sort_order })),
        } });
    }
  }

  const cantorById = byId(cantors);
  const cantorLocal = localizationOf(cantorL, 'cantor_id');
  for (const cantor of cantors) {
    for (const l of localized({ title: cantor.display_name, body: cantor.biography }, groupBy(cantorL, 'cantor_id').get(cantor.id), (row) => ({ title: row.display_name, body: row.biography }))) {
      out.push({ owner: cantor.owner_creator_account_id, type: 'learning_cantor', id: cantor.id, locale: l.locale, title: l.title, subtitle: null, body: l.body,
        metadata: { profileImageAsset: asset(assets.get(cantor.profile_image_asset_id)) } });
    }
  }

  const seasonById = byId(seasons);
  const seasonLocal = localizationOf(seasonL, 'season_id');
  for (const season of seasons) {
    for (const l of localized({ title: season.title, body: season.description }, groupBy(seasonL, 'season_id').get(season.id), (row) => ({ title: row.title, body: row.description }))) {
      out.push({ owner: null, type: 'learning_season', id: season.id, locale: l.locale, title: l.title, subtitle: season.slug, body: l.body,
        metadata: { slug: season.slug, sortOrder: season.sort_order } });
    }
  }

  const hymnById = byId(hymns);
  const hymnLocal = localizationOf(hymnL, 'hymn_id');
  for (const hymn of hymns) {
    for (const l of localized({ title: hymn.title, subtitle: hymn.subtitle, body: hymn.description }, groupBy(hymnL, 'hymn_id').get(hymn.id),
      (row) => ({ title: row.title, subtitle: row.subtitle, body: row.description }))) {
      out.push({ owner: null, type: 'learning_hymn', id: hymn.id, locale: l.locale, title: l.title, subtitle: l.subtitle, body: concatWs(l.body, hymn.source_hymn_key),
        metadata: { sourceHymnKey: hymn.source_hymn_key } });
    }
  }

  for (const album of albums) {
    const cantor = cantorById.get(album.cantor_id);
    if (!cantor) continue;
    const season = seasonById.get(album.season_id);
    for (const l of localized({ title: album.title, body: album.description }, groupBy(albumL, 'album_id').get(album.id), (row) => ({ title: row.title, body: row.description }))) {
      const cantorName = cantorLocal(cantor.id, l.locale)?.display_name ?? cantor.display_name;
      const seasonTitle = season ? (seasonLocal(season.id, l.locale)?.title ?? season.title) : null;
      out.push({ owner: album.owner_creator_account_id, type: 'learning_album', id: album.id, locale: l.locale, title: l.title, subtitle: cantorName,
        body: concatWs(l.body, cantorName, seasonTitle),
        metadata: { cantorId: cantor.id, cantorName, seasonId: season?.id ?? null, coverAsset: asset(assets.get(album.cover_asset_id)) } });
    }
  }

  const setById = byId(lessonSets);
  const setLocal = localizationOf(lessonSetL, 'lesson_set_id');
  // Each published lesson's number: its place among its set's published lessons, by sort order and id.
  const numbers = new Map<unknown, number>();
  for (const group of groupBy(lessons, 'lesson_set_id').values()) {
    [...group].sort((a, b) => (a.sort_order as number) - (b.sort_order as number) || (a.id! < b.id! ? -1 : a.id! > b.id! ? 1 : 0))
      .forEach((lesson, i) => numbers.set(lesson.id, i + 1));
  }
  for (const lesson of lessons) {
    const set = setById.get(lesson.lesson_set_id);
    const cantor = set && cantorById.get(set.cantor_id);
    const hymn = set && hymnById.get(set.hymn_id);
    const media = assets.get(lesson.media_asset_id);
    if (!set || !cantor || !hymn || !media) continue;
    const audio = assets.get(lesson.audio_asset_id);
    const season = seasonById.get(set.season_id);
    for (const l of localized({ localizedTitle: null as unknown, body: lesson.description }, groupBy(lessonL, 'lesson_id').get(lesson.id),
      (row) => ({ localizedTitle: row.title, body: row.description }))) {
      const setLocalization = setLocal(set.id, l.locale);
      const setTitle = setLocalization?.title ?? set.title;
      const cantorName = cantorLocal(cantor.id, l.locale)?.display_name ?? cantor.display_name;
      out.push({ owner: set.owner_creator_account_id, type: 'learning_lesson', id: lesson.id, locale: l.locale,
        title: l.localizedTitle ?? lessonTitle(l.locale, numbers.get(lesson.id)!), subtitle: setTitle,
        body: concatWs(l.body, setTitle, setLocalization?.description ?? set.description, cantorName, hymnLocal(hymn.id, l.locale)?.title ?? hymn.title,
          season ? (seasonLocal(season.id, l.locale)?.title ?? season.title) : null),
        metadata: {
          mediaType: lesson.media_type, durationMs: lesson.duration_ms ?? audio?.duration_ms ?? media.duration_ms ?? null,
          mediaAsset: asset(media, ['width', 'height']), audioAsset: asset(audio),
          lessonSetId: set.id, lessonSetTitle: setTitle, cantorId: cantor.id, cantorName, hymnId: hymn.id,
          coverAsset: asset(assets.get(set.cover_asset_id)),
        } });
    }
  }
  return out;
}

const COLUMNS = ['id', 'owner_creator_account_id', 'entity_type', 'entity_id', 'locale', 'kind', 'title', 'subtitle', 'body', 'alias_text', 'normalized_text', 'publication_status', 'metadata', 'created_at', 'updated_at'];

/** The rows refresh_unified_search_index inserts, for these documents. */
export function documentRows(documents: Document[], at = now()): unknown[][] {
  return documents.map((d) => [
    crypto.randomUUID(), d.owner, d.type, d.id, d.locale, 'unified_catalog', d.title, d.subtitle, d.body, null,
    normalizeSearchText(concatWs(d.title, d.subtitle, d.body)), 'published', jsonbText(d.metadata), at, at,
  ]);
}

/**
 * Replaces the index with what the catalog gives now, in one batch, and
 * records the catalog version it was built from (read before the catalog, so
 * a write that lands in between leaves the index marked stale).
 */
export async function rebuildSearchIndex(db: D1Database): Promise<number> {
  const state = await db.prepare(`SELECT ${col('version')} FROM ${t('private', 'search_index_state')} WHERE ${col('id')} = 1`).first<{ version: number }>();
  const rows = documentRows(await searchSource(db));
  const perStatement = Math.floor(100 / COLUMNS.length); // D1 binds at most 100 values a statement
  const statements = [db.prepare(`DELETE FROM ${t('media', 'search_documents')} WHERE ${col('kind')} = 'unified_catalog'`)];
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    statements.push(db.prepare(`INSERT INTO ${t('media', 'search_documents')} (${COLUMNS.map(col).join(', ')}) VALUES ${chunk.map(() => `(${COLUMNS.map(() => '?').join(', ')})`).join(', ')}`)
      .bind(...chunk.flat()));
  }
  statements.push(db.prepare(`UPDATE ${t('private', 'search_index_state')} SET ${col('built_version')} = max(${col('built_version')}, ?) WHERE ${col('id')} = 1`).bind(state?.version ?? 0));
  await db.batch(statements);
  return rows.length;
}
