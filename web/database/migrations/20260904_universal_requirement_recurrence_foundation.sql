-- Universal Services Ecosystem: recurring requirement intent foundation.
-- Reuses needed_by as the first occurrence date, preferred_start_time as the start time,
-- and expected_duration_minutes as the per-occurrence/shift duration.

alter table public.customer_requirements
  add column if not exists schedule_pattern text not null default 'one_time',
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_interval smallint,
  add column if not exists recurrence_count integer;

alter table public.customer_requirements
  drop constraint if exists customer_requirements_schedule_pattern_check;
alter table public.customer_requirements
  add constraint customer_requirements_schedule_pattern_check
  check (schedule_pattern in ('one_time','recurring'));

alter table public.customer_requirements
  drop constraint if exists customer_requirements_recurrence_contract_check;
alter table public.customer_requirements
  add constraint customer_requirements_recurrence_contract_check
  check (
    (schedule_pattern='one_time' and recurrence_frequency is null and recurrence_interval is null and recurrence_count is null)
    or
    (schedule_pattern='recurring'
      and needed_by is not null
      and recurrence_frequency in ('daily','weekly','monthly')
      and recurrence_interval between 1 and 12
      and recurrence_count between 2 and 365)
  );

create or replace function public.create_customer_requirement(
  requested_idempotency_key text,
  target_category_id uuid,
  target_location_id uuid,
  target_title text,
  target_description text,
  target_service_mode text,
  target_budget_type text,
  target_budget_min_minor bigint,
  target_budget_max_minor bigint,
  target_currency text,
  target_needed_by date,
  target_preferred_start_time time without time zone,
  target_expected_duration_minutes integer,
  target_schedule_pattern text,
  target_recurrence_frequency text,
  target_recurrence_interval smallint,
  target_recurrence_count integer
)
returns public.customer_requirements
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value public.customer_requirements%rowtype;
  key_value text := btrim(coalesce(requested_idempotency_key,''));
  title_value text := btrim(coalesce(target_title,''));
  description_value text := btrim(coalesce(target_description,''));
  mode_value text := lower(btrim(coalesce(target_service_mode,'')));
  budget_value text := lower(btrim(coalesce(target_budget_type,'')));
  currency_value text := upper(btrim(coalesce(target_currency,'INR')));
  schedule_value text := lower(btrim(coalesce(target_schedule_pattern,'one_time')));
  recurrence_value text := nullif(lower(btrim(coalesce(target_recurrence_frequency,''))), '');
  reference_value text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(key_value)<8 or char_length(key_value)>120 then raise exception 'Requirement idempotency key must be 8 to 120 characters.'; end if;

  select * into row_value from public.customer_requirements
  where customer_id=auth.uid() and idempotency_key=key_value limit 1;
  if found then return row_value; end if;

  if char_length(title_value)<8 or char_length(title_value)>120 then raise exception 'Requirement title must be 8 to 120 characters.'; end if;
  if char_length(description_value)<30 or char_length(description_value)>3000 then raise exception 'Requirement description must be 30 to 3000 characters.'; end if;
  if mode_value not in ('onsite','remote','either') then raise exception 'Service mode is invalid.'; end if;
  if budget_value not in ('fixed','range','negotiable') then raise exception 'Budget preference is invalid.'; end if;
  if currency_value not in ('INR','USD') then raise exception 'Requirement currency is invalid.'; end if;
  if target_needed_by is not null and target_needed_by<current_date then raise exception 'Needed-by date cannot be in the past.'; end if;
  if target_preferred_start_time is not null and target_needed_by is null then raise exception 'Preferred start time requires a needed-by date.'; end if;
  if target_expected_duration_minutes is not null and (target_expected_duration_minutes<15 or target_expected_duration_minutes>10080) then
    raise exception 'Expected duration must be between 15 minutes and 7 days.';
  end if;

  if schedule_value not in ('one_time','recurring') then raise exception 'Schedule pattern is invalid.'; end if;
  if schedule_value='one_time' then
    if recurrence_value is not null or target_recurrence_interval is not null or target_recurrence_count is not null then
      raise exception 'One-time requirements cannot include recurrence settings.';
    end if;
  else
    if target_needed_by is null then raise exception 'Recurring requirements need a first service date.'; end if;
    if recurrence_value not in ('daily','weekly','monthly') then raise exception 'Recurrence frequency is invalid.'; end if;
    if target_recurrence_interval is null or target_recurrence_interval<1 or target_recurrence_interval>12 then
      raise exception 'Recurrence interval must be between 1 and 12.';
    end if;
    if target_recurrence_count is null or target_recurrence_count<2 or target_recurrence_count>365 then
      raise exception 'Recurrence count must be between 2 and 365.';
    end if;
  end if;

  if not exists(select 1 from public.platform_categories c where c.id=target_category_id and c.active=true) then
    raise exception 'Choose an active service category.';
  end if;
  if exists(select 1 from public.platform_categories c where c.parent_id=target_category_id and c.active=true) then
    raise exception 'Choose a specific service category rather than a parent category.';
  end if;
  if not exists(select 1 from public.platform_locations l where l.id=target_location_id and l.active=true and l.type::text='city') then
    raise exception 'Choose an active city.';
  end if;

  if budget_value='negotiable' and (target_budget_min_minor is not null or target_budget_max_minor is not null) then
    raise exception 'Negotiable budget must not include a fixed amount.';
  elsif budget_value='fixed' and (target_budget_min_minor is null or target_budget_min_minor<=0 or target_budget_max_minor is distinct from target_budget_min_minor) then
    raise exception 'Fixed budget requires one positive amount.';
  elsif budget_value='range' and (target_budget_min_minor is null or target_budget_max_minor is null or target_budget_min_minor<=0 or target_budget_max_minor<target_budget_min_minor) then
    raise exception 'Budget range is invalid.';
  end if;

  reference_value := 'REQ-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.customer_requirements(
    requirement_reference,idempotency_key,customer_id,category_id,location_id,title,description,
    service_mode,budget_type,budget_min_minor,budget_max_minor,currency,needed_by,
    preferred_start_time,expected_duration_minutes,schedule_pattern,recurrence_frequency,
    recurrence_interval,recurrence_count,status,published_at
  ) values (
    reference_value,key_value,auth.uid(),target_category_id,target_location_id,title_value,description_value,
    mode_value,budget_value,target_budget_min_minor,target_budget_max_minor,currency_value,target_needed_by,
    target_preferred_start_time,target_expected_duration_minutes,schedule_value,recurrence_value,
    target_recurrence_interval,target_recurrence_count,'open',now()
  ) returning * into row_value;

  return row_value;
end;
$$;

revoke all on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date,time without time zone,integer,text,text,smallint,integer) from public,anon;
grant execute on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date,time without time zone,integer,text,text,smallint,integer) to authenticated,service_role;
