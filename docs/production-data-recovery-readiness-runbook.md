# TakeItEsee production data recovery readiness runbook

Last reviewed: 2026-09-02 (Asia/Kolkata)

This runbook defines the operational data-backup and restore-readiness procedure for the canonical TakeItEsee production database. It does not perform a restore, create a paid backup add-on, change Supabase plan settings, or activate any finance capability.

## Safety boundary

Cashfree, customer payments, cash collection, refunds, payouts, disputes/chargebacks, settlement, reconciliation, recovery, and INR finance activation remain **HOLD**. Supabase Pro / leaked-password protection also remains **HOLD** until separately approved after plan upgrade.

Do not enable PITR, change the Supabase plan, or purchase backup add-ons merely to make this runbook green. Any paid capability change requires separate explicit approval.

## Canonical production target

- Supabase project: `bukrpkymivkhdpueropt`
- Project name: `Takeitesee`
- Region: `ap-south-1`
- Production source repository: `Aadhils/takeitesee`
- Application health endpoint: `https://www.takeitesee.com/api/health`

Before any recovery action, confirm that the Supabase project is `ACTIVE_HEALTHY` and that the affected application release is identified. Never restore a preview, development branch, or similarly named project by mistake.

## What must be protected

The recovery plan must account for both database state and non-database state.

Database backups cover PostgreSQL data and schema. Supabase Storage object bytes are a separate recovery concern: database backup/restore protects Storage metadata, but restoring the database does not recreate Storage objects that were deleted after the selected backup point.

Also treat environment variables, Vercel project configuration, GitHub source history, domain configuration, and third-party credentials as separate operational state. A database restore does not restore those systems.

## Current backup capability check

Supabase plan/backup entitlement is not inferred from application code or from this repository. At incident time, the operator must inspect the canonical project backup screen or authoritative platform metadata and record which capability is actually available.

Supabase currently documents these general behaviors:

- Pro, Team, and Enterprise projects receive automatic daily database backups with plan-specific retention.
- Free-tier projects should regularly create logical exports with `supabase db dump` and keep copies off-site.
- PITR is a paid add-on for eligible paid projects and provides finer restore granularity than daily backups.
- A project is inaccessible during a restore, so downtime is expected.

Do not record a paid-plan backup, PITR, or downloadable-backup capability as available unless it has been verified on the canonical project.

## Recovery objectives

Until a paid backup/PITR policy is explicitly approved, do not promise a contractual RPO or RTO.

For each incident, record:

- the latest verified recoverable point available before the incident;
- the estimated data-loss window between that point and incident time;
- the expected downtime based on database size and restore mechanism;
- any Storage objects or external-system state that require separate recovery.

If PITR is later explicitly enabled, update this runbook with the actual configured retention window and measured recovery evidence rather than relying on generic platform limits.

## Pre-restore decision gate

A production database restore is a high-impact action. Do not start one until all of the following are true:

1. The incident is confirmed to involve destructive/corrupt database state that cannot be safely repaired by a reviewed forward fix.
2. The exact canonical project and intended restore point are identified.
3. The expected data-loss window is understood and recorded.
4. The current application release and database schema compatibility have been checked.
5. Any replication slots/subscriptions or other restore-sensitive integrations have been identified.
6. The operator understands that the application may be unavailable during restoration.
7. Finance/Cashfree HOLD objects are not being altered as part of the recovery.
8. Evidence from the incident has been preserved without secrets or private customer/provider data.

Prefer a narrowly reviewed forward-fix when the data can be repaired safely without rewinding valid later writes.

## Restore procedure

When a restore is justified and the required platform capability is verified:

1. Record incident time, selected restore point, current production Git SHA, and current Vercel deployment ID.
2. Stop additional schema-changing work and avoid writes that would increase the recovery gap where operationally possible.
3. Select the closest verified backup point **before** the unwanted change or corruption.
4. Confirm the restore action in the Supabase production project only.
5. Treat the application as unavailable until Supabase reports the restore complete and database connectivity is re-established.
6. Recreate any restore-sensitive replication/subscription configuration if required by the platform procedure.
7. Do not assume deleted Storage object bytes have returned; verify Storage separately.
8. Run the recovery verification matrix below before reopening the incident.

Never improvise a reverse migration after a restore unless it is separately reviewed against the restored data state.

## Logical export readiness

If the canonical project does not have a verified managed restore point suitable for the required recovery objective, the operational fallback is a logical database export policy using Supabase CLI / `pg_dump`-compatible tooling.

A production export process must:

- run from a trusted operator environment;
- avoid embedding database passwords or access tokens in repository files, CI logs, issue text, or chat transcripts;
- encrypt backup files at rest when they contain production data;
- store at least one copy outside the production Supabase project;
- restrict access to authorized operators only;
- define retention and secure deletion rules;
- periodically prove that an export can be restored into an isolated non-production target.

This repository documents the procedure only. It does not create, schedule, upload, or retain production dumps automatically.

## Restore drill policy

A backup is not considered operationally proven until a restore drill has succeeded in an isolated non-production environment.

A safe drill should verify:

1. schema objects and migrations are present;
2. representative non-finance tables have expected row counts and constraints;
3. RLS and privileged-function authorization still fail closed where required;
4. the application can connect using non-production configuration;
5. `/api/health` equivalent checks pass against the isolated target;
6. no real user notifications, auth emails, payment actions, Cashfree calls, or external side effects can fire from the drill environment;
7. drill evidence contains no secrets or unnecessary PII.

Do not run a restore drill against the production project.

## Storage recovery check

After a database restore or logical recovery, separately verify every Storage-backed workflow that matters to non-finance launch readiness.

At minimum:

- confirm required buckets/policies still exist;
- confirm representative expected objects are readable by the correct role only;
- identify any database metadata that references object paths whose bytes are missing;
- do not recreate private verification/support files from guesses or stale local copies;
- escalate missing regulated/private documents for controlled re-upload or user/provider re-submission.

## Recovery verification matrix

Data recovery is complete only when all applicable checks pass:

- canonical Supabase project is healthy and reachable;
- intended schema/migration state is present;
- representative non-finance data integrity checks pass;
- Auth and RLS boundaries fail closed for unauthorized users;
- expected Storage objects are verified separately;
- canonical Vercel production deployment is identified and compatible with the restored schema;
- `https://www.takeitesee.com/api/health` returns HTTP `200`, `status=ok`, `app=ok`, and `database=ok`;
- affected non-finance customer/provider/admin workflow passes targeted smoke verification;
- deployment-scoped runtime errors and `5xx` remain clean after smoke traffic;
- Supabase Security and Performance Advisors show no newly introduced non-finance blocker after any DDL repair;
- Finance/Cashfree and Supabase Pro HOLD boundaries remain unchanged.

## Evidence to retain

Retain only non-secret operational evidence:

- backup/restore capability verified on the canonical project;
- chosen recovery point and estimated data-loss window;
- restore start/end timestamps;
- incident/corrective PR references;
- recovered schema/migration identity;
- health response release prefix;
- Storage verification summary;
- runtime error/`5xx` summary;
- final closure decision.

Never retain production credentials, raw authentication tokens, full private documents, or unnecessary PII in GitHub, logs, or incident notes.

## Closure rule

The data-recovery readiness layer is operationally closed when a documented restore path exists, plan-dependent capabilities are represented accurately, database and Storage recovery are treated separately, recovery gates are defined, and no finance or Supabase Pro HOLD item has been activated as a side effect.
