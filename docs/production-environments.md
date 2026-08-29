# Takeitesee production environments

Last verified: 2026-08-30 (Asia/Kolkata)

## Current live canonical environment

The Vercel production deployment for `takeitesee.com` / `www.takeitesee.com` is currently bound to Supabase project ref:

- `bukrpkymivkhdpueropt`

This project is the canonical live application database until a separately reviewed data migration/cutover is completed.

At the Phase 15 readiness audit it contained the complete Phase 10–14 platform schema, including the SaaS control plane, delegated admin RBAC, booking lifecycle, provider onboarding/trust, payments, refunds, finance-risk reconciliation, and provider recovery ledger.

## Legacy project labelled Production

A separate Supabase project exists with ref:

- `txzbnfyyuredrtqileow`

Do **not** point Vercel production to this project as a simple environment-variable switch. At the Phase 15 audit this project had an older 12-table public schema and a different auth/application data footprint from the live canonical database.

The two projects are data-divergent, not interchangeable replicas.

## Cutover rule

Any future move to a replacement Supabase production project must be treated as a data migration, not only a schema migration. A cutover requires all of the following before Vercel environment variables change:

1. Build the target schema from the canonical migration history and verify RLS/function grants.
2. Define how auth users/identities will be migrated or intentionally recreated.
3. Migrate application data with foreign-key and identity integrity preserved.
4. Reconcile source/target row counts and critical financial/booking invariants.
5. Test the target with a non-production Vercel deployment.
6. Freeze writes or use an explicit delta-sync procedure for the final migration window.
7. Switch Vercel only after the target passes health, auth, booking, admin, payment, and payout checks.
8. Keep a documented rollback path until the cutover is accepted.

## Safety

- Never commit Supabase service-role keys, JWT secrets, payment secrets, or private credentials.
- A Supabase project ref / public API URL is not a secret, but credentials still belong only in managed environment settings.
- Finance policy activation and production Cashfree credential changes are separate launch decisions and must not be enabled as a side effect of infrastructure work.
