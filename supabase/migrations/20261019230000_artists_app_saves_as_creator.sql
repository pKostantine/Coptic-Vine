-- The Artists app saves as the artist, even when the person signed in is also a
-- Coptic Vine admin. Admin rules (the status stays where it is, new files go
-- live without review) belong to Coptic Vine Admin only. Without this, an admin
-- resubmitting their own "changes requested" submission from the Artists app
-- kept it in changes_requested, with the old reviewer note still showing.
--
-- The app marks its saves with "asCreator": true inside p_edit rather than a
-- new parameter, so an Artists build sent before or after this migration keeps
-- finding the function.

create or replace function public.save_submission_edit(p_submission_id uuid, p_edit jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := auth.uid();
  sub media.submissions%rowtype;
  -- An admin can give up admin rules for a save; nobody can take them on.
  is_admin boolean := private.is_admin() and (p_edit -> 'asCreator') is distinct from 'true'::jsonb;
  outcome jsonb;
  previous_status media.publication_status;
  next_status media.publication_status;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_edit is null or jsonb_typeof(p_edit) <> 'object' then
    raise exception 'Nothing to save' using errcode = '22023';
  end if;

  select * into sub from media.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if not private.can_edit_creator_account(sub.creator_account_id) then
    raise exception 'Not authorized for this submission' using errcode = '42501';
  end if;
  if sub.status in ('rejected'::media.publication_status, 'archived'::media.publication_status) then
    raise exception 'This submission was not approved, so it can no longer be edited. Send a new submission instead.'
      using errcode = '22023';
  end if;

  if sub.submission_type = 'music_release'::media.submission_type then
    outcome := private.save_music_submission_edit(sub.id, p_edit, actor, is_admin);
  elsif sub.submission_type in ('learning_album'::media.submission_type, 'learning_lesson_set'::media.submission_type) then
    outcome := private.save_learning_submission_edit(sub.id, p_edit, actor, is_admin);
  else
    raise exception 'This kind of submission cannot be edited here' using errcode = '22023';
  end if;

  perform private.attach_completed_submission_jobs(sub.id);

  -- An artist's edit goes to review when it is not live yet, or brings new
  -- files to live content. An admin's keeps the status it found.
  previous_status := sub.status;
  next_status := case
    when is_admin then previous_status
    when previous_status = 'published'::media.publication_status
      then case when (outcome ->> 'mediaChanged')::boolean then 'pending_review'::media.publication_status
                else previous_status end
    else 'pending_review'::media.publication_status
  end;

  -- Back in review, it reads as a fresh submission: the reviewer's note and
  -- decision are cleared and the review clock restarts.
  if next_status = 'pending_review'::media.publication_status and previous_status <> next_status then
    update media.submissions
    set status = next_status,
        submitted_at = now(),
        review_due_at = now() + interval '48 hours',
        reviewer_id = null,
        reviewed_at = null,
        review_notes = null,
        approved_at = null,
        rejected_at = null,
        updated_by = actor,
        updated_at = now()
    where id = sub.id;
  end if;

  perform private.add_media_submission_event(
    sub.id, actor,
    case when is_admin then 'edited_by_admin' else 'edited_by_creator' end,
    previous_status, next_status, null, outcome);

  -- An admin's new files on live content go live once processed: now, if
  -- they already are, otherwise when processing settles.
  if is_admin and next_status = 'published'::media.publication_status then
    if sub.submission_type = 'music_release'::media.submission_type then
      if private.submission_required_items_ready(sub.id) and private.music_submission_has_pending_edits(sub.id) then
        perform private.publish_music_submission_internal(sub.id, actor, 'admin_edit');
      end if;
    else
      perform private.apply_learning_submission_edits(sub.id, actor);
    end if;
  end if;

  return public.get_submission_editor(sub.id);
end;
$$;

notify pgrst, 'reload schema';
