-- Fix Business identity-media storage ownership checks by explicitly qualifying the
-- outer storage.objects.name reference inside Provider ownership subqueries.
-- Without qualification, public.businesses.name shadows the storage object name.

drop policy if exists identity_media_owner_insert on storage.objects;
create policy identity_media_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=4
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[4] in ('avatar','banner')
  and (
    ((storage.foldername(storage.objects.name))[2]='customer' and (storage.foldername(storage.objects.name))[3]=(select auth.uid())::text)
    or ((storage.foldername(storage.objects.name))[2]='professional' and exists (
      select 1 from public.professional_profiles profile
      where profile.id::text=(storage.foldername(storage.objects.name))[3]
        and profile.user_id=(select auth.uid())
    ))
    or ((storage.foldername(storage.objects.name))[2]='business' and exists (
      select 1 from public.businesses business
      where business.id::text=(storage.foldername(storage.objects.name))[3]
        and business.owner_user_id=(select auth.uid())
    ))
  )
);

drop policy if exists identity_media_owner_select on storage.objects;
create policy identity_media_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id='identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=4
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[4] in ('avatar','banner')
  and (
    ((storage.foldername(storage.objects.name))[2]='customer' and (storage.foldername(storage.objects.name))[3]=(select auth.uid())::text)
    or ((storage.foldername(storage.objects.name))[2]='professional' and exists (
      select 1 from public.professional_profiles profile
      where profile.id::text=(storage.foldername(storage.objects.name))[3]
        and profile.user_id=(select auth.uid())
    ))
    or ((storage.foldername(storage.objects.name))[2]='business' and exists (
      select 1 from public.businesses business
      where business.id::text=(storage.foldername(storage.objects.name))[3]
        and business.owner_user_id=(select auth.uid())
    ))
  )
);

drop policy if exists identity_media_owner_delete on storage.objects;
create policy identity_media_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=4
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[4] in ('avatar','banner')
  and (
    ((storage.foldername(storage.objects.name))[2]='customer' and (storage.foldername(storage.objects.name))[3]=(select auth.uid())::text)
    or ((storage.foldername(storage.objects.name))[2]='professional' and exists (
      select 1 from public.professional_profiles profile
      where profile.id::text=(storage.foldername(storage.objects.name))[3]
        and profile.user_id=(select auth.uid())
    ))
    or ((storage.foldername(storage.objects.name))[2]='business' and exists (
      select 1 from public.businesses business
      where business.id::text=(storage.foldername(storage.objects.name))[3]
        and business.owner_user_id=(select auth.uid())
    ))
  )
);
