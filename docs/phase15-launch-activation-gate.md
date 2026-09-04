# Takeitesee non-finance launch activation gate

Last consolidated: 2026-09-05 (Asia/Kolkata), after PR `#238` production verification and canonical Supabase environment reconciliation.

This document is the single current Takeitesee public non-finance launch-readiness gate. Completed scopes are closed work and must not be reopened without new failure evidence, an approved product requirement, or a dependency change.

## Current audited application baseline

The latest audited application release before this documentation-only guardrail change is:

- canonical public domain: `https://www.takeitesee.com`
- apex domain: `https://takeitesee.com`
- authoritative Git `main`: `93ee19061c5ed3032661bcbf97c526b1ec644b4a`
- Vercel production project: `prj_tnzTyndMigNpGqH1x0SZ2sRpAUlf`
- Vercel production deployment: `dpl_43V3SxmkCGgbUhT6qUKaPcF38vb8`
- deployment state: `READY`
- deployment build source: branch `main`, commit prefix `93ee190`
- canonical `/api/health`: HTTP `200`, `status=ok`, `app=ok`, `database=ok`, release `93ee19061c5e`
- aggregated production runtime errors in the checked 24-hour window: none
- deployment-scoped `5xx` in the checked one-hour window: none
- unresolved Vercel toolbar feedback: none

The release produced by the PR that updates this file must independently pass the protected workflow and exact merged-SHA production checks before it supersedes the baseline above.

## Canonical Supabase environment — mandatory source of truth

Canonical live / production Supabase project:

- `bukrpkymivkhdpueropt`

Legacy / non-canonical Supabase project:

- `txzbnfyyuredrtqileow`

A fresh read-only migration-history comparison on 2026-09-05 confirmed that `bukrpkymivkhdpueropt` contains the current launch-readiness and recurring-requirement migration lineage through PR `#238`, while `txzbnfyyuredrtqileow` remains on an older August 2026 booking/provider migration lineage.

Therefore:

- do not label `bukrpkymivkhdpueropt` as test or staging;
- do not treat `txzbnfyyuredrtqileow` as the current production database;
- do not apply incremental current migrations to `txzbnfyyuredrtqileow` as though it were a normal promotion target;
- verify the project ref against `docs/production-environments.md` before any state-changing database operation;
- any future project switch is a reviewed data migration/cutover, not a simple Vercel environment-variable change.

## Verified green non-finance gates — CLOSED

The implemented non-finance candidate has already passed representative production or protected-workflow coverage for:

- canonical domain and release integrity;
- public discovery and private/auth boundaries;
- HTTP 404/global error recovery;
- signup, email confirmation, password recovery, account security and email change;
- age/Terms/Privacy consent recording;
- approved Privacy Policy, Terms of Service and Cookie Policy;
- favicon/PWA/Apple-touch/social identity;
- provider onboarding, verification, trust and controlled service publication;
- provider legal/public-contact/grievance disclosure;
- privacy request workflow;
- platform support/grievance workflow and status notifications;
- accessibility keyboard/focus improvements;
- production incident-response, rollback, data-recovery and monitoring runbooks;
- representative non-finance customer marketplace discovery, availability, booking request, provider acceptance and customer confirmed state;
- universal requirement scheduling and recurring-service orchestration;
- selected-weekday recurrence;
- sequential recurring occurrence lifecycle;
- recurring occurrence recovery/audit path;
- customer/provider recurring final-state lifecycle consistency.

These passed areas are not a standing invitation for additional polish PRs. Reopen a closed scope only when a new bug, failing check, changed requirement, security finding, or explicit product feature requires it.

## Recurring requirement lifecycle — FROZEN

PRs `#220` through `#238` establish the current recurring requirement lifecycle, including recurrence intent, occurrence planning, sequential orchestration, selected weekdays, recovery, completion/advancement, final fulfillment and customer/provider final-state presentation.

This recurrence/recovery lifecycle is **CLOSED & FROZEN** for launch-readiness purposes.

Do not create more recurrence verification, consistency, wording, dashboard, or hardening work merely to re-check the same passed lifecycle. Normal regression coverage may run when another genuine feature changes shared code.

## Current product-development mode

New development may proceed from the authoritative `main` baseline when it is a genuine product requirement rather than a re-verification of closed work.

Major new product concepts — for example the proposed multi-skill professional identity, portfolio/resume, opportunity and subscription ecosystem — must be planned as new feature architecture and must not be represented as unfinished recurrence work.

## External plan-level security HOLD

Supabase leaked-password protection remains HOLD until:

1. the canonical project plan exposes the required setting;
2. the product owner explicitly resumes this work;
3. `Prevent use of leaked passwords` is enabled; and
4. a fresh Security Advisor review confirms the warning is cleared.

Do not purchase or activate a paid plan merely to make readiness evidence appear green.

## Finance / Cashfree / payment HOLD

Real customer payment collection, Cashfree Payments/Payouts, refunds, payouts, settlement, reconciliation, disputes/chargebacks, recovery/collections ledger behavior, and INR finance activation remain **HOLD**.

Do not:

- activate Cashfree sandbox or production credentials;
- change payment/refund/payout/settlement/reconciliation state machines or policies as part of unrelated work;
- run payment/refund/payout/dispute finance E2E merely for non-finance launch evidence;
- enable INR finance policy;
- represent finance readiness as green based on non-finance readiness.

Cash on Service behavior must remain unchanged unless the product owner explicitly changes that requirement.

## Privileged database / security rule

Do not blindly change SECURITY DEFINER functions or grants because an advisor reports them. Review each function's authorization boundary, ownership checks, `search_path`, RLS interaction and execute grants in context.

For any new public-schema table, remember that Data API exposure and RLS are separate concerns. New application data must have explicit access intent and row-level authorization before exposure.

## Release closure rule

Every future release closure must record and verify:

- PR number;
- authoritative merged `main` SHA;
- required web CI / type check / lint / production build result;
- exact Vercel production deployment ID;
- deployment Git SHA matches merged `main`;
- canonical `/api/health` returns `status=ok`, `app=ok`, `database=ok` and the expected release prefix;
- production runtime error result;
- deployment-scoped `5xx` result for an appropriate checked window;
- unresolved Vercel feedback result;
- canonical Supabase project identity when database work is involved;
- Finance/Cashfree HOLD status;
- Supabase Pro/leaked-password HOLD status.

Never record credentials, service-role keys, auth tokens, sensitive PII, or raw production database dumps in launch evidence.

## Current classification

**Non-finance application:** production-accepted launch candidate.

**Operational readiness:** documented and production-smoke verified.

**Recurring requirement lifecycle:** CLOSED / FROZEN.

**Canonical database:** `bukrpkymivkhdpueropt`.

**Legacy non-canonical database:** `txzbnfyyuredrtqileow`.

**Finance/Cashfree:** NO-GO / HOLD.

**Supabase Pro leaked-password protection:** HOLD.

Public non-finance development and finance activation remain separate programs.
