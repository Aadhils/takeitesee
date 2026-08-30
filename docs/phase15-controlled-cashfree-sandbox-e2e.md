# Phase 15 — Controlled Cashfree Sandbox E2E

## Purpose

Validate Cashfree hosted checkout, signed payment webhook delivery, and independent gateway verification before any production payment or INR finance activation.

This flow is deliberately isolated from Takeitesee booking, customer payment, settlement, commission, refund, recovery, and payout ledgers.

## Safety invariants

- Super Admin only.
- Cashfree Payments must be configured and must be in `sandbox` mode.
- Production mode hard-blocks probe creation and verification.
- Probe amount is fixed at INR 1.00.
- Probe order IDs always start with `tis_probe_`.
- The dedicated webhook accepts only valid Cashfree signatures and known probe order IDs.
- Sandbox probe webhooks never call booking payment reconciliation functions.
- Browser roles have no direct access to the sandbox E2E evidence table.
- The payment session ID is returned only to the authenticated Super Admin browser that creates the probe and is not persisted in the database.
- No card, UPI PIN, OTP, bank credential, customer payment credential, or raw Cashfree secret is stored.
- Amount/currency/order mismatches fail closed as `mismatch`.

## Components

### Evidence ledger

`public.cashfree_sandbox_e2e_runs`

Stores only operational test evidence:

- probe run ID
- Cashfree sandbox order ID
- expected amount/currency
- local run state
- Cashfree order/payment status
- gateway payment ID
- signed webhook receipt timestamp/reference
- independent verification timestamp
- sanitized error code
- Super Admin actor ID

RLS is enabled and no browser policy exists. `anon` and `authenticated` have no direct table grants.

### Super Admin API

`GET /api/super-admin/sandbox-e2e`

Returns recent probe evidence and whether the sandbox runner is unlocked.

`POST /api/super-admin/sandbox-e2e`

Actions:

- `create_checkout_probe`
  - creates an isolated INR 1.00 Cashfree sandbox order
  - returns the short-lived payment session ID to the caller
  - uses the dedicated sandbox probe webhook as `notify_url`
- `verify_probe`
  - fetches the order and payment attempts from Cashfree
  - validates order identity, amount, and currency
  - records a sanitized independent verification result

### Dedicated signed webhook

`POST /api/payments/cashfree/sandbox-probe-webhook`

- available only while Cashfree mode is `sandbox`
- verifies the raw request body using Cashfree timestamp/signature headers
- accepts only `tis_probe_...` orders already present in the probe ledger
- records a minimal sanitized webhook event using the existing append-only gateway webhook inbox
- updates only the sandbox E2E run
- never mutates booking or finance ledgers

### Super Admin UI

`/super-admin/finance`

The Controlled Sandbox E2E panel:

1. creates the INR 1.00 sandbox checkout probe,
2. opens Cashfree hosted checkout in a separate tab,
3. surfaces signed webhook evidence,
4. independently verifies Cashfree order/payment state,
5. shows mismatch/failure states without touching live finance.

## Expected test sequence after managed sandbox credentials are configured

1. Confirm Launch Readiness and Sandbox Integration Lab are green.
2. Confirm Cashfree mode is `sandbox`.
3. Create an INR 1.00 sandbox checkout probe.
4. Complete a Cashfree sandbox success flow.
5. Confirm signed webhook timestamp appears on the probe.
6. Click **Verify Cashfree**.
7. Require `verified_success` with matching order/payment amount and INR currency.
8. Repeat with a failed/user-dropped sandbox attempt and verify the corresponding evidence state.
9. Confirm no production booking payment, settlement, commission, refund, recovery, or payout rows were created by the probe.

## Current external blockers

The code path can be deployed safely before credentials exist. The runner stays locked until the Vercel production environment has the managed Cashfree Payments sandbox configuration.

Required server configuration is surfaced by the existing Sandbox Integration Lab and must never be committed to GitHub or pasted into source files.

Before public launch, separately complete:

- Supabase Auth leaked-password protection.
- GitHub `main` branch protection / required Web CI.
- Controlled Cashfree sandbox success/failure/webhook evidence.
- Refund/dispute/payout sandbox E2E using isolated test data or approved test fixtures.
- Explicit production credential cutover review.
- Explicit INR finance-policy activation review.
