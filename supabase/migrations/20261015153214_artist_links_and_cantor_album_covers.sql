-- An artist's links ride in the artist's own payload, as the app's artist page
-- reads them. The app used to fetch music.artist_social_links straight from the
-- REST API, but the music schema is not exposed there, so no link ever showed.
-- The table's public-read policy (published artists only) still decides what a
-- caller sees: the function runs with the caller's rights.
-- (Superseded for the links by 20261015153253: that policy also calls
-- private functions anon may not execute.)
create or replace function public.get_published_music_artist(p_artist_id uuid, p_locale text default 'en'::text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', artist.id,
    'displayName', coalesce(artist_localization.display_name, artist.display_name),
    'biography', coalesce(artist_localization.biography, artist.biography),
    'profileImageAsset', case
      when image.id is null then null
      else jsonb_build_object(
        'id', image.id,
        'provider', image.provider,
        'bucket', image.bucket,
        'path', image.path,
        'mimeType', image.mime_type
      )
    end,
    'socialLinks', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', link.id, 'platform', link.platform, 'label', link.label, 'url', link.url)
        order by link.sort_order, link.created_at
      )
      from music.artist_social_links link
      where link.artist_id = artist.id
    ), '[]'::jsonb),
    'releases', coalesce((
      select jsonb_agg(release_row.payload order by release_row.release_date desc nulls last, release_row.title)
      from (
        select
          release.release_date,
          coalesce(release_localization.title, release.title) as title,
          jsonb_build_object(
            'id', release.id,
            'title', coalesce(release_localization.title, release.title),
            'subtitle', coalesce(release_localization.subtitle, release.subtitle),
            'releaseType', release.release_type,
            'releaseDate', music.release_display_date(release.original_release_date, release.scheduled_release_at, release.release_date),
            'coverAsset', case
              when cover.id is null then null
              else jsonb_build_object(
                'id', cover.id,
                'provider', cover.provider,
                'bucket', cover.bucket,
                'path', cover.path,
                'mimeType', cover.mime_type
              )
            end
          ) as payload
        from music.releases release
        left join music.release_localizations release_localization
          on release_localization.release_id = release.id
         and release_localization.locale = p_locale
         and release_localization.publication_status = 'published'::media.publication_status
        left join media.media_assets cover
          on cover.id = release.cover_asset_id
         and cover.publication_status = 'published'::media.publication_status
        where release.primary_artist_id = artist.id
          and release.publication_status = 'published'::media.publication_status
      ) release_row
    ), '[]'::jsonb)
  )
  from music.artists artist
  left join music.artist_localizations artist_localization
    on artist_localization.artist_id = artist.id
   and artist_localization.locale = p_locale
   and artist_localization.publication_status = 'published'::media.publication_status
  left join media.media_assets image
    on image.id = artist.profile_image_asset_id
   and image.publication_status = 'published'::media.publication_status
  where artist.id = p_artist_id
    and artist.publication_status = 'published'::media.publication_status;
$function$;

-- A cantor's albums carry their covers, so the cantor page can show them
-- without loading every album in turn.
create or replace function public.get_published_learning_cantor(p_cantor_id uuid, p_locale text default 'en'::text)
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'id', c.id,
    'displayName', coalesce(cl.display_name, c.display_name),
    'biography', coalesce(cl.biography, c.biography),
    'profileImageAsset', case when image.id is null then null else jsonb_build_object('id', image.id, 'provider', image.provider, 'bucket', image.bucket, 'path', image.path, 'mimeType', image.mime_type, 'fileSizeBytes', image.file_size_bytes, 'checksum', image.checksum) end,
    'albums', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'title', coalesce(al.title, a.title),
        'description', coalesce(al.description, a.description),
        'seasonId', a.season_id,
        'coverAsset', case when cover.id is null then null else jsonb_build_object('id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket, 'path', cover.path, 'mimeType', cover.mime_type, 'fileSizeBytes', cover.file_size_bytes, 'checksum', cover.checksum) end
      ) order by a.created_at desc)
      from learning.albums a
      left join learning.album_localizations al on al.album_id = a.id and al.locale = p_locale
      left join media.media_assets cover on cover.id = a.cover_asset_id and cover.publication_status = 'published'
      where a.cantor_id = c.id and a.publication_status = 'published'
    ), '[]'::jsonb),
    'lessonSets', coalesce((
      select jsonb_agg(jsonb_build_object('id', ls.id, 'title', coalesce(lsl.title, ls.title), 'description', coalesce(lsl.description, ls.description), 'seasonId', ls.season_id, 'hymnId', ls.hymn_id) order by ls.created_at desc)
      from learning.lesson_sets ls
      left join learning.lesson_set_localizations lsl on lsl.lesson_set_id = ls.id and lsl.locale = p_locale
      where ls.cantor_id = c.id and ls.publication_status = 'published'
    ), '[]'::jsonb)
  )
  from learning.cantors c
  left join learning.cantor_localizations cl on cl.cantor_id = c.id and cl.locale = p_locale
  left join media.media_assets image on image.id = c.profile_image_asset_id and image.publication_status = 'published'
  where c.id = p_cantor_id and c.publication_status = 'published';
$function$;
