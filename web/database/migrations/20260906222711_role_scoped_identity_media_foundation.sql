-- Product: Role-scoped dashboard identity media foundation.
-- Customer, Professional and Business identities each keep independent avatar/banner media.
-- Objects live in one private bucket and are owner-uploadable only under exact role-scoped paths.
-- Public profile synchronization is intentionally outside this slice.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'identity-media',
  'identity-media',
  false,
  6291456,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types,
  updated_at=now();

alter table public.customer_profiles
  add column if not exists avatar_object_path text,
  add column if not exists banner_object_path text;

alter table public.professional_profiles
  add column if not exists avatar_object_path text,
  add column if not exists banner_object_path text;

alter table public.businesses
  add column if not exists avatar_object_path text,
  add column if not exists banner_object_path text;

comment on column public.customer_profiles.avatar_object_path is
  'Private identity-media object path for the personal Customer avatar.';
comment on column public.customer_profiles.banner_object_path is
  'Private identity-media object path for the personal Customer dashboard banner.';
comment on column public.professional_profiles.avatar_object_path is
  'Private identity-media object path for the Professional avatar; independent from Customer and Business media.';
comment on column public.professional_profiles.banner_object_path is
  'Private identity-media object path for the Professional dashboard banner; independent from Customer and Business media.';
comment on column public.businesses.avatar_object_path is
  'Private identity-media object path for the Business logo/profile image; independent from Customer and Professional media.';
comment on column public.businesses.banner_object_path is
  'Private identity-media object path for the Business dashboard banner; independent from Customer and Professional media.';

-- Exact path shape: <auth-user-id>/<customer|professional|business>/<entity-id>/<avatar|banner>/<random-file-name>.
-- For Customer identity, entity-id is the auth user id. Provider entity ids are checked against owned rows.
drop policy if exists identity_media_owner_insert on storage.objects;
create policy identity_media_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='identity-media'
  and array_length(storage.foldername(name),1)=4
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[4] in ('avatar','banner')
  and (
    (
      (storage.foldername(name))[2]='customer'
      and (storage.foldername(name))[3]=(select auth.uid())::text
    )
    or (
      (storage.foldername(name))[2]='professional'
      and exists (
        select 1
        from public.professional_profiles profile
        where profile.id::text=(storage.foldername(name))[3]
          and profile.user_id=(select auth.uid())
      )
    )
    or (
      (storage.foldername(name))[2]='business'
      and exists (
        select 1
        from public.businesses business
        where business.id::text=(storage.foldername(name))[3]
          and business.owner_user_id=(select auth.uid())
      )
    )
  )
);

drop policy if exists identity_media_owner_delete on storage.objects;
create policy identity_media_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='identity-media'
  and array_length(storage.foldername(name),1)=4
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[4] in ('avatar','banner')
  and (
    (
      (storage.foldername(name))[2]='customer'
      and (storage.foldername(name))[3]=(select auth.uid())::text
    )
    or (
      (storage.foldername(name))[2]='professional'
      and exists (
        select 1
        from public.professional_profiles profile
        where profile.id::text=(storage.foldername(name))[3]
          and profile.user_id=(select auth.uid())
      )
    )
    or (
      (storage.foldername(name))[2]='business'
      and exists (
        select 1
        from public.businesses business
        where business.id::text=(storage.foldername(name))[3]
          and business.owner_user_id=(select auth.uid())
      )
    )
  )
);
