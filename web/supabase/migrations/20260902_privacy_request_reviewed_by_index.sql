-- Phase 18 follow-up: cover the privacy request reviewer foreign key.
-- Non-finance only; no account deletion or finance/payment behavior changes.

create index if not exists privacy_requests_reviewed_by_idx
  on public.privacy_requests(reviewed_by);
