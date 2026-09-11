-- Stable canonical Service category identity for marketplace discovery.
-- Display labels remain in services.category; machine identity lives in category_code.
-- Legacy/group-level values are never guessed into a leaf category.
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery untouched.
-- Recurrence/recovery remain frozen.

alter table public.services add column if not exists category_code text;

alter table public.services drop constraint if exists services_category_code_not_blank;
alter table public.services add constraint services_category_code_not_blank
  check (category_code is null or btrim(category_code) <> '');

-- Safe legacy backfill: exact active public taxonomy leaf name only.
-- A group value such as "Home Services" intentionally remains null.
update public.services s
set category_code = tx.category_code
from public.marketplace_search_taxonomy_public tx
where s.category_code is null
  and lower(regexp_replace(btrim(coalesce(s.category,'')), '\s+', ' ', 'g'))
    = lower(regexp_replace(btrim(tx.category_name), '\s+', ' ', 'g'));

create index if not exists services_marketplace_category_code_idx
  on public.services(category_code)
  where active=true
    and status='active'::public.service_status
    and category_code is not null;

comment on column public.services.category_code is
  'Stable canonical Services leaf taxonomy code for marketplace discovery. Display label remains services.category; legacy rows may remain null until canonically resolved.';
