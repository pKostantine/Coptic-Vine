-- The media processor moves from Railway, where it ran around the clock, to a
-- Cloudflare Container that runs only while there is work
-- (workers/media-processor/cloudflare). Two pieces here:
--
-- 1. public.media_processing_queue_has_work: the Worker asks this before
--    starting the container, since a running container is billed.
-- 2. A wake-up call to the Worker the moment a job is queued, so a new upload
--    starts processing within seconds. The Worker also checks every minute,
--    which covers retries that come due later and any call that is lost.

create or replace function public.media_processing_queue_has_work(p_worker_token text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  -- What claim_media_processing_job would pick up: a due job with attempts
  -- left, or one whose worker stopped (claiming requeues or fails it).
  return exists (
    select 1
    from media.media_processing_jobs job
    where (job.status = 'queued'::media.processing_job_status
           and job.available_at <= now()
           and job.attempt_count < job.max_attempts)
       or (job.status = 'processing'::media.processing_job_status
           and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at))
  );
end;
$$;

revoke all on function public.media_processing_queue_has_work(text) from public;
grant execute on function public.media_processing_queue_has_work(text) to anon, authenticated;

create or replace function private.wake_media_processor()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if exists (select 1 from changed_jobs job where job.status = 'queued'::media.processing_job_status) then
    -- pg_net sends this after the transaction commits, so the Worker sees the job.
    perform net.http_post(
      url := 'https://cv-media-processor.hrmpdd8d6c.workers.dev/wake',
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return null;
exception when others then
  -- A lost wake-up costs at most a minute; a failed upload would cost more.
  raise warning 'Could not wake the media processor: %', sqlerrm;
  return null;
end;
$$;

revoke all on function private.wake_media_processor() from public;

-- Statement triggers: one call per upload or retry, however many rows. Claims
-- and heartbeats leave jobs `processing`, so they never call.
drop trigger if exists media_processing_jobs_wake_on_insert on media.media_processing_jobs;
create trigger media_processing_jobs_wake_on_insert
  after insert on media.media_processing_jobs
  referencing new table as changed_jobs
  for each statement execute function private.wake_media_processor();

drop trigger if exists media_processing_jobs_wake_on_update on media.media_processing_jobs;
create trigger media_processing_jobs_wake_on_update
  after update on media.media_processing_jobs
  referencing new table as changed_jobs
  for each statement execute function private.wake_media_processor();

notify pgrst, 'reload schema';
