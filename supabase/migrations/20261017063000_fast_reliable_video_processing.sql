-- Fast, reliable lesson videos.
--
-- * One conversion pass makes both a video's delivery MP4 and its audio-only
--   M4A: the audio job is claimed alongside its video job (a "companion")
--   instead of reading the whole original a second time on its own.
-- * A working media worker proves it is alive with a heartbeat. A job whose
--   worker died is retried within minutes rather than hours, and one that dies
--   on its final attempt is failed, visibly, instead of staying `processing`
--   forever (which left its submission unfinished with no error shown).
-- * Once a video's MP4 and audio-only copy both exist, its original upload is
--   removed: `claim_media_original_deletion` marks it, the worker deletes the
--   object, and storage GC no longer counts it as referenced.
-- * Admin and creator views show one entry per video (the audio-only copy
--   rides along with its video) and how far processing has got.
-- * Upload authorizations last 24 hours so very large uploads can resume.

alter table media.media_processing_jobs
  add column if not exists heartbeat_at timestamptz,
  add column if not exists progress real;

alter table media.upload_intents
  add column if not exists original_deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Staleness: a job is stale when its worker stopped proving it is alive.
-- Workers that heartbeat do so every 20 seconds; five minutes of silence means
-- the process is gone. Jobs from workers that never heartbeat keep the old,
-- type-based timeouts.
-- ---------------------------------------------------------------------------
create or replace function private.media_processing_job_is_stale(
  p_job_type media.processing_job_type,
  p_claimed_at timestamptz,
  p_heartbeat_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select p_claimed_at is not null and case
    when p_heartbeat_at is not null then p_heartbeat_at < now() - interval '5 minutes'
    when p_job_type = 'video_delivery'::media.processing_job_type then p_claimed_at < now() - interval '2 hours'
    else p_claimed_at < now() - interval '15 minutes'
  end;
$function$;

revoke all on function private.media_processing_job_is_stale(media.processing_job_type, timestamptz, timestamptz) from public;

-- An audio-only job that was skipped because its video has no sound at all.
create or replace function private.media_job_skipped_for_silence(p_status media.processing_job_status, p_error text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select p_status = 'cancelled'::media.processing_job_status and coalesce(p_error, '') like 'No audio track%';
$function$;

revoke all on function private.media_job_skipped_for_silence(media.processing_job_status, text) from public;

-- ---------------------------------------------------------------------------
-- Claiming
-- ---------------------------------------------------------------------------
create or replace function public.claim_media_processing_job(p_worker_token text, p_worker_id text default null)
returns table(
  job_id uuid,
  upload_intent_id uuid,
  job_type media.processing_job_type,
  media_type media.media_type,
  source_content_type text,
  attempt_count integer,
  max_attempts integer,
  input_bucket text,
  input_path text,
  output_bucket text,
  output_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  selected_job_id uuid;
  dead_job record;
  affected_submission_id uuid;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  -- A worker that stopped mid-job (crash, out of memory, redeploy) leaves its
  -- job `processing`. Requeue it while it has attempts left...
  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      available_at = now(),
      error_message = 'Recovered after media worker stopped before completing the job',
      updated_at = now()
  where job.status = 'processing'::media.processing_job_status
    and job.attempt_count < job.max_attempts
    and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at);

  -- ...and fail it, visibly, when that was its last attempt.
  for dead_job in
    update media.media_processing_jobs job
    set status = 'failed'::media.processing_job_status,
        worker_id = null,
        heartbeat_at = null,
        finished_at = now(),
        error_message = 'The media worker stopped during the final processing attempt',
        updated_at = now()
    where job.status = 'processing'::media.processing_job_status
      and job.attempt_count >= job.max_attempts
      and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
    returning job.id, job.upload_intent_id, job.job_type, job.attempt_count, job.max_attempts, job.error_message
  loop
    for affected_submission_id in
      select distinct item.submission_id
      from media.submission_items item
      where item.upload_intent_id = dead_job.upload_intent_id
    loop
      perform private.add_media_submission_event(
        affected_submission_id,
        null,
        'processing_failed',
        null,
        null,
        dead_job.error_message,
        jsonb_build_object(
          'processingJobId', dead_job.id,
          'jobType', dead_job.job_type,
          'uploadIntentId', dead_job.upload_intent_id,
          'attemptCount', dead_job.attempt_count,
          'maxAttempts', dead_job.max_attempts
        )
      );
    end loop;
  end loop;

  select job.id
  into selected_job_id
  from media.media_processing_jobs job
  where job.status = 'queued'::media.processing_job_status
    and job.available_at <= now()
    and job.attempt_count < job.max_attempts
    -- A video's audio-only copy is made in the same pass as the video. Claim
    -- it on its own only once its video job has finished one way or another.
    and not (
      job.job_type = 'audio_delivery'::media.processing_job_type
      and exists (
        select 1
        from media.media_processing_jobs video
        where video.upload_intent_id = job.upload_intent_id
          and video.job_type = 'video_delivery'::media.processing_job_type
          and video.status in ('queued'::media.processing_job_status, 'processing'::media.processing_job_status)
      )
    )
  order by job.available_at, job.created_at
  for update skip locked
  limit 1;

  if selected_job_id is null then
    return;
  end if;

  update media.media_processing_jobs job
  set status = 'processing'::media.processing_job_status,
      attempt_count = job.attempt_count + 1,
      worker_id = nullif(trim(coalesce(p_worker_id, '')), ''),
      claimed_at = now(),
      heartbeat_at = null,
      progress = 0,
      started_at = coalesce(job.started_at, now()),
      error_message = null
  where job.id = selected_job_id
  returning
    job.id,
    job.upload_intent_id,
    job.job_type,
    job.attempt_count,
    job.max_attempts,
    job.input_bucket,
    job.input_path,
    job.output_bucket,
    job.output_path
  into
    job_id,
    upload_intent_id,
    job_type,
    attempt_count,
    max_attempts,
    input_bucket,
    input_path,
    output_bucket,
    output_path;

  select intent.media_type, intent.content_type
  into media_type, source_content_type
  from media.upload_intents intent
  where intent.id = upload_intent_id;

  return next;
end;
$function$;

-- Claims the audio-only job that belongs with a claimed video job, creating it
-- when the video has none yet (every video item needs one to be ready).
create or replace function public.claim_companion_media_processing_job(
  p_worker_token text,
  p_job_id uuid,
  p_worker_id text default null
)
returns table(
  job_id uuid,
  job_type media.processing_job_type,
  attempt_count integer,
  max_attempts integer,
  output_bucket text,
  output_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  video_job media.media_processing_jobs%rowtype;
  source_intent media.upload_intents%rowtype;
  companion_id uuid;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  select * into video_job
  from media.media_processing_jobs job
  where job.id = p_job_id
    and job.job_type = 'video_delivery'::media.processing_job_type
    and job.status = 'processing'::media.processing_job_status;
  if not found then
    return;
  end if;

  select * into source_intent from media.upload_intents intent where intent.id = video_job.upload_intent_id;
  if not found or source_intent.media_type <> 'video'::media.media_type then
    return;
  end if;

  insert into media.media_processing_jobs(
    upload_intent_id, job_type, status, input_bucket, input_path, output_bucket, output_path
  ) values (
    source_intent.id,
    'audio_delivery'::media.processing_job_type,
    'queued'::media.processing_job_status,
    video_job.input_bucket,
    video_job.input_path,
    video_job.output_bucket,
    private.media_processing_output_path(source_intent.creator_account_id, source_intent.id, 'audio_delivery'::media.processing_job_type)
  )
  on conflict (upload_intent_id, job_type) do nothing;

  select job.id
  into companion_id
  from media.media_processing_jobs job
  where job.upload_intent_id = source_intent.id
    and job.job_type = 'audio_delivery'::media.processing_job_type
    and (
      job.status in ('queued'::media.processing_job_status, 'failed'::media.processing_job_status)
      or (
        job.status = 'processing'::media.processing_job_status
        and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
      )
    )
  for update skip locked;

  if companion_id is null then
    return;
  end if;

  update media.media_processing_jobs job
  set status = 'processing'::media.processing_job_status,
      attempt_count = case when job.attempt_count >= job.max_attempts then 1 else job.attempt_count + 1 end,
      worker_id = nullif(trim(coalesce(p_worker_id, '')), ''),
      claimed_at = now(),
      heartbeat_at = now(),
      progress = 0,
      started_at = coalesce(job.started_at, now()),
      finished_at = null,
      error_message = null,
      updated_at = now()
  where job.id = companion_id
  returning job.id, job.job_type, job.attempt_count, job.max_attempts, job.output_bucket, job.output_path
  into job_id, job_type, attempt_count, max_attempts, output_bucket, output_path;

  return next;
end;
$function$;

-- A live worker's proof of life, with how far along it is (0..1). Returns each
-- job's current status so the worker stops work an admin cancelled or deleted.
create or replace function public.heartbeat_media_processing_jobs(
  p_worker_token text,
  p_job_ids uuid[],
  p_progress real default null
)
returns table(job_id uuid, status media.processing_job_status)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  update media.media_processing_jobs job
  set heartbeat_at = now(),
      progress = case when p_progress is null then job.progress else least(greatest(p_progress, 0::real), 1::real) end
  where job.id = any(p_job_ids)
    and job.status = 'processing'::media.processing_job_status;

  return query
  select job.id, job.status
  from media.media_processing_jobs job
  where job.id = any(p_job_ids);
end;
$function$;

-- A worker shutting down (redeploy, scale-down) hands its jobs straight back
-- without spending an attempt on them.
create or replace function public.release_media_processing_jobs(
  p_worker_token text,
  p_job_ids uuid[],
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  affected integer := 0;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      attempt_count = greatest(job.attempt_count - 1, 0),
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      available_at = now(),
      error_message = left(coalesce(nullif(trim(p_reason), ''), 'Released by a media worker that was shutting down'), 4000),
      updated_at = now()
  where job.id = any(p_job_ids)
    and job.status = 'processing'::media.processing_job_status;

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

-- A video with no sound has no audio-only copy to make.
create or replace function public.skip_media_processing_job(
  p_worker_token text,
  p_job_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  affected integer := 0;
  skipped_intent_id uuid;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  update media.media_processing_jobs job
  set status = 'cancelled'::media.processing_job_status,
      worker_id = null,
      heartbeat_at = null,
      progress = null,
      finished_at = now(),
      error_message = left('No audio track: ' || coalesce(nullif(trim(p_reason), ''), 'the video has no sound'), 4000),
      updated_at = now()
  where job.id = p_job_id
    and job.job_type = 'audio_delivery'::media.processing_job_type
    and job.status = 'processing'::media.processing_job_status
  returning job.upload_intent_id into skipped_intent_id;

  get diagnostics affected = row_count;
  if skipped_intent_id is not null then
    perform private.settle_submission_processing(skipped_intent_id);
  end if;
  return affected;
end;
$function$;

-- Marks a video's original as removed and hands back where it is, only once
-- the MP4 and the audio-only copy both exist and no job still needs it.
create or replace function public.claim_media_original_deletion(
  p_worker_token text,
  p_upload_intent_id uuid
)
returns table(bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  intent_record media.upload_intents%rowtype;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  select * into intent_record
  from media.upload_intents intent
  where intent.id = p_upload_intent_id
  for update;

  if not found
    or intent_record.media_type <> 'video'::media.media_type
    or intent_record.status <> 'uploaded'::media.upload_intent_status
    or intent_record.original_deleted_at is not null then
    return;
  end if;

  if not exists (
    select 1 from media.media_processing_jobs job
    where job.upload_intent_id = intent_record.id
      and job.job_type = 'video_delivery'::media.processing_job_type
      and job.status = 'completed'::media.processing_job_status
      and job.media_asset_id is not null
  ) then
    return;
  end if;

  if not exists (
    select 1 from media.media_processing_jobs job
    where job.upload_intent_id = intent_record.id
      and job.job_type = 'audio_delivery'::media.processing_job_type
      and (
        (job.status = 'completed'::media.processing_job_status and job.media_asset_id is not null)
        or private.media_job_skipped_for_silence(job.status, job.error_message)
      )
  ) then
    return;
  end if;

  if exists (
    select 1 from media.media_processing_jobs job
    where job.upload_intent_id = intent_record.id
      and job.status in (
        'queued'::media.processing_job_status,
        'processing'::media.processing_job_status,
        'failed'::media.processing_job_status
      )
  ) then
    return;
  end if;

  update media.upload_intents intent
  set original_deleted_at = now(),
      updated_at = now()
  where intent.id = intent_record.id;

  return query select intent_record.bucket, intent_record.path;
end;
$function$;

revoke all on function public.claim_companion_media_processing_job(text, uuid, text) from public;
revoke all on function public.heartbeat_media_processing_jobs(text, uuid[], real) from public;
revoke all on function public.release_media_processing_jobs(text, uuid[], text) from public;
revoke all on function public.skip_media_processing_job(text, uuid, text) from public;
revoke all on function public.claim_media_original_deletion(text, uuid) from public;
grant execute on function public.claim_companion_media_processing_job(text, uuid, text) to anon, authenticated;
grant execute on function public.heartbeat_media_processing_jobs(text, uuid[], real) to anon, authenticated;
grant execute on function public.release_media_processing_jobs(text, uuid[], text) to anon, authenticated;
grant execute on function public.skip_media_processing_job(text, uuid, text) to anon, authenticated;
grant execute on function public.claim_media_original_deletion(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enqueueing: a video's audio-only job is queued with it, and nothing that
-- needs a removed original can be queued again.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_media_processing_job(
  p_upload_intent_id uuid,
  p_job_type media.processing_job_type default 'audio_delivery'::media.processing_job_type,
  p_output_bucket text default null
)
returns table(job_id uuid, status media.processing_job_status, input_bucket text, input_path text, output_bucket text, output_path text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  source_intent media.upload_intents%rowtype;
  generated_output_path text;
  resolved_bucket text;
  allowed_buckets text[];
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_job_type = 'metadata_probe'::media.processing_job_type then
    raise exception 'metadata_probe jobs are not implemented by any worker' using errcode = '22023';
  end if;

  allowed_buckets := case p_job_type
    when 'audio_delivery'::media.processing_job_type then array['chc-music', 'chc-learning']
    when 'video_delivery'::media.processing_job_type then array['chc-learning']
    when 'image_delivery'::media.processing_job_type then array['chc-images']
  end;
  if allowed_buckets is null then
    raise exception 'Unsupported processing job type: %', p_job_type using errcode = '22023';
  end if;
  resolved_bucket := coalesce(p_output_bucket, allowed_buckets[1]);
  if not (resolved_bucket = any(allowed_buckets)) then
    raise exception '% jobs cannot write to %', p_job_type, resolved_bucket using errcode = '22023';
  end if;

  select * into source_intent from media.upload_intents where id = p_upload_intent_id;
  if not found then raise exception 'Upload intent not found' using errcode = 'P0002'; end if;
  if source_intent.status <> 'uploaded'::media.upload_intent_status then
    raise exception 'Upload intent is not uploaded' using errcode = '22023';
  end if;

  -- Video uploads intentionally create both video_delivery and audio_delivery.
  if not (
    (p_job_type = 'audio_delivery' and source_intent.media_type in ('audio'::media.media_type, 'video'::media.media_type))
    or (p_job_type = 'video_delivery' and source_intent.media_type = 'video'::media.media_type)
    or (p_job_type = 'image_delivery' and source_intent.media_type = 'image'::media.media_type)
  ) then
    raise exception 'A % upload cannot be enqueued for %', source_intent.media_type, p_job_type using errcode = '22023';
  end if;
  if source_intent.requested_by <> request_user_id
    and not (select private.can_edit_creator_account(source_intent.creator_account_id)) then
    raise exception 'Not authorized for upload intent' using errcode = '42501';
  end if;

  if source_intent.original_deleted_at is not null and not exists (
    select 1 from media.media_processing_jobs done
    where done.upload_intent_id = source_intent.id
      and done.job_type = p_job_type
      and (
        done.status = 'completed'::media.processing_job_status
        or private.media_job_skipped_for_silence(done.status, done.error_message)
      )
  ) then
    raise exception 'The original upload was removed after processing; upload the file again' using errcode = '22023';
  end if;

  generated_output_path := private.media_processing_output_path(
    source_intent.creator_account_id, source_intent.id, p_job_type
  );
  insert into media.media_processing_jobs(
    upload_intent_id, job_type, status, input_bucket, input_path, output_bucket, output_path
  ) values (
    source_intent.id, p_job_type, 'queued'::media.processing_job_status,
    source_intent.bucket, source_intent.path, resolved_bucket, generated_output_path
  )
  on conflict (upload_intent_id, job_type) do update set
    available_at = case when media.media_processing_jobs.status in ('failed','cancelled') then now() else media.media_processing_jobs.available_at end,
    status = case when media.media_processing_jobs.status in ('failed','cancelled') then 'queued'::media.processing_job_status else media.media_processing_jobs.status end,
    attempt_count = case when media.media_processing_jobs.status in ('failed','cancelled') then 0 else media.media_processing_jobs.attempt_count end,
    finished_at = case when media.media_processing_jobs.status in ('failed','cancelled') then null else media.media_processing_jobs.finished_at end,
    output_bucket = case when media.media_processing_jobs.status in ('failed','cancelled') then excluded.output_bucket else media.media_processing_jobs.output_bucket end,
    output_path = case when media.media_processing_jobs.status in ('failed','cancelled') then excluded.output_path else media.media_processing_jobs.output_path end,
    error_message = case when media.media_processing_jobs.status in ('failed','cancelled') then null else media.media_processing_jobs.error_message end
  where not private.media_job_skipped_for_silence(media.media_processing_jobs.status, media.media_processing_jobs.error_message)
  returning id, media.media_processing_jobs.status, media.media_processing_jobs.input_bucket,
    media.media_processing_jobs.input_path, media.media_processing_jobs.output_bucket,
    media.media_processing_jobs.output_path
  into job_id, status, input_bucket, input_path, output_bucket, output_path;

  if job_id is null then
    -- A silent video's skipped audio-only job stays skipped.
    select job.id, job.status, job.input_bucket, job.input_path, job.output_bucket, job.output_path
    into job_id, status, input_bucket, input_path, output_bucket, output_path
    from media.media_processing_jobs job
    where job.upload_intent_id = source_intent.id and job.job_type = p_job_type;
  end if;

  -- The audio-only copy is made in the same pass as the video.
  if p_job_type = 'video_delivery'::media.processing_job_type then
    insert into media.media_processing_jobs(
      upload_intent_id, job_type, status, input_bucket, input_path, output_bucket, output_path
    ) values (
      source_intent.id, 'audio_delivery'::media.processing_job_type, 'queued'::media.processing_job_status,
      source_intent.bucket, source_intent.path, 'chc-learning',
      private.media_processing_output_path(source_intent.creator_account_id, source_intent.id, 'audio_delivery'::media.processing_job_type)
    )
    on conflict (upload_intent_id, job_type) do update set
      status = 'queued'::media.processing_job_status,
      available_at = now(),
      attempt_count = 0,
      finished_at = null,
      error_message = null
    where media.media_processing_jobs.status = 'failed'::media.processing_job_status;
  end if;

  update media.upload_intents set error_message = null where id = source_intent.id;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Readiness: a silent video needs no audio-only copy.
-- ---------------------------------------------------------------------------
create or replace function private.submission_required_items_ready(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists(select 1 from media.submission_items where submission_id=p_submission_id and required)
    and not exists(
      select 1 from media.submission_items item
      left join media.media_assets asset on asset.id=item.media_asset_id and asset.processing_status='completed'::media.processing_status
      left join media.upload_intents intent on intent.id=item.upload_intent_id
      left join media.media_assets audio_asset on audio_asset.id=item.audio_only_asset_id and audio_asset.processing_status='completed'::media.processing_status
      where item.submission_id=p_submission_id and item.required
        and (
          asset.id is null
          or (
            intent.media_type='video'::media.media_type
            and audio_asset.id is null
            and not exists (
              select 1 from media.media_processing_jobs silent
              where silent.upload_intent_id = intent.id
                and silent.job_type = 'audio_delivery'::media.processing_job_type
                and private.media_job_skipped_for_silence(silent.status, silent.error_message)
            )
          )
        )
        and intent.media_type in ('audio'::media.media_type,'image'::media.media_type,'video'::media.media_type)
    );
$function$;

-- ---------------------------------------------------------------------------
-- Storage GC: a removed original is no longer referenced (so a failed
-- deletion is still cleaned up later).
-- ---------------------------------------------------------------------------
create or replace function private.storage_object_is_referenced(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    exists (
      select 1
      from media.media_processing_jobs job
      where job.status in (
        'queued'::media.processing_job_status,
        'processing'::media.processing_job_status,
        'failed'::media.processing_job_status
      )
        and (
          (job.input_bucket = p_bucket and job.input_path = p_path)
          or (job.output_bucket = p_bucket and job.output_path = p_path)
        )
    )
    or exists (
      select 1
      from media.upload_intents upload
      where upload.bucket = p_bucket
        and upload.path = p_path
        and upload.original_deleted_at is null
        and private.storage_upload_intent_is_referenced(upload.id)
    )
    or exists (
      select 1
      from media.media_assets asset
      where asset.bucket = p_bucket
        and asset.path = p_path
        and private.storage_asset_is_referenced(asset.id)
    )
    or exists (
      select 1
      from media.media_asset_versions version
      where version.bucket = p_bucket
        and version.path = p_path
        and private.storage_asset_version_is_referenced(version.id)
    );
$function$;

-- A processed video whose original was removed is reusable only while its
-- delivery still exists.
create or replace function public.find_reusable_uploaded_media_intent(
  p_creator_account_id uuid,
  p_original_filename text,
  p_content_length bigint,
  p_media_type media.media_type
)
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select intent.id
  from media.upload_intents intent
  where intent.creator_account_id = p_creator_account_id
    and intent.requested_by = (select auth.uid())
    and (select private.can_edit_creator_account(p_creator_account_id))
    and intent.original_filename = p_original_filename
    and intent.content_length = p_content_length
    and intent.uploaded_size = p_content_length
    and intent.media_type = p_media_type
    and intent.status = 'uploaded'::media.upload_intent_status
    and intent.uploaded_at > now() - interval '7 days'
    and not exists (
      select 1 from media.submission_items item
      where item.upload_intent_id = intent.id
    )
    and (
      intent.original_deleted_at is null
      or exists (
        select 1
        from media.media_processing_jobs job
        join media.media_assets asset on asset.id = job.media_asset_id
        where job.upload_intent_id = intent.id
          and job.job_type = 'video_delivery'::media.processing_job_type
          and job.status = 'completed'::media.processing_job_status
      )
    )
  order by intent.uploaded_at desc
  limit 1;
$function$;

-- ---------------------------------------------------------------------------
-- Admin forcing: a job with a live heartbeat is actively processing however
-- long it has been running (a long video was previously forced back into the
-- queue after 15 minutes and processed twice at once).
-- ---------------------------------------------------------------------------
create or replace function public.force_media_processing_job(p_job_id uuid)
returns table(job_id uuid, status media.processing_job_status, available_at timestamp with time zone, attempt_count integer, max_attempts integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_user_id uuid := auth.uid();
  job_record media.media_processing_jobs%rowtype;
  intent_record media.upload_intents%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into job_record
  from media.media_processing_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'Processing job not found' using errcode = 'P0002';
  end if;

  if job_record.status = 'completed'::media.processing_job_status then
    raise exception 'Completed jobs do not need to be forced' using errcode = '22023';
  end if;

  if job_record.status = 'processing'::media.processing_job_status
     and not private.media_processing_job_is_stale(job_record.job_type, job_record.claimed_at, job_record.heartbeat_at) then
    raise exception 'This job is already actively processing' using errcode = '22023';
  end if;

  select * into intent_record from media.upload_intents intent where intent.id = job_record.upload_intent_id;
  if found and intent_record.original_deleted_at is not null then
    raise exception 'The original upload was removed after processing; upload the file again' using errcode = '22023';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      -- claim_media_processing_job sorts by available_at first. Epoch places
      -- an explicitly forced job ahead of ordinary queued work.
      available_at = '1970-01-01 00:00:00+00'::timestamptz,
      attempt_count = case
        when job.attempt_count >= job.max_attempts then 0
        else job.attempt_count
      end,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      started_at = null,
      finished_at = null,
      error_message = null,
      updated_at = now()
  where job.id = p_job_id;

  return query
  select job.id, job.status, job.available_at, job.attempt_count, job.max_attempts
  from media.media_processing_jobs job
  where job.id = p_job_id;
end;
$function$;

create or replace function public.force_pending_media_processing_jobs()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_user_id uuid := auth.uid();
  affected integer := 0;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      available_at = now(),
      attempt_count = case
        when job.attempt_count >= job.max_attempts then 0
        else job.attempt_count
      end,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      started_at = null,
      finished_at = null,
      error_message = null,
      updated_at = now()
  where (
      job.status in (
        'queued'::media.processing_job_status,
        'failed'::media.processing_job_status,
        'cancelled'::media.processing_job_status
      )
      or (
        job.status = 'processing'::media.processing_job_status
        and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
      )
    )
    and not private.media_job_skipped_for_silence(job.status, job.error_message)
    and not exists (
      select 1 from media.upload_intents intent
      where intent.id = job.upload_intent_id
        and intent.original_deleted_at is not null
    );

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

create or replace function public.force_submission_media_processing(p_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_user_id uuid := auth.uid();
  affected integer := 0;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from media.submissions submission where submission.id = p_submission_id
  ) then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      available_at = '1970-01-01 00:00:00+00'::timestamptz,
      attempt_count = case
        when job.attempt_count >= job.max_attempts then 0
        else job.attempt_count
      end,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      started_at = null,
      finished_at = null,
      error_message = null,
      updated_at = now()
  where job.id in (
    select item.media_processing_job_id
    from media.submission_items item
    where item.submission_id = p_submission_id
      and item.media_processing_job_id is not null
  )
    and (
      job.status in (
        'queued'::media.processing_job_status,
        'failed'::media.processing_job_status,
        'cancelled'::media.processing_job_status
      )
      or (
        job.status = 'processing'::media.processing_job_status
        and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
      )
    )
    and not exists (
      select 1 from media.upload_intents intent
      where intent.id = job.upload_intent_id
        and intent.original_deleted_at is not null
    );

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

-- ---------------------------------------------------------------------------
-- What admins and creators see
-- ---------------------------------------------------------------------------

-- One row per file: a video's audio-only job is shown inside its video's row.
create or replace function public.get_admin_processing_jobs()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return (
    with visible_jobs as (
      select job.*
      from media.media_processing_jobs job
      left join media.upload_intents upload on upload.id = job.upload_intent_id
      where not (
        job.job_type = 'audio_delivery'::media.processing_job_type
        and coalesce(upload.media_type = 'video'::media.media_type, false)
        and exists (
          select 1 from media.media_processing_jobs video
          where video.upload_intent_id = job.upload_intent_id
            and video.job_type = 'video_delivery'::media.processing_job_type
        )
      )
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'queued', (select count(*) from visible_jobs where status = 'queued'::media.processing_job_status),
        'processing', (select count(*) from visible_jobs where status = 'processing'::media.processing_job_status),
        'completed', (select count(*) from visible_jobs where status = 'completed'::media.processing_job_status),
        'failed', (select count(*) from visible_jobs where status = 'failed'::media.processing_job_status),
        'cancelled', (select count(*) from visible_jobs where status = 'cancelled'::media.processing_job_status)
      ),
      'jobs', coalesce((
        select jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'id', job.id,
            'jobType', job.job_type,
            'status', job.status,
            'attemptCount', job.attempt_count,
            'maxAttempts', job.max_attempts,
            'workerId', job.worker_id,
            'inputBucket', job.input_bucket,
            'inputPath', job.input_path,
            'outputBucket', job.output_bucket,
            'outputPath', job.output_path,
            'outputMimeType', job.output_mime_type,
            'outputSizeBytes', job.output_size_bytes,
            'errorMessage', job.error_message,
            'queuedAt', job.queued_at,
            'availableAt', job.available_at,
            'claimedAt', job.claimed_at,
            'startedAt', job.started_at,
            'finishedAt', job.finished_at,
            'createdAt', job.created_at,
            'updatedAt', job.updated_at,
            'heartbeatAt', job.heartbeat_at,
            'progress', job.progress,
            'audioOnly', (
              select jsonb_strip_nulls(jsonb_build_object(
                'id', audio.id,
                'status', audio.status,
                'attemptCount', audio.attempt_count,
                'maxAttempts', audio.max_attempts,
                'outputSizeBytes', audio.output_size_bytes,
                'errorMessage', audio.error_message
              ))
              from media.media_processing_jobs audio
              where job.job_type = 'video_delivery'::media.processing_job_type
                and audio.upload_intent_id = job.upload_intent_id
                and audio.job_type = 'audio_delivery'::media.processing_job_type
              limit 1
            ),
            'item', case when item.id is null then null else jsonb_build_object(
              'id', item.id,
              'title', item.title,
              'role', item.role,
              'sortOrder', item.sort_order,
              'required', item.required
            ) end,
            'upload', case when upload.id is null then null else jsonb_build_object(
              'id', upload.id,
              'originalFilename', upload.original_filename,
              'mediaType', upload.media_type,
              'contentType', upload.content_type,
              'contentLength', upload.content_length,
              'originalDeletedAt', upload.original_deleted_at
            ) end,
            'submission', case when submission.id is null then null else jsonb_build_object(
              'id', submission.id,
              'title', submission.title,
              'submissionType', submission.submission_type,
              'status', submission.status,
              'creatorName', account.display_name,
              'artworkItemId', (
                select artwork.id
                from media.submission_items artwork
                where artwork.submission_id = submission.id
                  and artwork.role = 'artwork'::media.submission_item_role
                order by artwork.sort_order, artwork.created_at
                limit 1
              )
            ) end
          ))
          order by
            case job.status
              when 'processing'::media.processing_job_status then 0
              when 'queued'::media.processing_job_status then 1
              when 'failed'::media.processing_job_status then 2
              when 'completed'::media.processing_job_status then 3
              else 4
            end,
            job.queued_at desc
        )
        from visible_jobs job
        left join media.submission_items item on item.media_processing_job_id = job.id
        left join media.upload_intents upload on upload.id = job.upload_intent_id
        left join media.submissions submission on submission.id = item.submission_id
        left join creator.creator_accounts account on account.id = submission.creator_account_id
      ), '[]'::jsonb)
    )
  );
end;
$function$;

-- A creator sees the job that makes the file itself (for a video, the video
-- job, not its audio-only copy), with how far along it is.
create or replace function public.get_creator_submission_items(p_submission_id uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (select 1 from media.submissions submission where submission.id = p_submission_id) then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', item.id,
      'title', item.title,
      'role', item.role,
      'sortOrder', item.sort_order,
      'required', item.required,
      'mediaAssetId', item.media_asset_id,
      'uploadIntentId', item.upload_intent_id,
      'mediaType', intent.media_type,
      'contentLength', intent.content_length,
      'uploadStatus', intent.status,
      'processingStatus', job.status,
      'processingJobType', job.job_type,
      'processingAttemptCount', job.attempt_count,
      'processingMaxAttempts', job.max_attempts,
      'processingError', job.error_message,
      'processingAvailableAt', job.available_at,
      'processingProgress', job.progress
    ) order by item.sort_order, item.created_at)
    from media.submission_items item
    left join media.upload_intents intent on intent.id = item.upload_intent_id
    -- Read the live job for this upload rather than the one stamped on the
    -- item, so a queued/processing/failed job is visible before it completes.
    left join lateral (
      select
        pending_job.status,
        pending_job.job_type,
        pending_job.attempt_count,
        pending_job.max_attempts,
        pending_job.error_message,
        pending_job.available_at,
        pending_job.progress
      from media.media_processing_jobs pending_job
      where pending_job.upload_intent_id = item.upload_intent_id
      order by
        case
          when pending_job.job_type = case intent.media_type
            when 'video'::media.media_type then 'video_delivery'::media.processing_job_type
            when 'image'::media.media_type then 'image_delivery'::media.processing_job_type
            else 'audio_delivery'::media.processing_job_type
          end then 0
          else 1
        end,
        case pending_job.status
          when 'completed'::media.processing_job_status then 0
          when 'processing'::media.processing_job_status then 1
          when 'queued'::media.processing_job_status then 2
          else 3
        end,
        pending_job.created_at desc
      limit 1
    ) job on true
    where item.submission_id = p_submission_id
  ), '[]'::jsonb);
end;
$function$;

-- Review previews play the delivery file once the original has been removed.
create or replace function public.get_admin_submission_preview_item(p_item_id uuid)
returns table(item_id uuid, submission_id uuid, bucket text, object_path text, content_type text, content_length bigint, original_filename text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return query
  select
    item.id,
    item.submission_id,
    case when intent.original_deleted_at is null then intent.bucket else asset.bucket end,
    case when intent.original_deleted_at is null then intent.path else asset.path end,
    case when intent.original_deleted_at is null then intent.content_type else asset.mime_type end,
    case when intent.original_deleted_at is null then intent.content_length else asset.file_size_bytes end,
    intent.original_filename
  from media.submission_items item
  join media.upload_intents intent on intent.id = item.upload_intent_id
  left join media.media_assets asset on asset.id = item.media_asset_id
  where item.id = p_item_id
    and intent.status = 'uploaded'::media.upload_intent_status
    and (intent.original_deleted_at is null or asset.id is not null);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Uploads: a day to finish (and resume) a very large upload.
-- ---------------------------------------------------------------------------
create or replace function public.create_media_upload_intent(
  p_creator_account_id uuid,
  p_original_filename text,
  p_content_type text,
  p_content_length bigint,
  p_media_type media.media_type default 'audio'::media.media_type,
  p_checksum_sha256 text default null::text
)
returns table(upload_intent_id uuid, bucket text, object_path text, expires_at timestamp with time zone, content_type text, content_length bigint, media_type media.media_type)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_user_id uuid := auth.uid();
  generated_upload_intent_id uuid := gen_random_uuid();
  generated_bucket text := 'chc-submissions';
  generated_path text;
  normalized_content_type text := lower(trim(p_content_type));
  normalized_checksum text := lower(trim(coalesce(p_checksum_sha256, '')));
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_creator_account_id is null then
    raise exception 'creator_account_id is required' using errcode = '22023';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  if p_original_filename is null or length(trim(p_original_filename)) = 0 then
    raise exception 'original_filename is required' using errcode = '22023';
  end if;

  if normalized_content_type !~ '^(audio|video|image)/[a-z0-9.+-]+$' then
    raise exception 'Unsupported content type' using errcode = '22023';
  end if;

  if p_content_length is null or p_content_length <= 0 or p_content_length > 21474836480 then
    raise exception 'Invalid content length' using errcode = '22023';
  end if;

  if normalized_checksum <> '' and normalized_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid sha256 checksum' using errcode = '22023';
  end if;

  generated_path :=
    'submissions/' ||
    p_creator_account_id::text ||
    '/' ||
    generated_upload_intent_id::text ||
    '/original' ||
    private.upload_file_extension(p_original_filename);

  insert into media.upload_intents (
    id,
    creator_account_id,
    requested_by,
    bucket,
    path,
    media_type,
    original_filename,
    content_type,
    content_length,
    checksum_sha256,
    status,
    upload_expires_at
  )
  values (
    generated_upload_intent_id,
    p_creator_account_id,
    request_user_id,
    generated_bucket,
    generated_path,
    p_media_type,
    trim(p_original_filename),
    normalized_content_type,
    p_content_length,
    nullif(normalized_checksum, ''),
    'authorized'::media.upload_intent_status,
    now() + interval '24 hours'
  );

  return query
  select
    intent.id,
    intent.bucket,
    intent.path,
    intent.upload_expires_at,
    intent.content_type,
    intent.content_length,
    intent.media_type
  from media.upload_intents intent
  where intent.id = generated_upload_intent_id;
end;
$function$;
