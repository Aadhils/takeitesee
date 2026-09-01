-- Launch readiness: quarantine the known synthetic marketplace fixture from public discovery.
--
-- Preserve the Business, service, and existing bookings for authenticated internal testing, but
-- stop presenting the explicitly synthetic test fixture as a verified live marketplace listing.
-- The guards intentionally match the known fixture ids and authored test labels so this migration
-- becomes a no-op if the fixture has already been renamed/replaced or removed.
--
-- Cashfree, payment, cash-collection, refund, payout, recovery, settlement, and finance activation,
-- state, data, and configuration remain HOLD and are intentionally untouched.

update public.services
set
  active = false,
  status = 'paused',
  updated_at = now()
where id = 'e07dfd13-9a59-4111-9e8d-e3426d243543'::uuid
  and business_id = '2dede740-9d64-4b93-95b9-746105a73234'::uuid
  and name = 'Test home service visit'
  and active = true
  and status = 'active';

update public.businesses
set
  verified = false,
  updated_at = now()
where id = '2dede740-9d64-4b93-95b9-746105a73234'::uuid
  and name = 'Takeitesee Test Business'
  and description = 'Synthetic business record for testing only.'
  and verified = true;
