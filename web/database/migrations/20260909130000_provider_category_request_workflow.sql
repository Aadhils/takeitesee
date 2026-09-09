-- Provider category request governance.
-- Providers may suggest missing taxonomy entries, but only Super Admin approval can create a canonical platform category.

create table if not exists public.provider_category_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users(id) on delete cascade,
  provider_type text not null check (provider_type in ('professional','business')),
  application_id uuid not null references public.platform_applications(id) on delete restrict,
  suggested_parent_category_id uuid references public.platform_categories(id) on delete set null,
  requested_name text not null,
  requested_description text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_category_id uuid references public.platform_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(requested_name)) between 2 and 100),
  check (requested_description is null or char_length(requested_description) <= 1000),
  check (review_note is null or char_length(review_note) <= 1000)
);

create index if not exists provider_category_requests_requester_created_idx
  on public.provider_category_requests(requester_user_id, created_at desc);
create index if not exists provider_category_requests_status_created_idx
  on public.provider_category_requests(status, created_at desc);
create unique index if not exists provider_category_requests_one_pending_name_idx
  on public.provider_category_requests(requester_user_id, application_id, lower(btrim(requested_name)))
  where status='pending';

alter table public.provider_category_requests enable row level security;

revoke all on public.provider_category_requests from anon, authenticated;
grant select, insert, update on public.provider_category_requests to authenticated;

create or replace function private.provider_category_request_insert_allowed(
  requested_provider_type text,
  target_application_id uuid,
  target_parent_category_id uuid,
  target_name text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null
    and lower(btrim(coalesce(requested_provider_type,''))) in ('professional','business')
    and (
      (lower(btrim(coalesce(requested_provider_type,'')))='professional' and exists(
        select 1 from public.professional_profiles p where p.user_id=auth.uid()
      ))
      or
      (lower(btrim(coalesce(requested_provider_type,'')))='business' and exists(
        select 1 from public.businesses b where b.owner_user_id=auth.uid()
      ))
    )
    and exists(
      select 1 from public.platform_applications a
      where a.id=target_application_id and a.status='active'
    )
    and (
      target_parent_category_id is null
      or exists(
        select 1 from public.platform_categories c
        where c.id=target_parent_category_id
          and c.application_id=target_application_id
          and c.active=true
      )
    )
    and not exists(
      select 1 from public.platform_categories c
      where c.application_id=target_application_id
        and lower(btrim(c.name))=lower(btrim(coalesce(target_name,'')))
    );
$$;

revoke all on function private.provider_category_request_insert_allowed(text,uuid,uuid,text) from public,anon;
grant execute on function private.provider_category_request_insert_allowed(text,uuid,uuid,text) to authenticated;

drop policy if exists provider_category_requests_private_read on public.provider_category_requests;
create policy provider_category_requests_private_read on public.provider_category_requests
for select to authenticated using (
  requester_user_id=(select auth.uid()) or (select private.is_super_admin())
);

drop policy if exists provider_category_requests_provider_insert on public.provider_category_requests;
create policy provider_category_requests_provider_insert on public.provider_category_requests
for insert to authenticated with check (
  requester_user_id=(select auth.uid())
  and status='pending'
  and reviewed_by is null
  and reviewed_at is null
  and created_category_id is null
  and (select private.provider_category_request_insert_allowed(provider_type,application_id,suggested_parent_category_id,requested_name))
);

drop policy if exists provider_category_requests_super_update on public.provider_category_requests;
create policy provider_category_requests_super_update on public.provider_category_requests
for update to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

create or replace function public.submit_provider_category_request(
  requested_provider_type text,
  target_application_id uuid,
  target_parent_category_id uuid,
  requested_name text,
  requested_description text
)
returns public.provider_category_requests
language plpgsql
security invoker
set search_path=''
as $$
declare
  req public.provider_category_requests%rowtype;
  provider_type_value text:=lower(btrim(coalesce(requested_provider_type,'')));
  name_value text:=btrim(coalesce(requested_name,''));
  description_value text:=nullif(btrim(coalesce(requested_description,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if provider_type_value not in ('professional','business') then raise exception 'Provider type must be professional or business.'; end if;
  if char_length(name_value)<2 or char_length(name_value)>100 then raise exception 'Category name must be 2 to 100 characters.'; end if;
  if description_value is not null and char_length(description_value)>1000 then raise exception 'Category description must be 1000 characters or fewer.'; end if;

  if not private.provider_category_request_insert_allowed(provider_type_value,target_application_id,target_parent_category_id,name_value) then
    raise exception 'The category request is not valid for this Provider workspace or platform application.';
  end if;

  if exists(
    select 1 from public.provider_category_requests r
    where r.requester_user_id=auth.uid()
      and r.application_id=target_application_id
      and r.status='pending'
      and lower(btrim(r.requested_name))=lower(name_value)
  ) then
    raise exception 'A matching category request is already pending review.';
  end if;

  insert into public.provider_category_requests(
    requester_user_id,provider_type,application_id,suggested_parent_category_id,
    requested_name,requested_description,status
  ) values (
    auth.uid(),provider_type_value,target_application_id,target_parent_category_id,
    name_value,description_value,'pending'
  ) returning * into req;

  return req;
end;
$$;

revoke all on function public.submit_provider_category_request(text,uuid,uuid,text,text) from public,anon;
grant execute on function public.submit_provider_category_request(text,uuid,uuid,text,text) to authenticated;

create or replace function public.review_provider_category_request(
  target_request_id uuid,
  decision text,
  final_category_name text,
  final_category_code text,
  final_parent_category_id uuid,
  note text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  req public.provider_category_requests%rowtype;
  decision_value text:=lower(btrim(coalesce(decision,'')));
  name_value text:=btrim(coalesce(final_category_name,''));
  code_value text:=lower(btrim(coalesce(final_category_code,'')));
  note_value text:=nullif(btrim(coalesce(note,'')),'');
  created_category_id_value uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_super_admin() then raise exception 'Super Admin access required.'; end if;
  if decision_value not in ('approve','reject') then raise exception 'Decision must be approve or reject.'; end if;
  if note_value is not null and char_length(note_value)>1000 then raise exception 'Review note must be 1000 characters or fewer.'; end if;

  select * into req
  from public.provider_category_requests
  where id=target_request_id
  for update;

  if req.id is null then raise exception 'Category request was not found.'; end if;
  if req.status<>'pending' then raise exception 'Only pending category requests can be reviewed.'; end if;

  if decision_value='approve' then
    if char_length(name_value)<2 or char_length(name_value)>100 then raise exception 'Final category name must be 2 to 100 characters.'; end if;
    if code_value !~ '^[a-z0-9][a-z0-9_-]{1,62}$' then raise exception 'Final category code is invalid.'; end if;
    if not exists(select 1 from public.platform_applications a where a.id=req.application_id and a.status='active') then raise exception 'The requested application is not active.'; end if;
    if final_parent_category_id is not null and not exists(
      select 1 from public.platform_categories c
      where c.id=final_parent_category_id
        and c.application_id=req.application_id
        and c.active=true
    ) then
      raise exception 'Final parent category is not available for this application.';
    end if;
    if exists(
      select 1 from public.platform_categories c
      where c.application_id=req.application_id
        and (lower(btrim(c.name))=lower(name_value) or c.code=code_value)
    ) then
      raise exception 'A category with this name or code already exists in the application.';
    end if;

    insert into public.platform_categories(
      application_id,parent_id,name,code,description,active
    ) values (
      req.application_id,final_parent_category_id,name_value,code_value,req.requested_description,true
    ) returning id into created_category_id_value;

    update public.provider_category_requests
    set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),
        created_category_id=created_category_id_value,updated_at=now()
    where id=req.id;

    insert into public.admin_audit_log(
      actor_user_id,action,resource_type,resource_id,application_id,category_id,metadata
    ) values (
      auth.uid(),'category_request.approved','provider_category_request',req.id,
      req.application_id,created_category_id_value,
      jsonb_build_object('requested_name',req.requested_name,'final_name',name_value,'code',code_value,'parent_id',final_parent_category_id,'provider_type',req.provider_type)
    );

    return jsonb_build_object('request_id',req.id,'status','approved','category_id',created_category_id_value);
  end if;

  update public.provider_category_requests
  set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  where id=req.id;

  insert into public.admin_audit_log(
    actor_user_id,action,resource_type,resource_id,application_id,metadata
  ) values (
    auth.uid(),'category_request.rejected','provider_category_request',req.id,
    req.application_id,
    jsonb_build_object('requested_name',req.requested_name,'provider_type',req.provider_type,'review_note',note_value)
  );

  return jsonb_build_object('request_id',req.id,'status','rejected');
end;
$$;

revoke all on function public.review_provider_category_request(uuid,text,text,text,uuid,text) from public,anon;
grant execute on function public.review_provider_category_request(uuid,text,text,text,uuid,text) to authenticated;
