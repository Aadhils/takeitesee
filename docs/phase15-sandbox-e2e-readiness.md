# Phase 15 Cashfree sandbox E2E readiness

Last reviewed: 2026-08-30 (Asia/Kolkata)

This module prepares repeatable sandbox diagnostics without enabling production payments, refunds, or provider payouts.

## Safety boundary

- All credential probes are Super Admin-only.
- Credential probes are hard-blocked unless the corresponding Cashfree configuration is in `sandbox` mode.
- Probes are non-mutating GET lookups against deliberately nonexistent Takeitesee probe IDs.
- No payment order, refund, beneficiary, or payout transfer is created by the readiness lab.
- No secret values are returned to the browser or written to logs/database rows.
- Production Cashfree activation and INR finance activation remain separate launch decisions.

## Current Cashfree webhook contract

Cashfree Payments webhook signatures use the webhook timestamp plus the **exact raw request body** and HMAC-SHA256 with the client secret. Parsing and re-serializing JSON before signature verification can change numeric formatting and invalidate the signature.

Current Cashfree documentation also exposes retry/idempotency metadata on payment webhooks and separate webhook families for payments, refunds/auto-refunds, disputes, and payouts.

Official references:

- https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
- https://www.cashfree.com/docs/payments/webhooks
- https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks
- https://www.cashfree.com/docs/api-reference/payments/latest/refunds/webhooks
- https://www.cashfree.com/docs/api-reference/payments/latest/disputes/dispute-webhooks
- https://www.cashfree.com/docs/api-reference/payouts/v2/webhooks/webhooks-v2

## Sandbox readiness lab

The Super Admin finance workspace now includes a sandbox integration panel backed by:

- `GET /api/super-admin/sandbox-readiness`
- `POST /api/super-admin/sandbox-readiness`

The GET check reports:

- HTTPS callback readiness,
- deterministic webhook-signature contract self-test,
- raw-body tamper rejection,
- timestamp/signature tamper rejection,
- service-role webhook inbox availability,
- aggregate webhook processing states for the previous 24 hours,
- exact Takeitesee payment/refund/dispute/payout callback URLs,
- Cashfree Payments sandbox configuration completeness,
- Cashfree Payouts sandbox configuration completeness.

The POST actions provide non-mutating sandbox credential probes:

- `probe_payment_credentials`
- `probe_payout_credentials`

A valid credential probe fetches a deliberately nonexistent order/transfer. An expected not-found response demonstrates that Cashfree authenticated the request without creating financial state.

## Required sandbox server configuration

Payments:

- `PAYMENT_GATEWAY_PROVIDER=cashfree`
- `CASHFREE_ENVIRONMENT=sandbox`
- `CASHFREE_CLIENT_ID`
- `CASHFREE_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Payouts:

- `CASHFREE_PAYOUT_ENVIRONMENT=sandbox`
- `CASHFREE_PAYOUT_CLIENT_ID`
- `CASHFREE_PAYOUT_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not commit or paste secret values into source control. Configure them only through managed Vercel environment settings.

## External sandbox E2E sequence after configuration

Only after the readiness panel reports that local checks and sandbox configuration are ready:

1. Register/test the payment webhook URL in Cashfree sandbox.
2. Register/test the refund webhook URL.
3. Register/test the dispute webhook URL.
4. Register/test the payout webhook URL in the Payouts sandbox dashboard.
5. Run a controlled customer sandbox checkout and verify payment intent → signed webhook → booking payment reconciliation.
6. Test failure/user-drop and duplicate webhook delivery.
7. Test a sandbox refund and refund webhook reconciliation.
8. Test dispute/chargeback webhook ingestion where Cashfree sandbox tooling supports it.
9. Test provider payout destination/transfer in sandbox only after a dedicated sandbox beneficiary is prepared.
10. Verify reconciliation queues and recovery ledger remain idempotent under retries.

No production credentials or finance policy activation should be performed as part of these tests.
