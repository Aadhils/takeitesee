-- Business Product Primary Image Foundation
--
-- Product media remains private at this stage. Public signed-image presentation
-- is introduced separately only for products already visible through current
-- revision-bound marketplace RLS.
--
-- No cart, checkout, payment, Cashfree, refund, payout, settlement,
-- reconciliation, recovery or recurrence behavior is introduced here.

alter table public.business_products
  add column if not exists primary_image_object_path text;

alter table public.business_products
  drop constraint if exists business_products_primary_image_object_path_check;
alter table public.business_products
  add constraint business_products_primary_image_object_path_check check (
    primary_image_object_path is null
    or primary_image_object_path ~* (
      '^business/' || business_id::text || '/product/' || id::text ||
      '/primary/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    )
  );

comment on column public.business_products.primary_image_object_path is
  'Private Storage object path for the review-sensitive primary product image. Public presentation must use an approved-product server-signed URL.';

grant update (primary_image_object_path) on public.business_products to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-product-media',
  'business-product-media',
  false,
  6291456,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Product image changes are review-sensitive. Existing stale-launch withdrawal
-- trigger observes review_revision changes and withdraws pending stale reviews.
create or replace function public.touch_business_product()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.sku := nullif(upper(btrim(coalesce(new.sku, ''))), '');
  new.currency := upper(btrim(new.currency));
  new.unit_label := btrim(new.unit_label);

  if tg_op = 'INSERT' then
    new.review_revision := 1;
  elsif new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.sku is distinct from old.sku
     or new.price is distinct from old.price
     or new.currency is distinct from old.currency
     or new.unit_label is distinct from old.unit_label
     or new.primary_image_object_path is distinct from old.primary_image_object_path then
    new.review_revision := old.review_revision + 1;
  else
    new.review_revision := old.review_revision;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_business_product() from public, anon, authenticated;

-- Private product-media objects are owner-managed only. No UPDATE policy is
-- provided; clients use unique object names and upsert=false.
drop policy if exists business_product_media_owner_insert on storage.objects;
create policy business_product_media_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-product-media'
  and array_length(storage.foldername(name), 1) = 5
  and (storage.foldername(name))[1] = 'business'
  and (storage.foldername(name))[3] = 'product'
  and (storage.foldername(name))[5] = 'primary'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.business_products p
    join public.businesses b on b.id = p.business_id
    where p.business_id::text = (storage.foldername(name))[2]
      and p.id::text = (storage.foldername(name))[4]
      and b.owner_user_id = (select auth.uid())
  )
);

drop policy if exists business_product_media_owner_select on storage.objects;
create policy business_product_media_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-product-media'
  and array_length(storage.foldername(name), 1) = 5
  and (storage.foldername(name))[1] = 'business'
  and (storage.foldername(name))[3] = 'product'
  and (storage.foldername(name))[5] = 'primary'
  and exists (
    select 1
    from public.business_products p
    join public.businesses b on b.id = p.business_id
    where p.business_id::text = (storage.foldername(name))[2]
      and p.id::text = (storage.foldername(name))[4]
      and b.owner_user_id = (select auth.uid())
  )
);

drop policy if exists business_product_media_owner_delete on storage.objects;
create policy business_product_media_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-product-media'
  and array_length(storage.foldername(name), 1) = 5
  and (storage.foldername(name))[1] = 'business'
  and (storage.foldername(name))[3] = 'product'
  and (storage.foldername(name))[5] = 'primary'
  and exists (
    select 1
    from public.business_products p
    join public.businesses b on b.id = p.business_id
    where p.business_id::text = (storage.foldername(name))[2]
      and p.id::text = (storage.foldername(name))[4]
      and b.owner_user_id = (select auth.uid())
  )
);
