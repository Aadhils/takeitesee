# Phase 15 launch activation gate

Last audited: 2026-08-30 (Asia/Kolkata)

This gate keeps real customer payments, provider payouts, and INR finance activation disabled until infrastructure, security, and sandbox integration checks are complete.

## Verified green gates

- `takeitesee.com` / `www.takeitesee.com` use canonical Supabase project `bukrpkymivkhdpueropt`.
- Public application/database health returns healthy.
- Anonymous execution was removed from mutating and user-specific SECURITY DEFINER RPCs.
- Trigger-only SECURITY DEFINER functions are no longer directly executable by `anon` or `authenticated` API roles.
- Required anonymous marketplace/RLS helpers remain available.
- A fresh unprivileged authenticated identity receives no Admin/Super Admin/platform-manage authority.
- Provider and platform-manage test identities are separated in the current live data footprint.
- INR finance policy remains inactive.

## Intentional Supabase Security Advisor warnings

A small set of anonymous SECURITY DEFINER warnings remains intentionally because the functions are required by public marketplace availability or RLS policy evaluation:

- `get_public_booking_conflicts`
- `provider_owner_is_verified`
- `provider_profile_is_complete`
- `provider_trust_allows_marketplace`
- `service_scope_is_launchable`

Signed-in SECURITY DEFINER warnings also remain for authenticated customer/provider/admin workflows. These functions retain explicit ownership or Admin/Super Admin authorization checks in their bodies. Removing the `authenticated` grant without changing the server authorization architecture would break legitimate flows and is not part of this hardening step.

## Remaining launch blockers

### 1. Supabase leaked-password protection

The Supabase Security Advisor reports leaked-password protection as disabled. Enable it before public launch and re-run the Security Advisor.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. GitHub `main` branch protection

`main` is currently unprotected. Before public launch, require pull requests and the permanent `Web CI` check before merge. Do not allow routine direct production pushes.

The connected GitHub capability used during this audit can read branch protection but cannot write repository protection/ruleset settings, so this remains an explicit manual repository setting gate.

### 3. Privileged server configuration

Use the Super Admin launch-readiness panel/API to verify server-side Supabase service-role access. Never expose or commit the service-role key.

### 4. Cashfree sandbox configuration

Before any production credential activation:

- configure Cashfree Payments sandbox credentials,
- configure Cashfree Payouts sandbox credentials,
- keep both gateways in sandbox mode,
- verify signed payment/refund/dispute/payout webhook delivery,
- perform controlled end-to-end sandbox payment → refund → payout/recovery scenarios,
- confirm duplicate webhook idempotency and reconciliation behavior.

### 5. Production activation remains separate

Only after all pre-launch gates are green should production Cashfree credentials and INR finance policy activation be reviewed. Do not enable either as a side effect of code deployment, migrations, or sandbox testing.

## Super Admin readiness endpoint

`GET /api/super-admin/readiness` is Super Admin-only and reports booleans/configuration state without returning secret values or database rows. It checks:

- canonical Supabase binding,
- service-role database access,
- RPC hardening state,
- public marketplace helper availability,
- INR finance policy activation state,
- Cashfree Payments mode/configuration completeness,
- Cashfree Payouts mode/configuration completeness.
