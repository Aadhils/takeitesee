-- Phase 15 controlled Cashfree sandbox E2E evidence ledger.
-- This table is intentionally isolated from booking/payment/settlement finance ledgers.

create table if not exists public.cashfree_sandbox_e2e_runs (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  amount_minor bigint not null default 100 check (amount_minor > 0),
  currency text not null default 'INR' check (char_length(currency) between 3 and 8),
  state text not null default 'creating' check (state in (
    'creating',
    'ready_for_checkout',
    'webhook_received',
    'payment_succeeded',
    'payment_failed',
    'user_dropped',
    'verified_success',
    'verified_failure',
    'verified_user_dropped',
    'verified_pending',
    'mismatch',
    'failed'
  )),
  gateway_order_status text,
  gateway_payment_id text,
  gateway_payment_status text,
  webhook_event_id uuid references public.payment_gateway_webhook_events(id) on delete set null,
  last_error_code text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  webhook_received_at timestamptz,
  verified_at timestamptz,
  check (char_length(order_id) between 8 and 80),
  check (gateway_order_status is null or char_length(gateway_order_status) <= 80),
  check (gateway_payment_id is null or char_length(gateway_payment_id) <= 160),
  check (gateway_payment_status is null or char_length(gateway_payment_status) <= 80),
  check (last_error_code is null or char_length(last_error_code) <= 120)
);

create index if not exists cashfree_sandbox_e2e_runs_created_idx
  on public.cashfree_sandbox_e2e_runs(created_at desc);

alter table public.cashfree_sandbox_e2e_runs enable row level security;

-- No browser role may read or mutate sandbox gateway evidence directly.
-- Super Admin access is mediated by server routes using the service role.
revoke all on public.cashfree_sandbox_e2e_runs from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.cashfree_sandbox_e2e_runs', 'select')
     or has_table_privilege('authenticated', 'public.cashfree_sandbox_e2e_runs', 'select') then
    raise exception 'Sandbox E2E evidence must not be directly readable by browser roles.';
  end if;
end;
$$;
