# Phase 15 launch activation gate

Last audited: 2026-09-02 (Asia/Kolkata)

This document is the current TakeItEsee public-launch readiness gate. Real customer payments, Cashfree behavior, refunds, payouts, recovery, settlement, reconciliation, cash collection, and INR finance activation remain explicitly **HOLD**. Launch-readiness work must not activate or alter that scope indirectly.

## Current production baseline

- Canonical public domain: `https://www.takeitesee.com`.
- Canonical production Supabase project: `bukrpkymivkhdpueropt`.
- Current audited production release: `689151ffd4b831575c3bd3e8ab12d21f20206ea9`.
- Current audited Vercel deployment: `dpl_6wpwDV7A8FN8W4Z1PyEevqQK2nHQ`.
- `GET /api/health` returned `status=ok`, `app=ok`, `database=ok`, release `689151ffd4b8`.
- Deployment-scoped runtime verification returned zero `error`/`fatal` entries and zero `5xx` entries after the Cookie Policy production smoke.
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
- Production password recovery exists at `/forgot-password` and `/reset-password` with private/no-store/noindex behavior.
- Production email-confirmation callback support exists at `/auth/confirm` and fails closed for invalid or unsupported requests.
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
- PR `#184`: published the approved Cookie Policy at `/cookies`, linked it from the footer, removed the final legal-policy pending notice, and added it to the public sitemap. Required `web` CI passed; exact deployment `dpl_6wpwDV7A8FN8W4Z1PyEevqQK2nHQ` returned `/cookies` `200`, canonical/indexable metadata, `/api/health` release `689151ffd4b8`, zero deployment-scoped `error`/`fatal`, zero `5xx`, and zero unresolved Vercel toolbar feedback.

All closures above preserved the Finance/Cashfree HOLD boundary.

## Final non-finance candidate state

The broad PR `#177` production smoke covered public discovery, private/auth boundaries, 404 behavior, health, runtime, Vercel feedback, and Supabase advisors. Subsequent PRs were independently CI-gated and production-verified for their scoped changes.

The current release `689151ffd4b831575c3bd3e8ab12d21f20206ea9` has the complete approved public legal surface:

- `/privacy` — Privacy Policy,
- `/terms` — Terms of Service,
- `/cookies` — Cookie Policy.

All three routes are linked from the global footer and included in the canonical public sitemap. The Cookie Policy production response carried the exact deployment marker `dpl_6wpwDV7A8FN8W4Z1PyEevqQK2nHQ`, returned HTTP `200`, and rendered the approved effective/updated date and legal contact details.

Result: the **implemented non-finance application candidate remains production-smoke clean**, and the brand/legal launch-readiness gates are closed.

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

Public non-finance launch readiness and finance activation are separate gates. Clearing website, security, reliability, SEO, auth, brand, legal, or repository-governance blockers must never activate payment or finance behavior indirectly.
