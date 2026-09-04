-- Product hardening: keep at most one non-cancelled interview schedule per job application.
-- Reschedules update the same row. A new interview may be created only after the
-- previous interview has been cancelled.

create unique index if not exists job_interviews_one_active_per_application_idx
  on public.job_interviews(job_application_id)
  where status in ('scheduled','accepted','declined');
