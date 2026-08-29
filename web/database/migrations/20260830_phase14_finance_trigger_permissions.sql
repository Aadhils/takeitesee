-- Finance settlement reconciliation runs only as a bookings trigger.
-- It is not a client-facing RPC.
revoke all on function public.bookings_reconcile_finance_settlement() from public,anon,authenticated;
