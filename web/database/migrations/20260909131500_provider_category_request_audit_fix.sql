-- Align Provider category request approval audit writes with the current admin_audit_log schema.
-- The category identifier is retained in metadata because admin_audit_log no longer has a category_id column.

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
      actor_user_id,action,resource_type,resource_id,application_id,metadata
    ) values (
      auth.uid(),'category_request.approved','provider_category_request',req.id::text,
      req.application_id,
      jsonb_build_object(
        'category_id',created_category_id_value,
        'requested_name',req.requested_name,
        'final_name',name_value,
        'code',code_value,
        'parent_id',final_parent_category_id,
        'provider_type',req.provider_type
      )
    );

    return jsonb_build_object('request_id',req.id,'status','approved','category_id',created_category_id_value);
  end if;

  update public.provider_category_requests
  set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  where id=req.id;

  insert into public.admin_audit_log(
    actor_user_id,action,resource_type,resource_id,application_id,metadata
  ) values (
    auth.uid(),'category_request.rejected','provider_category_request',req.id::text,
    req.application_id,
    jsonb_build_object('requested_name',req.requested_name,'provider_type',req.provider_type,'review_note',note_value)
  );

  return jsonb_build_object('request_id',req.id,'status','rejected');
end;
$$;

revoke all on function public.review_provider_category_request(uuid,text,text,text,uuid,text) from public,anon;
grant execute on function public.review_provider_category_request(uuid,text,text,text,uuid,text) to authenticated;
