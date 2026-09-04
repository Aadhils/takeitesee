-- Universal Services: provider-visible requirement occurrence context for requirement-backed bookings.
-- Read-only RPC; normal booking lifecycle and finance behavior are unchanged.

create or replace function public.provider_get_booking_requirement_context(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  job_row public.marketplace_requirement_jobs%rowtype;
  requirement_row public.customer_requirements%rowtype;
  proposal_row public.requirement_proposals%rowtype;
  provider_user uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into booking_row from public.bookings where id=target_booking_id;
  if not found then return null; end if;

  if booking_row.provider_type::text='business' then
    select owner_user_id into provider_user from public.businesses where id=booking_row.business_id;
  else
    select user_id into provider_user from public.professional_profiles where id=booking_row.professional_id;
  end if;
  if provider_user is null or provider_user<>auth.uid() then raise exception 'Provider booking access is required.'; end if;

  select * into job_row from public.marketplace_requirement_jobs where booking_id=target_booking_id;
  if not found then return null; end if;
  select * into requirement_row from public.customer_requirements where id=job_row.requirement_id;
  if not found then return null; end if;
  select * into proposal_row from public.requirement_proposals where id=job_row.proposal_id;

  return jsonb_build_object(
    'requirement_id', requirement_row.id,
    'requirement_title', requirement_row.title,
    'schedule_pattern', requirement_row.schedule_pattern,
    'occurrence_number', job_row.sequence_no,
    'occurrence_count', case when requirement_row.schedule_pattern='recurring' then requirement_row.recurrence_count else 1 end,
    'recurrence_frequency', requirement_row.recurrence_frequency,
    'recurrence_interval', requirement_row.recurrence_interval,
    'pricing_basis', proposal_row.pricing_basis
  );
end;
$$;

revoke all on function public.provider_get_booking_requirement_context(uuid) from public,anon;
grant execute on function public.provider_get_booking_requirement_context(uuid) to authenticated;
