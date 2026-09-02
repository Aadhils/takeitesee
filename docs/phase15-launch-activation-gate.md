# Phase 15 launch activation gate

Last audited: 2026-09-02 (Asia/Kolkata), after PR `#193` production verification.

This document is the current TakeItEsee public-launch readiness gate. Real customer payments, Cashfree behavior, refunds, payouts, recovery, settlement, reconciliation, cash collection, and INR finance activation remain explicitly **HOLD**. Launch-readiness work must not activate or alter that scope indirectly.

## Current production baseline

- Canonical public domain: `https://www.takeitesee.com`.
- Canonical production Supabase project: `bukrpkymivkhdpueropt`.
- Current audited production release: `268afa8a2cdce7ace0facf23a79f70fd1033f60b`.
- Current audited Vercel deployment: `dpl_9Rtf5do9NwxmWmMvtszvuRNy2CyL`.
- The deployment Git commit matches the audited production release exactly and is `READY` with both `www.takeitesee.com` and `takeitesee.com` aliases attached.
- `GET /api/health` returned `status=ok`, `app=ok`, `database=ok`, release `268afa8a2cdc`.
- Guest `GET /api/notifications` returned HTTP `401` with `no-store`; the `/notifications` surface remains private/noindex/noarchive.
- Deployment-scoped runtime verification returned zero `error`/`fatal` entries and zero `5xx` entries after the PR `#193` smoke.
- Vercel reported zero unresolved toolbar-feedback threads for the production project during the same audit window.

## Verified green gates

- `takeitesee.com` and `www.takeitesee.com` use canonical production infrastructure and the canonical Supabase project.
- Public sitemap, robots, canonical-domain, and public/private indexability audits are clean.
- Public discovery routes use canonical/indexable metadata; private account/provider/workflow surfaces use appropriate noindex protections.
- Unknown routes return a real HTTP `404` with branded recovery UI and framework noindex behavior.
- Root-level application failures have a self-contained `global-error.tsx` recovery fallback.
- Required anonymous marketplace/RLS helpers remain available while mutating or user-specific SECURITY DEFINER RPC execution is restricted appropriately.
- Audited authenticated customer/provider/Admin/Super Admin RPCs use ownership, participant, scoped-management, or Super Admin authorization checks.
- Provider onboarding, core marketplace history/event, and Admin control-plane non-finance foreign-key relationships have covering indexes.
- Live catalog verification reports **zero remaining unindexed non-finance foreign keys**. Remaining finance/payment/refund/payout/recovery/settlement warnings remain inside HOLD scope.
- Production signup correctly handles Supabase email-confirmation pending sessions.
- Signup requires an explicit 18+ acknowledgement and explicit Terms of Service / Privacy Policy acceptance; accepted legal versions are recorded server-side without fabricating acceptance for older accounts.
- Production password recovery exists at `/forgot-password` and `/reset-password` with private/no-store/noindex behavior.
- Production email-confirmation callback support exists at `/auth/confirm` and fails closed for invalid or unsupported requests.
- Signed-in Account Security supports current-password re-verification and password change; secure email-change self-service is also available.
- Hosted Supabase Auth production Site URL, redirect URLs, Resend SMTP delivery, confirmation template, and real signup/password-recovery E2E have been verified.
- Supabase email/password minimum password length is `8`, matching the application minimum.
- GitHub `main` governance requires a pull request and required `web` GitHub Actions check, allows squash-only merging, blocks deletion/non-fast-forward changes, and has no bypass actors.
- Guest access to `GET /api/super-admin/readiness` fails closed with HTTP `401` without exposing privileged readiness details.
- The approved TakeItEsee logo is the source of truth for favicon/PWA/Apple-touch/social-image routes and public metadata.
- Provider verification requires consumer-facing legal/public-contact/grievance disclosure before approval and public service publication.
- **Privacy Policy** is production-published at `/privacy`, canonical/indexable, linked from the global footer, and included in the public sitemap.
- **Terms of Service** is production-published at `/terms`, canonical/indexable, linked from the global footer, and included in the public sitemap.
- **Cookie Policy** is production-published at `/cookies`, canonical/indexable, linked from the global footer, and included in the public sitemap.
- The global footer no longer shows any legal-policy `being finalized` notice.
- Signed-in customers can submit and track privacy access/correction/deletion-review requests; deletion remains a reviewed/manual process rather than automatic deletion.
- Signed-in customers can submit and track non-booking platform support/grievance requests; booking-specific support remains a separate workflow and the approved Grievance Officer email remains the guest fallback.
- Privacy and platform-support review changes now create customer notifications routed directly to `/account/privacy` or `/account/support`; no-op review updates do not generate a notification.
- The notification routing addition reused the existing non-finance `support_updated` event type, preserved existing notification rows, and did not alter payment/refund/payout notification event types or behavior.
- INR finance policy remains inactive.

## Production closures completed during Launch Readiness

- PR `#163`: production auth/return-path closure; exact deployment runtime `error/fatal = 0`, `5xx = 0`.
- PR `#164`: root-level global error fallback; CI green and production runtime clean.
- PR `#165`: 17 non-finance Provider onboarding/verification/trust/service-launch foreign-key indexes.
- PR `#166`: 4 core marketplace event/history foreign-key indexes.
- PR `#167`: 6 Admin control-plane foreign-key indexes.
- PR `#168`: refreshed launch-gate evidence after non-finance FK-index closure.
- PR `#169`: session-aware signup pending-email-confirmation UX.
- PR `#170`: production password-recovery request/update flow.
- PR `#171`: password-recovery metadata title correction.
- PR `#172`: secure SSR `/auth/confirm` token-hash confirmation route.
- PR `#173`: bilingual invalid/expired confirmation-link guidance.
- PR `#174`: refreshed auth-gate evidence.
- PR `#175`: recorded real Auth email E2E and GitHub `main` ruleset closure evidence.
- PR `#176`: separated public non-finance launch readiness from Super Admin finance-readiness.
- PR `#177`: recorded the final broad non-finance production launch-candidate smoke/audit baseline.
- PR `#178`: closed approved TakeItEsee brand web-identity assets with deterministic favicon/PWA/Apple-touch/social image routes.
- PR `#179`: propagated the approved social image into nested public Open Graph/Twitter metadata.
- PR `#180`: published the approved Privacy Policy at `/privacy`, linked it from the footer, and added it to the public sitemap.
- PR `#181`: required provider consumer-facing legal/public-contact/grievance disclosure before verification approval and public service publication; production migration and trigger-helper execution hardening were verified.
- PR `#182`: published the approved Terms of Service at `/terms`, linked it from the footer, and added it to the public sitemap.
- PR `#183`: refreshed legal-gate evidence after the Terms production closure.
- PR `#184`: published the approved Cookie Policy at `/cookies`, linked it from the footer, removed the final legal-policy pending notice, and added it to the public sitemap.
- PR `#185`: refreshed the launch gate after the complete approved Privacy/Terms/Cookie legal surface was production-verified.
- PR `#186`: required 18+ and Terms/Privacy signup consent and recorded accepted legal versions server-side without backfilling existing accounts.
- PR `#187`: added signed-in privacy access/correction/deletion-review requests, customer request history, guarded Super Admin review, and immutable customer request-core fields.
- PR `#188`: added signed-in Account Security with current-password re-verification and password-change self-service.
- PR `#189`: removed stale disabled Account Settings actions and linked the live Account Security and Privacy/deletion-review workflows.
- PR `#190`: added secure signed-in email-change self-service and a private confirmed-auth-email profile sync path.
- PR `#191`: exposed platform grievance and privacy-help discovery from the public Help Center while preserving the approved guest grievance-email path.
- PR `#192`: added signed-in non-booking platform support/grievance submission and history plus a guarded Super Admin review queue; production release `cefa8c18828b51050c425bd637d654c37d077223` was smoke-clean.
- PR `#193`: added privacy/platform-support status notifications using guarded private trigger helpers and an internal notification `target_path`; required `web` CI passed, canonical Supabase migration/advisors were verified, and exact production deployment `dpl_9Rtf5do9NwxmWmMvtszvuRNy2CyL` returned healthy release `268afa8a2cdc` with zero deployment-scoped `error`/`fatal`, zero `5xx`, and zero unresolved Vercel feedback.

All closures above preserved the Finance/Cashfree HOLD boundary.

## Final non-finance candidate state

The broad PR `#177` production smoke covered public discovery, private/auth boundaries, 404 behavior, health, runtime, Vercel feedback, and Supabase advisors. Subsequent PRs were independently CI-gated and production-verified for their scoped changes.

The current release `268afa8a2cdce7ace0facf23a79f70fd1033f60b` includes the approved public legal surface plus the subsequent non-finance account and support closures:

- `/privacy` — approved Privacy Policy,
- `/terms` — approved Terms of Service,
- `/cookies` — approved Cookie Policy,
- signup 18+/legal-consent capture,
- `/account/privacy` — signed-in privacy request submission/history,
- `/account/security` — signed-in password/email security self-service,
- `/account/support` — signed-in platform support/grievance submission/history,
- `/notifications` — private notification center with direct routing for privacy/support review updates.

The exact PR `#193` production deployment is `dpl_9Rtf5do9NwxmWmMvtszvuRNy2CyL`. It is `READY`, carries both canonical domains, and the canonical health endpoint reports app/database green at release `268afa8a2cdc`. Guest notification API access remains fail-closed and the notification page remains noindex/noarchive.

Result: the **implemented non-finance application candidate remains production-smoke clean**, with brand, legal, account-security, privacy-request, platform-support/grievance, and request-status-notification launch-readiness gates closed.

## Remaining non-finance launch blocker

### Supabase leaked-password protection

The Supabase Security Advisor reports leaked-password protection as disabled. Dashboard review confirmed that `Prevent use of leaked passwords` requires the Supabase Pro plan or above and is unavailable on the current plan.

The application and Supabase email provider enforce an 8-character minimum password, but leaked-password screening remains an external plan-level gate. Do not represent this item as green until:

1. the canonical Supabase project is upgraded to a plan exposing the setting,
2. `Prevent use of leaked passwords` is enabled in Supabase Auth,
3. a fresh Security Advisor audit confirms the leaked-password warning is cleared.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Closed manual/external gates

### Approved TakeItEsee brand asset and web identity

Closed on 2026-09-02 after the product owner reconfirmed `official-takeitesee-logo.png` as the final approved artwork and approved deriving deterministic web identity assets from that exact artwork. The implementation does not redraw or substitute the approved brand mark.

### Hosted Supabase Auth configuration and real-email E2E

Closed on 2026-09-02 after canonical Site URL/redirect configuration, verified Resend SMTP delivery, secure token-hash confirmation template configuration, real signup confirmation E2E, real password-recovery E2E, and fresh password sign-in verification.

### GitHub `main` branch protection

Closed with the active `Main branch protection` ruleset requiring PRs and the `web` check, squash-only merging, deletion/non-fast-forward protection, zero approvals for the current solo workflow, and no bypass actors.

### Approved legal policies

Closed on 2026-09-02 after explicit product-owner approval and production publication of all three public legal policies:

- Privacy Policy via PR `#180` at `/privacy`,
- Terms of Service via PR `#182` at `/terms`,
- Cookie Policy via PR `#184` at `/cookies`.

The legal operator is UV MART Enterprises Private Limited. The policies publish the approved business address, Grievance Officer/contact, and 18+ account/service age policy. Provider consumer-grievance disclosure supporting the marketplace Terms architecture was separately closed through PR `#181`.

## Intentional Supabase advisor notices

Some SECURITY DEFINER notices remain intentional where functions are required for public marketplace availability, RLS policy evaluation, or authenticated application workflows. Prior live definition review confirmed fixed search paths and explicit authorization context for the audited functions.

The PR `#193` private notification trigger helpers are not directly executable by `public`, `anon`, or `authenticated`, run with an empty fixed search path, and produced no new Security/Performance Advisor blocker.

Fresh finance/payment/payout/recovery-related advisor notices remain inside the explicit Finance/Cashfree HOLD boundary and are not non-finance launch-readiness change targets.

## Deferred finance-only privileged readiness

`GET /api/super-admin/readiness` is a Super Admin-only finance-readiness surface combining database/security probes with Cashfree Payments, Cashfree Payouts, sandbox-payment evidence, and INR finance-policy state. Guest access correctly returns HTTP `401` without privileged readiness details.

A full privileged finance-readiness run is intentionally deferred until Finance/Cashfree HOLD is explicitly lifted. Do not create or elevate a privileged identity, expose a service-role key, activate gateway credentials, or run payment/payout E2E merely to make this finance-only panel green.

## Finance / Cashfree / payment HOLD

Cashfree, payment, cash collection, refunds, payouts, disputes/chargebacks, recovery, settlement, reconciliation, and INR finance behavior remain **HOLD**.

Do not:

- activate Cashfree sandbox or production credentials,
- change payment/refund/payout/recovery/settlement behavior,
- change finance policies, functions, indexes, state machines, or activation flags,
- run payment/refund/payout end-to-end scenarios,
- enable INR finance policy.

Resume finance work only after the HOLD is explicitly lifted in a later instruction.

## Production activation remains separate

Public non-finance launch readiness and finance activation are separate gates. Clearing website, security, reliability, SEO, auth, brand, legal, repository-governance, privacy/support workflows, or notification blockers must never activate payment or finance behavior indirectly.
