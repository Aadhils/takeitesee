-- Universal Services Ecosystem: post-merge advisor hardening for recurring occurrence recovery.
-- Optimize the customer RLS predicate and cover recovery foreign keys used by referential checks.
-- No payment, Cashfree, payout, refund, settlement or reconciliation behavior is changed.

create index if not exists requirement_occurrence_recoveries_prior_booking_idx
  on public.requirement_occurrence_recoveries(prior_booking_id);

create index if not exists requirement_occurrence_recoveries_prior_proposal_idx
  on public.requirement_occurrence_recoveries(prior_proposal_id);

create index if not exists requirement_occurrence_recoveries_replacement_booking_idx
  on public.requirement_occurrence_recoveries(replacement_booking_id);

create index if not exists requirement_occurrence_recoveries_created_by_idx
  on public.requirement_occurrence_recoveries(created_by);

drop policy if exists requirement_occurrence_recoveries_customer_read on public.requirement_occurrence_recoveries;
create policy requirement_occurrence_recoveries_customer_read
on public.requirement_occurrence_recoveries
for select to authenticated
using (
  exists(
    select 1
    from public.customer_requirements r
    where r.id=requirement_occurrence_recoveries.requirement_id
      and r.customer_id=(select auth.uid())
  )
);
