-- Phase 16 Module 1: customer requirement / job posting foundation.
-- Provider discovery, proposals and messaging intentionally remain closed until later modules.

create table if not exists public.customer_requirements (
  id uuid primary key default gen_random_uuid(),
  requirement_reference text not null unique,
  idempotency_key text not null,
  customer_id uuid not null references public.users(id) on delete restrict,
  category_id uuid not null references public.platform_categories(id) on delete restrict,
  location_id uuid not null references public.platform_locations(id) on delete restrict,
  title text not null,
  description text not null,
  service_mode text not null default 'onsite' check (service_mode in ('onsite','remote','either')),
  budget_type text not null default 'negotiable' check (budget_type in ('fixed','range','negotiable')),
  budget_min_minor bigint,
  budget_max_minor bigint,
  currency text not null default 'INR' check (currency in ('INR','USD')),
  needed_by date,
  status text not null default 'open' check (status in ('open','paused','fulfilled','cancelled')),
  published_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id,idempotency_key),
  check (char_length(btrim(title)) between 8 and 120),
  check (char_length(btrim(description)) between 30 and 3000),
  check (char_length(idempotency_key) between 8 and 120),
  check (
    (budget_type='negotiable' and budget_min_minor is null and budget_max_minor is null)
    or (budget_type='fixed' and budget_min_minor is not null and budget_min_minor>0 and budget_max_minor=budget_min_minor)
    or (budget_type='range' and budget_min_minor is not null and budget_max_minor is not null and budget_min_minor>0 and budget_max_minor>=budget_min_minor)
  ),
  check (
    (status in ('open','paused') and closed_at is null)
    or (status in ('fulfilled','cancelled') and closed_at is not null)
  )
);

create index if not exists customer_requirements_customer_created_idx
  on public.customer_requirements(customer_id,created_at desc);
create index if not exists customer_requirements_status_category_location_idx
  on public.customer_requirements(status,category_id,location_id,created_at desc);

create table if not exists public.customer_requirement_events (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('created','status_changed')),
  from_status text,
  to_status text not null check (to_status in ('open','paused','fulfilled','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (from_status is null or from_status in ('open','paused','fulfilled','cancelled'))
);
create index if not exists customer_requirement_events_requirement_created_idx
  on public.customer_requirement_events(requirement_id,created_at);

alter table public.customer_requirements enable row level security;
alter table public.customer_requirement_events enable row level security;

revoke all on public.customer_requirements from anon;
revoke all on public.customer_requirement_events from anon;
revoke insert,update,delete on public.customer_requirements from authenticated;
revoke insert,update,delete on public.customer_requirement_events from authenticated;
grant select on public.customer_requirements to authenticated;
grant select on public.customer_requirement_events to authenticated;

drop policy if exists customer_requirements_owner_admin_read on public.customer_requirements;
create policy customer_requirements_owner_admin_read on public.customer_requirements
for select to authenticated using (
  customer_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_manage(null,null,null,null)
);

drop policy if exists customer_requirement_events_owner_admin_read on public.customer_requirement_events;
create policy customer_requirement_events_owner_admin_read on public.customer_requirement_events
for select to authenticated using (
  exists(
    select 1 from public.customer_requirements r
    where r.id=customer_requirement_events.requirement_id
      and (
        r.customer_id=auth.uid()
        or public.is_super_admin()
        or public.admin_can_manage(null,null,null,null)
      )
  )
);

create or replace function public.log_customer_requirement_event()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    insert into public.customer_requirement_events(requirement_id,actor_user_id,event_type,from_status,to_status,metadata)
    values(new.id,auth.uid(),'created',null,new.status,jsonb_build_object('reference',new.requirement_reference));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.customer_requirement_events(requirement_id,actor_user_id,event_type,from_status,to_status)
    values(new.id,auth.uid(),'status_changed',old.status,new.status);
  end if;
  return new;
end;
$$;
revoke all on function public.log_customer_requirement_event() from public,anon,authenticated;

drop trigger if exists customer_requirements_log_created on public.customer_requirements;
create trigger customer_requirements_log_created
after insert on public.customer_requirements
for each row execute function public.log_customer_requirement_event();

drop trigger if exists customer_requirements_log_status on public.customer_requirements;
create trigger customer_requirements_log_status
after update of status on public.customer_requirements
for each row execute function public.log_customer_requirement_event();

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
  target_needed_by date
)
returns public.customer_requirements
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  row_value public.customer_requirements%rowtype;
  key_value text:=btrim(coalesce(requested_idempotency_key,''));
  title_value text:=btrim(coalesce(target_title,''));
  description_value text:=btrim(coalesce(target_description,''));
  mode_value text:=lower(btrim(coalesce(target_service_mode,'')));
  budget_value text:=lower(btrim(coalesce(target_budget_type,'')));
  currency_value text:=upper(btrim(coalesce(target_currency,'INR')));
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

  reference_value:='REQ-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.customer_requirements(
    requirement_reference,idempotency_key,customer_id,category_id,location_id,title,description,
    service_mode,budget_type,budget_min_minor,budget_max_minor,currency,needed_by,status,published_at
  ) values (
    reference_value,key_value,auth.uid(),target_category_id,target_location_id,title_value,description_value,
    mode_value,budget_value,target_budget_min_minor,target_budget_max_minor,currency_value,target_needed_by,'open',now()
  ) returning * into row_value;

  return row_value;
end;
$$;
revoke all on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date) from public,anon;
grant execute on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date) to authenticated;

create or replace function public.customer_update_requirement_status(target_requirement_id uuid,target_status text)
returns public.customer_requirements
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  row_value public.customer_requirements%rowtype;
  status_value text:=lower(btrim(coalesce(target_status,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if status_value not in ('open','paused','fulfilled','cancelled') then raise exception 'Requirement status is invalid.'; end if;

  select * into row_value from public.customer_requirements where id=target_requirement_id for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if row_value.customer_id<>auth.uid() then raise exception 'You can manage only your own requirement.'; end if;
  if row_value.status=status_value then return row_value; end if;
  if row_value.status in ('fulfilled','cancelled') then raise exception 'A closed requirement cannot be reopened.'; end if;
  if row_value.status='open' and status_value not in ('paused','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;
  if row_value.status='paused' and status_value not in ('open','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;

  update public.customer_requirements
  set status=status_value,
      closed_at=case when status_value in ('fulfilled','cancelled') then now() else null end,
      updated_at=now()
  where id=row_value.id
  returning * into row_value;
  return row_value;
end;
$$;
revoke all on function public.customer_update_requirement_status(uuid,text) from public,anon;
grant execute on function public.customer_update_requirement_status(uuid,text) to authenticated;
