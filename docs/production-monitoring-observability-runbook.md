# TakeItEsee production monitoring & observability runbook

Last reviewed: 2026-09-02 (Asia/Kolkata)

This runbook defines the non-finance production monitoring and operator-response baseline for TakeItEsee. It is intentionally lightweight and uses the telemetry already available from Vercel, Supabase, GitHub Actions, and the canonical application health endpoint. It does not activate paid observability products or change application, database, authentication, or finance behavior.

## Safety boundary

Cashfree, customer payments, cash collection, refunds, payouts, disputes/chargebacks, settlement, reconciliation, recovery, and INR finance activation remain **HOLD**. Supabase Pro / leaked-password protection also remains **HOLD** until explicitly resumed after plan upgrade.

Monitoring must never be made "green" by enabling held finance integrations, weakening authorization, changing RLS, or turning on plan-dependent security features outside the approved workflow.

## Canonical production sources

Use these sources as the operational truth:

- Application: `https://www.takeitesee.com`.
- Health endpoint: `GET https://www.takeitesee.com/api/health`.
- Git source: `Aadhils/takeitesee`, branch `main`.
- Hosting: canonical Vercel production project `takeitesee`.
- Database/Auth: canonical Supabase project `bukrpkymivkhdpueropt`.
- Release verification: the health endpoint `release` value must match the intended production Git SHA prefix.

Do not use preview deployments, stale commits, or legacy/non-canonical Supabase projects as production evidence.

## Minimum signals

### Availability

Check that:

- the active Vercel production deployment is `READY`;
- canonical aliases are attached to that deployment;
- `/api/health` returns HTTP `200`;
- health reports `status=ok`, `app=ok`, and `database=ok`.

A failing health endpoint is an availability incident even if the home page still renders from cache.

### Runtime errors

Use Vercel runtime error clusters first for a fast production view, then deployment-scoped logs for detail.

Escalate when:

- any new `fatal` runtime error appears;
- repeated `error` entries affect a core non-finance route;
- the same error persists after a known-safe redeploy;
- errors indicate cross-account authorization, privacy exposure, or destructive data risk.

### HTTP 5xx

For every production release, check deployment-scoped `5xx` logs after smoke traffic. A clean release closure requires no unexplained `5xx` entries during the verification window.

A single transient `5xx` should be investigated when it is reproducible or touches auth, booking, provider, privacy, support, Admin, or Super Admin workflows. Repeated or broad `5xx` is incident-response territory.

### Database/Auth health

Use Supabase project status, service logs, and advisors when database/auth behavior is implicated.

- Keep the canonical project `ACTIVE_HEALTHY`.
- Run Security and Performance Advisors after approved DDL changes.
- Treat new non-finance security advisor findings as review items before release closure.
- Do not treat the held leaked-password setting as a newly introduced regression while the HOLD remains active.

### CI and release integrity

Every production code change must retain the required `web` CI gate:

- dependency install;
- Type check;
- Lint;
- Production build.

A production deployment is not closed merely because Vercel is `READY`; the exact Git SHA, health release, runtime state, and required GitHub check must agree.

## Release verification window

Immediately after every production merge:

1. identify the exact merged `main` SHA;
2. identify the exact Vercel production deployment created from that SHA;
3. wait until it is `READY` and aliases are attached;
4. call canonical `/api/health`;
5. smoke the affected public/private boundary without unnecessary real-user data;
6. check runtime errors for the recent window;
7. check deployment-scoped `5xx`;
8. check unresolved Vercel toolbar feedback;
9. for database changes, rerun relevant Supabase advisors.

Do not declare production CLOSED until these checks are complete.

## Operational thresholds

These are response thresholds, not contractual customer SLAs.

### SEV-1

Respond immediately for:

- canonical health broadly unavailable;
- confirmed cross-account data access;
- unauthorized Admin/Super Admin access;
- destructive data corruption;
- authentication failure affecting most users;
- repeated production `5xx` blocking core marketplace use.

Use the production incident response runbook.

### SEV-2

Respond promptly for:

- a major customer/provider/admin workflow broken with a workaround;
- persistent route-specific `5xx`;
- repeated database/auth errors affecting a meaningful subset of users;
- a release that is `READY` but does not match the intended health release SHA.

### SEV-3

Use the normal PR workflow for:

- isolated visual or copy defects;
- non-destructive UX degradation;
- low-impact warnings that do not violate security, privacy, integrity, or availability boundaries.

## Baseline service objectives

Until real production traffic is sufficient for statistical SLOs, use operational objectives rather than claiming a formal SLA:

- canonical health should remain continuously green during release checks;
- production releases should close with zero unexplained deployment-scoped `5xx` during smoke verification;
- new releases should introduce zero unresolved fatal runtime errors;
- privileged and private boundaries must fail closed;
- production source, deployment SHA, and health release must remain traceable to one reviewed `main` commit.

Do not publish external uptime percentages or error-budget claims until there is continuous measurement over a meaningful period.

## Monitoring cadence

### After every release

Run the full release verification window above.

### During active incident investigation

Check health and affected telemetry frequently enough to confirm containment and recovery, using the incident runbook rather than making unreviewed production changes.

### Periodic readiness review

Periodically review:

- recent Vercel runtime error clusters;
- recent `5xx` distribution;
- unresolved Vercel toolbar feedback;
- Supabase project health and advisors;
- required GitHub CI status and branch protection;
- whether any new external dependency has been introduced without an observability owner.

The exact cadence may be tightened as real traffic grows; do not invent alert precision that the current lightweight stack cannot guarantee.

## Logging and privacy rules

Never put the following into monitoring notes, issues, PRs, screenshots, or external observability tools:

- passwords or password-reset tokens;
- access/refresh tokens or cookies;
- service-role or private API keys;
- private provider verification documents;
- unnecessary customer/provider PII;
- raw private support, grievance, or privacy-request content.

Prefer request IDs, route names, role class, timestamps, deployment IDs, Git SHAs, HTTP status, and redacted error summaries.

## Alert destination policy

No external alerting vendor is assumed active by this runbook. If Sentry, OpenTelemetry, a log drain, uptime monitor, pager, email alert, or another provider is added later:

- add it through a reviewed non-finance PR/configuration change;
- document its owner and escalation destination;
- prove secret/PII redaction before production use;
- avoid duplicate noisy alerts for the same failure mode;
- preserve Vercel/Supabase/GitHub as authoritative evidence for their respective layers.

Do not activate a paid monitoring add-on merely to close a documentation gate.

## Release closure evidence

Retain only non-secret evidence:

- PR number and merged Git SHA;
- exact Vercel production deployment ID;
- deployment state and canonical aliases;
- `/api/health` HTTP status and release prefix;
- runtime error summary;
- deployment-scoped `5xx` summary;
- unresolved toolbar feedback count;
- Supabase advisor summary when applicable;
- final production CLOSED decision.

## Closure rule

Monitoring readiness is satisfied when operators can identify the exact production release, verify application/database health, detect runtime and `5xx` regressions, distinguish severity, protect private data in telemetry, and move a real failure into the incident-response workflow without weakening any HOLD or security boundary.
