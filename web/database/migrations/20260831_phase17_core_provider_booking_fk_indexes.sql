-- Phase 17: add covering indexes for core non-finance Provider/booking foreign keys.
--
-- Supabase Performance Advisor identified these foreign keys as unindexed. They are also used by
-- Provider-owned booking/review authorization joins. Add simple btree indexes with the FK column as
-- the leading key without changing RLS policies, booking state, or application behavior.
--
-- Cashfree, payment, cash-collection, refund, payout, recovery, settlement, and finance columns,
-- indexes, activation, state, and configuration remain HOLD and are intentionally untouched.

create index if not exists bookings_business_id_idx
  on public.bookings using btree (business_id);

create index if not exists bookings_professional_id_idx
  on public.bookings using btree (professional_id);

create index if not exists businesses_owner_user_id_idx
  on public.businesses using btree (owner_user_id);
