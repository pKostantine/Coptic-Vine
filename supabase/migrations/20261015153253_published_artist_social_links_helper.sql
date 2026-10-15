-- music.artist_social_links' read policy also asks private.is_admin() and
-- private.can_edit_creator_account(), which anon may not execute, so reading
-- the table as anon fails outright -- and with it the artist payload that
-- reads it. The public part of that policy (any published artist's links) is
-- served here instead, with the definer's rights and nothing more.
create or replace function music.published_artist_social_links(p_artist_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', link.id, 'platform', link.platform, 'label', link.label, 'url', link.url)
      order by link.sort_order, link.created_at
    ),
    '[]'::jsonb
  )
  from music.artist_social_links link
  join music.artists artist
    on artist.id = link.artist_id
   and artist.publication_status = 'published'::media.publication_status
  where link.artist_id = p_artist_id;
$function$;

revoke all on function music.published_artist_social_links(uuid) from public;
grant execute on function music.published_artist_social_links(uuid) to anon, authenticated;

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
    'socialLinks', music.published_artist_social_links(artist.id),
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
