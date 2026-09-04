-- Universal Services: harden internal recurring-job advancement trigger helpers.
-- Both helpers use fully-qualified public objects; an empty search_path removes unnecessary
-- SECURITY DEFINER name-resolution surface without changing booking/recovery lifecycle behavior.

alter function public.sync_requirement_job_booking_state()
  set search_path = '';

alter function public.sync_requirement_job_from_closeout()
  set search_path = '';
