-- Business Product Primary Image Foundation
--
-- Product images remain private in Supabase Storage in this slice.
-- Business owners may upload/list/delete only within their own exact Product path.
-- The stored path is review-sensitive: changing/removing the image increments the
-- Product review revision, so an old approval can never publish changed media.
-- Public image presentation is intentionally deferred to the next focused slice.
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery/recurrence remain untouched.

alter table public.business_products
  add column if not exists primary_image_object_path text;

alter table public.business_products
  drop constraint if exists business_products_primary_image_path_check;
alter table public.business_products
  add constraint business_products_primary_image_path_check check (
    primary_image_object_path is null
    or primary_image_object_path ~ (
      '^business/' || business_id::text || '/product/' || id::text || '/[0-9A-Fa-f-]{36}\.(jpg|png|webp)$'
    )
  );

comment on column public.business_products.primary_image_object_path is
  'Private Storage object path for the Business product primary image. Changes are review-sensitive and require current-revision approval before public presentation.';

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'business-product-media',
  'business-product-media',
  false,
  6291456,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object path: business/{businessId}/product/{productId}/{uuid}.{jpg|png|webp}
-- Public reads are intentionally absent because draft/unapproved images must not leak.
drop policy if exists business_product_media_owner_insert on storage.objects;
create policy business_product_media_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-product-media'
  and array_length(storage.foldername(storage.objects.name), 1) = 4
  and (storage.foldername(storage.objects.name))[1] = 'business'
  and (storage.foldername(storage.objects.name))[3] = 'product'
  and storage.objects.name ~ '^business/[0-9A-Fa-f-]{36}/product/[0-9A-Fa-f-]{36}/[0-9A-Fa-f-]{36}\.(jpg|png|webp)$'
  and exists (
    select 1
    from public.business_products p
    join public.businesses b on b.id = p.business_id
    where p.id::text = (storage.foldername(storage.objects.name))[4]
      and p.business_id::text = (storage.foldername(storage.objects.name))[2]
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
  and array_length(storage.foldername(storage.objects.name), 1) = 4
  and (storage.foldername(storage.objects.name))[1] = 'business'
  and (storage.foldername(storage.objects.name))[3] = 'product'
  and exists (
    select 1
    from public.business_products p
    join public.businesses b on b.id = p.business_id
    where p.id::text = (storage.foldername(storage.objects.name))[4]
      and p.business_id::text = (storage.foldername(storage.objects.name))[2]
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
  and array_length(storage.foldername(storage.objects.name), 1) = 4
  and (storage.foldername(storage.objects.name))[1] = 'business'
  and (storage.foldername(storage.objects.name))[3] = 'product'
  and exists (
    select 1
    from public.business_products p
    join public.businesses b on b.id = p.business_id
    where p.id::text = (storage.foldername(storage.objects.name))[4]
      and p.business_id::text = (storage.foldername(storage.objects.name))[2]
      and b.owner_user_id = (select auth.uid())
  )
);

-- A direct Data API INSERT may create ordinary catalog fields, but never inject a
-- Storage path/review revision/id/timestamp. The media API persists the path only
-- after authenticated ownership and uploaded-object checks.
revoke insert on table public.business_products from authenticated;
grant insert (business_id,name,description,sku,price,currency,unit_label,stock_mode,status)
  on public.business_products to authenticated;

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
    new.primary_image_object_path := null;
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
