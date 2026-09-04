# Takeitesee production environments

Last verified: 2026-09-05 (Asia/Kolkata)

## Current live canonical environment

The Vercel production deployment for `takeitesee.com` / `www.takeitesee.com` is bound to the canonical Supabase project ref:

- `bukrpkymivkhdpueropt`

This project is the live application database and the authoritative database lineage for current Takeitesee development until a separately reviewed data migration/cutover is completed.

A fresh read-only migration-history audit on 2026-09-05 confirmed that this project contains the current launch-readiness and recurring-requirement migration chain through the provider final recurring lifecycle context work associated with PR `#238`.

### Mandatory naming / tooling guardrail

Treat `bukrpkymivkhdpueropt` as **canonical live / production** in code reviews, release notes, operator runbooks, Supabase tool calls, and development conversations.

Do **not** label this project as `test`, `staging`, or `non-production` unless a future, explicit environment cutover changes the source of truth and this document is updated in the same reviewed change.

Before applying any database migration or running any state-changing database verification, confirm the target project ref against this document. Read-only audits may compare other projects, but database writes must never rely on a remembered environment label.

## Legacy project labelled Production

A separate Supabase project exists with ref:

- `txzbnfyyuredrtqileow`

This project is **legacy / non-canonical** and must not be treated as the current Takeitesee production database.

A fresh read-only migration-history audit on 2026-09-05 confirmed that this project remains on an older August 2026 booking/provider schema lineage and does not contain the current launch-readiness or recurring-requirement migration chain present in the canonical live project.

Do **not** apply the current incremental migration tail to this project as though it were a normal staging-to-production promotion. The two projects are data-divergent, not interchangeable replicas.

Do **not** point Vercel production to this project as a simple environment-variable switch.

## Cutover rule

Any future move from the canonical Supabase project to a replacement project must be treated as a data migration and controlled cutover, not only a schema migration. A cutover requires all of the following before Vercel environment variables change:

1. Build the target schema from the canonical migration history and verify RLS/function grants.
2. Define how auth users/identities will be migrated or intentionally recreated.
3. Migrate application data with foreign-key and identity integrity preserved.
4. Reconcile source/target row counts and critical booking/marketplace invariants.
5. Test the target with a non-production Vercel deployment.
6. Freeze writes or use an explicit delta-sync procedure for the final migration window.
7. Switch Vercel only after the target passes health, auth, booking, provider, admin, and other approved non-finance launch gates.
8. Keep a documented rollback path until the cutover is accepted.
9. Update this source-of-truth document in the same reviewed cutover change.

Finance/Cashfree activation remains a separate HOLD and is not required merely to validate an infrastructure cutover plan.

## Current release evidence

At the 2026-09-05 verification checkpoint:

- authoritative Git `main`: `93ee19061c5ed3032661bcbf97c526b1ec644b4a`
- Vercel production deployment: `dpl_43V3SxmkCGgbUhT6qUKaPcF38vb8`
- deployment Git clone source: branch `main`, commit prefix `93ee190`
- canonical `/api/health`: HTTP `200`, `status=ok`, `app=ok`, `database=ok`, release `93ee19061c5e`
- aggregated production runtime errors in the checked 24-hour window: none
- deployment-scoped `5xx` in the checked one-hour window: none
- unresolved Vercel toolbar feedback for the project: none

These observations confirm release health, while the database identity is additionally anchored by the repository source of truth plus the canonical project's current migration lineage. Do not infer database identity from an old project display name.

## Safety

- Never commit Supabase service-role keys, JWT secrets, payment secrets, or private credentials.
- A Supabase project ref / public API URL is not a secret, but credentials still belong only in managed environment settings.
- Prefer read-only verification when resolving environment identity or schema drift.
- Do not apply migrations to a project merely to make two divergent environments look similar.
- Finance policy activation and production Cashfree credential changes are separate launch decisions and must not be enabled as a side effect of infrastructure work.
- Supabase Pro / leaked-password protection remains HOLD until the product owner explicitly resumes that work.
