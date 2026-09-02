# Production go-live operator checklist

Last consolidated: 2026-09-02 (Asia/Kolkata)

This is the final operator-facing checklist for the TakeItEsee **non-finance** public launch. It consolidates the launch gate, incident response, data recovery, monitoring, release integrity, legal/support, and HOLD boundaries into one release-day procedure.

## Scope and hard safety boundary

This checklist does **not** authorize Finance/Cashfree activation.

Remain HOLD unless the product owner explicitly lifts the relevant boundary:

- Cashfree Payments and Cashfree Payouts
- customer payment / cash collection
- refunds
- provider payouts
- settlement
- reconciliation
- disputes / chargebacks
- recovery ledger / collection
- INR finance policy
- any payment/refund/payout/recovery E2E

Supabase Pro-only leaked-password protection also remains HOLD until the canonical project is upgraded and the product owner resumes that work. Do not purchase, enable, or claim that capability merely to make this checklist green.

## Canonical production targets

- Repository: `Aadhils/takeitesee`
- Production branch: `main`
- Public domain: `https://www.takeitesee.com`
- Apex domain: `https://takeitesee.com`
- Health endpoint: `https://www.takeitesee.com/api/health`
- Canonical Supabase project: `bukrpkymivkhdpueropt`
- Vercel production project: `prj_tnzTyndMigNpGqH1x0SZ2sRpAUlf`

Never close a release against a preview deployment, legacy Supabase project, stale Git SHA, or non-canonical domain.

## 1. Release freeze gate

Before the final production release:

- [ ] Confirm the intended PR scope is non-finance or explicitly approved.
- [ ] Confirm Finance/Cashfree HOLD files, configuration, migrations, policies, state machines, and activation flags were not changed indirectly.
- [ ] Confirm Supabase Pro / leaked-password protection remains represented accurately as HOLD if still unavailable.
- [ ] Confirm no unrelated dependency churn is bundled into the release.
- [ ] Confirm the PR head is based on the current authoritative `main`.
- [ ] Confirm no unresolved review thread represents a launch blocker.

During the release freeze, only launch-blocking fixes should enter `main`. Each fix still requires the normal protected PR workflow.

## 2. Required GitHub gate

A production candidate is not releasable until:

- [ ] PR is open against `main`.
- [ ] Required `web` GitHub Actions check is green.
- [ ] Type check is green.
- [ ] Lint is green.
- [ ] Production build is green.
- [ ] The PR is squash-merged through the protected branch workflow.
- [ ] The resulting authoritative `main` SHA is recorded.

Do not bypass branch protection to accelerate go-live.

## 3. Exact Vercel release integrity

After merge:

- [ ] Locate the production deployment created from the merged `main` SHA.
- [ ] Confirm target is `production`.
- [ ] Confirm deployment state is `READY`.
- [ ] Confirm deployment Git SHA exactly equals the authoritative merged `main` SHA.
- [ ] Confirm `www.takeitesee.com` is attached to that deployment.
- [ ] Confirm `takeitesee.com` is attached to that deployment.

A healthy older deployment is not sufficient evidence for the current release.

## 4. Canonical health gate

Request `GET https://www.takeitesee.com/api/health` only after the exact deployment is READY.

Required result:

- [ ] HTTP `200`
- [ ] `status = ok`
- [ ] `app = ok`
- [ ] `database = ok`
- [ ] reported `release` prefix matches the authoritative merged SHA

Any mismatch blocks closure until explained and corrected.

## 5. Non-finance public smoke

Verify representative public behavior without activating finance:

- [ ] Home/public discovery loads from the canonical domain.
- [ ] Public listing/detail discovery remains available where production data permits.
- [ ] Unknown routes return the branded real HTTP `404` behavior.
- [ ] Public Privacy Policy is available at `/privacy`.
- [ ] Public Terms of Service is available at `/terms`.
- [ ] Public Cookie Policy is available at `/cookies`.
- [ ] Public Help Center exposes the approved privacy/support/grievance discovery path.
- [ ] Approved TakeItEsee favicon/PWA/Apple-touch/social identity remains intact.

Do not fabricate catalog success if production has no representative published data; distinguish an empty valid state from an application failure.

## 6. Auth and private-boundary smoke

Use only safe non-finance checks:

- [ ] Guest access to private notification APIs fails closed.
- [ ] `/notifications` remains private/noindex/noarchive.
- [ ] Guest access to Super Admin readiness fails closed without privileged details.
- [ ] Signup/legal-consent behavior remains intact.
- [ ] Password recovery and email-confirmation routes remain private and fail closed for invalid requests.
- [ ] Account Security, Privacy request, and Platform Support surfaces remain authenticated.

Do not create or elevate a privileged identity solely to make a launch checklist green.

## 7. Provider / marketplace non-finance smoke

Where safe representative accounts/data are already available:

- [ ] Provider schedule/availability reads remain functional.
- [ ] Provider verification/publication rules still require the approved consumer-facing legal/contact/grievance disclosure.
- [ ] Customer/provider booking workflow smoke is limited to non-payment lifecycle behavior while finance remains HOLD.
- [ ] Authorization remains ownership/participant/scoped-admin/Super-Admin guarded as designed.

Do not cross into payment, refund, payout, settlement, reconciliation, dispute, or recovery behavior.

## 8. Runtime observation window

For the exact production deployment, inspect the release window after canonical health/smoke traffic:

- [ ] No unexplained `error` or `fatal` runtime clusters.
- [ ] No unexplained deployment-scoped `5xx` responses.
- [ ] No unresolved Vercel toolbar feedback that blocks launch.
- [ ] No repeated health/database degradation.

Use the production monitoring runbook for severity classification and escalation. Do not invent an SLA or error budget that has not been formally approved and continuously measured.

## 9. Supabase operational gate

For canonical project `bukrpkymivkhdpueropt`:

- [ ] Project is healthy/reachable.
- [ ] No new non-finance Security Advisor blocker was introduced by the release.
- [ ] No new non-finance Performance Advisor blocker requiring launch action was introduced.
- [ ] Intentional SECURITY DEFINER functions are reviewed in context rather than having grants blindly revoked.
- [ ] Finance-related advisor notices remain classified inside HOLD where applicable.
- [ ] Leaked-password protection is still marked HOLD unless Pro has been explicitly resumed, enabled, and re-audited.

## 10. Recovery readiness before launch

- [ ] Production incident-response runbook is available.
- [ ] Production data-recovery runbook is available.
- [ ] Operator understands that database restore and Storage object-byte recovery are separate concerns.
- [ ] No production restore drill is run merely for launch closure.
- [ ] No paid backup/PITR entitlement is claimed unless verified on the canonical project.

If recovery is needed during a real incident, preserve evidence and prefer a reviewed forward fix when safer than rewinding valid later writes.

## 11. Legal, privacy, and support handoff

- [ ] Privacy Policy, Terms, and Cookie Policy remain production-published.
- [ ] Approved legal operator/contact/grievance information remains unchanged unless formally updated.
- [ ] Signed-in privacy request workflow remains available.
- [ ] Signed-in platform support/grievance workflow remains available.
- [ ] Guest grievance fallback remains discoverable through the approved public path.
- [ ] Privacy/support status notifications route users back to the correct account surfaces.

## 12. Launch evidence record

Record at minimum:

- release date/time and timezone
- PR number
- authoritative merged `main` SHA
- exact Vercel production deployment ID
- canonical health result and reported release
- CI result: Type check / Lint / Production build / required `web`
- runtime error result
- deployment-scoped 5xx result
- unresolved Vercel feedback result
- canonical Supabase health/advisor result where checked
- any intentional warnings/deferred items
- confirmation that Finance/Cashfree HOLD was preserved
- confirmation that Supabase Pro/leaked-password HOLD was preserved unless explicitly resumed

Never place credentials, service-role keys, auth tokens, customer PII, raw sensitive logs, or production database dumps in the evidence record.

## 13. Go-live decision

### GO — non-finance public launch

A non-finance GO may be declared when:

1. required CI is green,
2. exact merged SHA is deployed READY to production,
3. canonical health is green and reports the correct release,
4. representative non-finance smoke is clean,
5. runtime errors and deployment-scoped 5xx show no unexplained blocker,
6. no unresolved launch-blocking feedback remains,
7. no new non-finance Supabase blocker is present,
8. legal/privacy/support surfaces remain available,
9. incident/recovery/monitoring procedures are available, and
10. all HOLD boundaries remain intact and accurately represented.

### NO-GO

Declare NO-GO for the non-finance launch if any required gate above fails or the release cannot be tied unambiguously to the authoritative merged SHA.

Do **not** convert a NO-GO into GO by activating Finance/Cashfree or purchasing/enabling a paid security/backup capability without explicit approval.

## 14. Post-launch handoff

After GO:

- keep the exact release/deployment evidence,
- continue lightweight production monitoring,
- route incidents through the incident-response runbook,
- route recovery decisions through the data-recovery runbook,
- handle privacy/support requests through their established workflows,
- treat future changes as normal protected releases rather than editing production ad hoc.

The next separate activation programs are intentionally outside this checklist:

1. Supabase Pro leaked-password protection, after plan upgrade and explicit resume instruction.
2. Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery activation, only after the Finance HOLD is explicitly lifted.
