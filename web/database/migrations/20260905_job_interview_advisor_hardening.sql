-- Advisor hardening for #245.
-- Cover the job_interviews.scheduled_by_user_id foreign key identified by the
-- Supabase Performance Advisor. No lifecycle or access behavior changes.

create index if not exists job_interviews_scheduled_by_user_id_idx
  on public.job_interviews(scheduled_by_user_id);
