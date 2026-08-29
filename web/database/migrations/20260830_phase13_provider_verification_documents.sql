-- Phase 13 Module 4: private provider verification documents with storage-backed evidence.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'provider-verification-documents',
  'provider-verification-documents',
  false,
  8388608,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types,
  updated_at=now();

create table if not exists public.provider_verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_request_id uuid not null references public.provider_verification_requests(id) on delete cascade,
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  object_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  status text not null default 'active' check (status in ('active','deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(original_filename) between 1 and 255),
  check (char_length(object_path) between 10 and 1000)
);
create index if not exists provider_verification_documents_request_created_idx
  on public.provider_verification_documents(verification_request_id,created_at desc);
create index if not exists provider_verification_documents_owner_created_idx
  on public.provider_verification_documents(applicant_user_id,created_at desc);

alter table public.provider_verification_documents enable row level security;

drop policy if exists provider_verification_documents_private_read on public.provider_verification_documents;
create policy provider_verification_documents_private_read
on public.provider_verification_documents for select to authenticated
using (
  applicant_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_view(null,null,null,null)
);

revoke insert,update,delete on public.provider_verification_documents from anon,authenticated;

-- Storage paths are always: <user-id>/<verification-request-id>/<random-file-name>.
drop policy if exists provider_verification_storage_owner_insert on storage.objects;
create policy provider_verification_storage_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='provider-verification-documents'
  and (storage.foldername(name))[1]=auth.uid()::text
  and exists(
    select 1 from public.provider_verification_requests r
    where r.applicant_user_id=auth.uid()
      and r.id::text=(storage.foldername(name))[2]
      and r.status='pending'
  )
);

drop policy if exists provider_verification_storage_private_read on storage.objects;
create policy provider_verification_storage_private_read
on storage.objects for select to authenticated
using (
  bucket_id='provider-verification-documents'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.is_super_admin()
    or public.admin_can_view(null,null,null,null)
  )
);

drop policy if exists provider_verification_storage_owner_delete on storage.objects;
create policy provider_verification_storage_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id='provider-verification-documents'
  and (storage.foldername(name))[1]=auth.uid()::text
  and exists(
    select 1 from public.provider_verification_requests r
    where r.applicant_user_id=auth.uid()
      and r.id::text=(storage.foldername(name))[2]
      and r.status='pending'
  )
);

alter table public.provider_verification_events drop constraint if exists provider_verification_events_event_type_check;
alter table public.provider_verification_events add constraint provider_verification_events_event_type_check
check (event_type in ('submitted','withdrawn','approved','changes_requested','rejected','revoked','document_uploaded','document_removed','document_accessed'));

create or replace function public.register_provider_verification_document(
  target_request_id uuid,
  target_object_path text,
  target_original_filename text
)
returns public.provider_verification_documents
language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare
  req public.provider_verification_requests%rowtype;
  doc public.provider_verification_documents%rowtype;
  object_meta jsonb;
  actual_mime text;
  actual_size bigint;
  expected_prefix text;
  clean_filename text:=btrim(coalesce(target_original_filename,''));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into req from public.provider_verification_requests
  where id=target_request_id and applicant_user_id=auth.uid() and status='pending';
  if not found then raise exception 'Pending verification request was not found.'; end if;
  expected_prefix:=auth.uid()::text || '/' || target_request_id::text || '/';
  if target_object_path is null or left(target_object_path,char_length(expected_prefix))<>expected_prefix then
    raise exception 'Verification document path is invalid.';
  end if;
  if char_length(clean_filename)<1 or char_length(clean_filename)>255 then raise exception 'Document file name is invalid.'; end if;

  select metadata into object_meta from storage.objects
  where bucket_id='provider-verification-documents' and name=target_object_path;
  if object_meta is null then raise exception 'Uploaded verification document was not found.'; end if;
  actual_mime:=coalesce(object_meta->>'mimetype','');
  actual_size:=coalesce(nullif(object_meta->>'size','')::bigint,0);
  if actual_mime not in ('application/pdf','image/jpeg','image/png','image/webp') then raise exception 'Unsupported verification document type.'; end if;
  if actual_size<=0 or actual_size>8388608 then raise exception 'Verification document must be 8 MB or smaller.'; end if;

  insert into public.provider_verification_documents(
    verification_request_id,applicant_user_id,object_path,original_filename,mime_type,size_bytes,status
  ) values(target_request_id,auth.uid(),target_object_path,clean_filename,actual_mime,actual_size,'active')
  on conflict (object_path) do nothing
  returning * into doc;
  if doc.id is null then
    select * into doc from public.provider_verification_documents where object_path=target_object_path and applicant_user_id=auth.uid();
  end if;
  if doc.id is null then raise exception 'Verification document could not be registered.'; end if;

  if not exists(select 1 from public.provider_verification_events where verification_request_id=target_request_id and event_type='document_uploaded' and note=doc.id::text) then
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note)
    values(target_request_id,auth.uid(),'provider','document_uploaded',doc.id::text);
  end if;
  return doc;
end;
$$;
revoke all on function public.register_provider_verification_document(uuid,text,text) from public,anon;
grant execute on function public.register_provider_verification_document(uuid,text,text) to authenticated;

create or replace function public.mark_provider_verification_document_deleted(target_document_id uuid)
returns public.provider_verification_documents
language plpgsql security definer set search_path=public,pg_temp as $$
declare doc public.provider_verification_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select d.* into doc
  from public.provider_verification_documents d
  join public.provider_verification_requests r on r.id=d.verification_request_id
  where d.id=target_document_id and d.applicant_user_id=auth.uid() and d.status='active' and r.status='pending'
  for update of d;
  if not found then raise exception 'Active document for a pending verification request was not found.'; end if;
  if exists(select 1 from storage.objects where bucket_id='provider-verification-documents' and name=doc.object_path) then
    raise exception 'Remove the private storage object before marking the document deleted.';
  end if;
  update public.provider_verification_documents set status='deleted',deleted_at=now() where id=doc.id returning * into doc;
  insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note)
  values(doc.verification_request_id,auth.uid(),'provider','document_removed',doc.id::text);
  return doc;
end;
$$;
revoke all on function public.mark_provider_verification_document_deleted(uuid) from public,anon;
grant execute on function public.mark_provider_verification_document_deleted(uuid) to authenticated;

create or replace function public.record_provider_verification_document_access(target_document_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare doc public.provider_verification_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_view(null,null,null,null)) then raise exception 'Platform review permission is required.'; end if;
  select * into doc from public.provider_verification_documents where id=target_document_id and status='active';
  if not found then raise exception 'Verification document was not found.'; end if;
  insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note)
  values(doc.verification_request_id,auth.uid(),'admin','document_accessed',doc.id::text);
end;
$$;
revoke all on function public.record_provider_verification_document_access(uuid) from public,anon;
grant execute on function public.record_provider_verification_document_access(uuid) to authenticated;

-- Approval requires at least one real private document for new verification requests.
create or replace function public.review_provider_verification(target_request_id uuid, decision text, reviewer_note text default null)
returns public.provider_verification_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.provider_verification_requests%rowtype; note_value text:=nullif(btrim(coalesce(reviewer_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform manage permission is required.'; end if;
  if decision not in ('approve','changes_requested','reject') then raise exception 'Choose approve, changes_requested, or reject.'; end if;
  if decision<>'approve' and (note_value is null or char_length(note_value)<3) then raise exception 'A review reason is required.'; end if;
  if note_value is not null and char_length(note_value)>1200 then raise exception 'Review note must be 1200 characters or fewer.'; end if;
  select * into req from public.provider_verification_requests where id=target_request_id and status='pending' for update;
  if not found then raise exception 'Pending verification request was not found.'; end if;
  if req.applicant_user_id=auth.uid() then raise exception 'You cannot review your own verification request.'; end if;

  if decision='approve' then
    if not exists(select 1 from public.provider_verification_documents d where d.verification_request_id=req.id and d.status='active') then
      raise exception 'At least one private verification document is required before approval.';
    end if;
    if req.provider_type='professional' then update public.professional_profiles set verified=true,updated_at=now() where id=req.professional_id and user_id=req.applicant_user_id;
    else update public.businesses set verified=true,updated_at=now() where id=req.business_id and owner_user_id=req.applicant_user_id; end if;
    update public.provider_verification_requests set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','approved',coalesce(note_value,'Verification approved.'));
    insert into public.notifications(recipient_user_id,event_type,title,body) values(req.applicant_user_id,'provider_verification_approved','Provider verified','Your provider verification is approved. You can now publish launch-ready services.');
  elsif decision='changes_requested' then
    update public.provider_verification_requests set status='changes_requested',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','changes_requested',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body) values(req.applicant_user_id,'provider_verification_changes','Verification needs changes',note_value);
  else
    update public.provider_verification_requests set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','rejected',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body) values(req.applicant_user_id,'provider_verification_rejected','Verification not approved',note_value);
  end if;
  return req;
end;
$$;
revoke all on function public.review_provider_verification(uuid,text,text) from public,anon;
grant execute on function public.review_provider_verification(uuid,text,text) to authenticated;
