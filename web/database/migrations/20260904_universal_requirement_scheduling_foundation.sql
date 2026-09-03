-- Universal Services Ecosystem: structured requirement scheduling foundation.
-- Adds optional preferred start time and expected duration without changing existing
-- requirement lifecycle, provider matching, booking, Cash on Service, or finance behavior.

alter table public.customer_requirements
  add column if not exists preferred_start_time time without time zone,
  add column if not exists expected_duration_minutes integer;

alter table public.customer_requirements
  drop constraint if exists customer_requirements_preferred_start_time_requires_date_check;
alter table public.customer_requirements
  add constraint customer_requirements_preferred_start_time_requires_date_check
  check (preferred_start_time is null or needed_by is not null);

alter table public.customer_requirements
  drop constraint if exists customer_requirements_expected_duration_minutes_check;
alter table public.customer_requirements
  add constraint customer_requirements_expected_duration_minutes_check
  check (expected_duration_minutes is null or expected_duration_minutes between 15 and 10080);

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
  target_expected_duration_minutes integer
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
    preferred_start_time,expected_duration_minutes,status,published_at
  ) values (
    reference_value,key_value,auth.uid(),target_category_id,target_location_id,title_value,description_value,
    mode_value,budget_value,target_budget_min_minor,target_budget_max_minor,currency_value,target_needed_by,
    target_preferred_start_time,target_expected_duration_minutes,'open',now()
  ) returning * into row_value;

  return row_value;
end;
$$;

revoke all on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date,time without time zone,integer) from public,anon;
grant execute on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date,time without time zone,integer) to authenticated,service_role;
