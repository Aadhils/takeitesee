-- Re-quarantine the known synthetic production acceptance fixture after non-finance smoke testing.
-- Preserve the Business row, service rows, bookings, and audit/history for internal acceptance evidence,
-- but stop presenting this exact synthetic fixture as a verified live marketplace listing.
--
-- Guards intentionally bind to the known synthetic Business id/name/description.
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD.
-- Recurrence/recovery remains FROZEN.

update public.services
set
  active = false,
  status = 'paused',
  updated_at = now()
where business_id = '2dede740-9d64-4b93-95b9-746105a73234'::uuid
  and active = true
  and status = 'active'
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.name = 'Takeitesee Test Business'
      and b.description = 'Synthetic business record for testing only.'
  );

update public.businesses
set
  verified = false,
  updated_at = now()
where id = '2dede740-9d64-4b93-95b9-746105a73234'::uuid
  and name = 'Takeitesee Test Business'
  and description = 'Synthetic business record for testing only.'
  and verified = true;
