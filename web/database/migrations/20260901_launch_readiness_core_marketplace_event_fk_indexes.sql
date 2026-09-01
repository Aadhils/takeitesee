-- Launch readiness: add covering indexes for core non-finance marketplace event/history foreign keys.
--
-- Supabase Performance Advisor and a live catalog check identified these foreign keys as lacking
-- covering indexes. Add simple btree indexes for booking status history, requirement events,
-- proposal events, and review ownership joins without changing RLS, data, workflow state, or behavior.
--
-- Cashfree, payment, cash-collection, refund, payout, recovery, settlement, and finance tables,
-- columns, indexes, activation, state, configuration, functions, and policies remain HOLD and are
-- intentionally untouched.

create index if not exists booking_status_history_changed_by_idx
  on public.booking_status_history using btree (changed_by);

create index if not exists customer_requirement_events_actor_user_id_idx
  on public.customer_requirement_events using btree (actor_user_id);

create index if not exists requirement_proposal_events_actor_user_id_idx
  on public.requirement_proposal_events using btree (actor_user_id);

create index if not exists reviews_customer_id_idx
  on public.reviews using btree (customer_id);
