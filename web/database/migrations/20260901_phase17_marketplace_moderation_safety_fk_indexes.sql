-- Phase 17: add covering indexes for non-finance marketplace moderation and safety foreign keys.
--
-- Supabase Performance Advisor identified these foreign keys as unindexed. Add simple btree
-- indexes for moderation, requirement-job, issue-reporter, and user-block joins without changing
-- RLS, data, marketplace state, or application behavior.
--
-- Cashfree, payment, cash-collection, refund, payout, recovery, settlement, and finance columns,
-- indexes, activation, state, and configuration remain HOLD and are intentionally untouched.

create index if not exists marketplace_issues_reported_by_idx
  on public.marketplace_issues using btree (reported_by);

create index if not exists marketplace_moderation_report_events_actor_user_id_idx
  on public.marketplace_moderation_report_events using btree (actor_user_id);

create index if not exists marketplace_moderation_reports_handled_by_idx
  on public.marketplace_moderation_reports using btree (handled_by);

create index if not exists marketplace_moderation_reports_reported_user_id_idx
  on public.marketplace_moderation_reports using btree (reported_user_id);

create index if not exists marketplace_requirement_jobs_created_by_idx
  on public.marketplace_requirement_jobs using btree (created_by);

create index if not exists marketplace_user_blocks_blocked_user_id_idx
  on public.marketplace_user_blocks using btree (blocked_user_id);
