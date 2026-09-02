# TakeItEsee production incident response & rollback runbook

Last reviewed: 2026-09-02 (Asia/Kolkata)

This runbook defines the non-finance production incident and rollback procedure for TakeItEsee. It is an operator guide only: it does not activate or alter application behavior, database state, authentication settings, or finance integrations.

## Safety boundary

Cashfree, customer payments, cash collection, refunds, payouts, disputes/chargebacks, settlement, reconciliation, recovery, and INR finance activation remain **HOLD**. Supabase Pro / leaked-password protection also remains **HOLD** until the project is upgraded and the setting can be enabled and re-audited.

During an incident, do not enable gateway credentials, finance flags, payment/payout flows, or leaked-password protection merely to make a readiness check green. Finance-only incidents and activation procedures require a separate explicitly authorized runbook after the HOLD is lifted.

## Canonical production surfaces

- Public canonical domain: `https://www.takeitesee.com`.
- Apex domain: `https://takeitesee.com` (canonical redirect expected).
- Health endpoint: `GET /api/health`.
- Canonical Supabase project: `bukrpkymivkhdpueropt`.
- Source repository: `Aadhils/takeitesee`, branch `main`.
- Production hosting: Vercel project `takeitesee`.

Never treat a preview deployment, a stale Git commit, or a non-canonical Supabase project as production evidence.

## Incident severity

### SEV-1 — critical

Use for a broad production outage, unauthorized privileged access, cross-account data exposure, destructive data corruption, authentication failure affecting most users, or repeated production `5xx` that prevents core non-finance marketplace use.

Immediate goal: contain the impact, preserve evidence, and restore a known-safe production state.

### SEV-2 — high

Use for a major feature failure with a viable workaround, scoped authorization failure without confirmed cross-account exposure, broken provider/customer/admin workflow, or persistent elevated errors limited to one production route.

Immediate goal: stop further impact and repair or roll back the affected release.

### SEV-3 — moderate

Use for degraded UX, isolated non-destructive defects, incorrect copy/metadata, or operational issues that do not compromise account boundaries, data integrity, or core availability.

Immediate goal: fix through the normal pull-request workflow unless impact increases.

## First five checks

1. Confirm the active Vercel production deployment is `READY` and record its deployment ID and Git commit SHA.
2. Call `https://www.takeitesee.com/api/health` and record HTTP status plus `app`, `database`, and `release` values.
3. Check deployment-scoped Vercel runtime errors and `5xx` logs. Prefer the exact affected deployment rather than a broad unscoped log window.
4. Confirm whether the failing route is public, authenticated customer, provider, Admin, or Super Admin; do not create elevated users merely for testing.
5. If database/auth behavior is implicated, inspect the canonical Supabase project only. Use read-only verification first and run advisors after any approved database DDL change.

Record timestamps in Asia/Kolkata and UTC when correlating GitHub, Vercel, and Supabase evidence.

## Containment rules

- Prefer fail-closed behavior for authentication, authorization, private APIs, and privileged Admin/Super Admin surfaces.
- Do not expose service-role keys, cookies, access tokens, password-reset tokens, private provider verification documents, or customer private data in logs, screenshots, issues, or pull-request text.
- Do not weaken RLS, remove authorization predicates, add bypass actors, disable branch protection, or force-push `main` to restore service.
- Do not directly edit production code outside the existing pull-request + required `web` check workflow.
- If a new release is clearly responsible and a safe prior application deployment exists, prefer an application rollback while separately evaluating database compatibility.

## Vercel application rollback procedure

A Vercel rollback changes application deployment state; it does **not** undo Supabase migrations or other external state.

Before rollback:

1. Identify the exact bad deployment ID, Git SHA, and first observed failure time.
2. Identify the last known-good production deployment and verify that its expected database schema is still compatible with the current canonical database.
3. Confirm the rollback will not cross a schema/API boundary that makes the older application unsafe against the newer database.
4. Preserve enough runtime evidence to diagnose the bad release after service is restored.

After rollback or promotion of a known-good deployment:

1. Confirm canonical aliases point to the intended deployment.
2. Verify `GET /api/health` returns HTTP `200`, `status=ok`, `app=ok`, and `database=ok`.
3. Verify representative public and private-boundary routes without using real customer data unnecessarily.
4. Confirm deployment-scoped runtime `error`/`fatal` and `5xx` state is clean after smoke traffic.
5. Confirm unresolved Vercel toolbar feedback has not introduced a new release-blocking issue.
6. Open a corrective PR from current `main`; do not leave production permanently detached from reviewed source history.

## Database incident procedure

Database rollback is **not** assumed safe. Supabase migrations may be irreversible after real writes or may be depended on by later releases.

For a suspected database incident:

1. Stop additional schema mutation and inspect the canonical project read-only first.
2. Record the relevant migration, function/policy/table definition, advisor finding, and affected application release.
3. Determine whether application rollback alone is compatible with the current schema.
4. Prefer a reviewed forward-fix migration when data has already been written under the newer schema.
5. Use a destructive or reverse migration only when its safety has been explicitly proven against current production data and dependencies.
6. After any approved DDL fix, rerun Supabase Security and Performance Advisors and repeat production health/runtime verification.

Never modify Finance/Cashfree/payment/refund/payout/recovery/settlement/reconciliation objects while the HOLD boundary is active, even if an advisor reports notices on those objects.

## Authentication and account-security incidents

For login, confirmation, password recovery, password/email change, session, or account-boundary failures:

- Verify the canonical Supabase Auth configuration and application release before changing hosted Auth settings.
- Preserve generic account-existence-safe UX; do not make recovery responses reveal whether an email is registered.
- Do not bypass current-password re-verification or weaken private/noindex/no-store account surfaces as an emergency shortcut.
- Treat any confirmed cross-account access or privileged authorization bypass as SEV-1.
- Supabase leaked-password protection remains a separate plan-level HOLD item and is not an emergency toggle on the current plan.

## Non-finance marketplace workflow incidents

For customer, provider, booking, requirement/proposal, messaging, moderation, support/grievance, privacy-request, notification, or Admin/Super Admin workflow failures:

- Verify ownership/participant/scoped-admin authorization before changing function privileges or RLS.
- A Supabase advisor warning that a `SECURITY DEFINER` RPC is executable by `authenticated` is not by itself proof of exposure; inspect the function body, fixed `search_path`, and internal authorization checks before changing grants.
- Do not revoke a legitimate authenticated RPC blindly if the client workflow depends on it and the function correctly enforces ownership or scoped authorization internally.
- For privacy/support review updates, ensure private customer-visible notes remain restricted to the owning account.

## Recovery verification matrix

A production recovery is complete only when the incident-specific checks pass and the common gates below are green:

- active Vercel production deployment is `READY` and mapped to the intended Git SHA;
- canonical domains resolve to the intended production deployment;
- `/api/health` is HTTP `200`, app/database green, and reports the intended release;
- affected public route returns the expected status/metadata;
- affected private/API boundary fails closed for guests where required;
- no new deployment-scoped runtime `error`/`fatal` entries appear during smoke verification;
- no deployment-scoped `5xx` entries appear during smoke verification;
- Supabase advisors show no newly introduced non-finance blocker after database changes;
- required GitHub `web` check passed for the corrective PR;
- Finance/Cashfree and Supabase Pro HOLD boundaries remain unchanged.

## Corrective-change workflow

1. Branch from the current authoritative `main` SHA, not from an earlier remembered production SHA.
2. Keep the change narrowly scoped to the verified incident cause.
3. State the non-finance safety boundary explicitly in the PR body.
4. Require the repository `web` check before merge and use the repository's permitted squash workflow.
5. After merge, identify the exact new production deployment and verify its Git SHA.
6. Run canonical health, affected-route smoke, runtime error/fatal, `5xx`, and Vercel feedback checks.
7. For database changes, verify the exact canonical migration state and rerun Supabase advisors.
8. Record the final production evidence before declaring the incident closed.

## Evidence to retain

For each production incident, retain only non-secret operational evidence:

- incident start/end time and severity;
- affected route/workflow and user role class;
- bad deployment ID + Git SHA, if applicable;
- last known-good deployment ID + Git SHA, if rollback was used;
- health response release prefix;
- runtime error/`5xx` summary;
- relevant Supabase advisor/result summary without secrets or customer data;
- corrective PR number and merged SHA;
- exact recovered production deployment ID;
- final verification result and any follow-up action.

Do not copy passwords, auth tokens, service-role secrets, raw private documents, or unnecessary customer/provider PII into the incident record.

## Closure rule

An incident is closed only when production is stable on an identified reviewed release, the affected workflow is verified, runtime and health gates are clean, any database change has been advisor-checked, and no HOLD boundary was altered as a side effect.
