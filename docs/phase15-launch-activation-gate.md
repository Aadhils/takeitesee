# Phase 15 launch activation gate

Last audited: 2026-09-02 (Asia/Kolkata)

This gate records the current TakeItEsee public-launch readiness state. Real customer payments, Cashfree behavior, refunds, payouts, recovery, settlement, reconciliation, cash collection, and INR finance activation remain explicitly **HOLD** and must not be changed or activated as a side effect of launch-readiness work.

## Current production baseline

- Canonical public domain: `https://www.takeitesee.com`.
- Canonical production Supabase project: `bukrpkymivkhdpueropt`.
- Current audited production release: `19a2d0775aa7ce2752261cc21f59fcbce1aebba5`.
- Current audited Vercel deployment: `dpl_CqjbwZJbobAAaJnQznpK2RR2TgAr`.
- `GET /api/health` returned `status=ok`, `app=ok`, `database=ok`, release `19a2d0775aa7`.
- Fresh deployment-scoped runtime verification returned zero `error`/`fatal` entries and zero `5xx` entries after the Terms of Service production smoke.
- Vercel reported zero unresolved toolbar-feedback threads for the production project during the same audit window.

## Verified green gates

- `takeitesee.com` / `www.takeitesee.com` use the canonical Supabase project `bukrpkymivkhdpueropt`.
- Sitemap, robots, canonical-domain, and public/private indexability audits are clean.
- Public discovery routes use indexable canonical metadata; private/account/provider workflow surfaces use `noindex`/`nofollow` and `X-Robots-Tag` protections where applicable.
- Representative production smoke checks for home, explore, categories, professionals, businesses, login, account guest state, provider onboarding, guest bookings, 404 recovery, password-recovery pages, email-confirmation failure handling, and `/api/health` completed without production runtime errors.
- Unknown routes return a real HTTP `404` with branded recovery UI and automatic framework `noindex` behavior.
- Root-level application failures have a self-contained `global-error.tsx` recovery fallback with retry/home actions.
- Anonymous execution was removed from mutating and user-specific SECURITY DEFINER RPCs.
- Trigger-only SECURITY DEFINER functions are no longer directly executable by `anon` or `authenticated` API roles.
- Required anonymous marketplace/RLS helpers remain available.
- Audited authenticated customer/provider RPCs use `auth.uid()` plus ownership/participant authorization context.
- Audited Admin/Super Admin RPCs use explicit scoped manage or Super Admin authorization checks, including self-action protections where required.
- A fresh unprivileged authenticated identity receives no Admin/Super Admin/platform-manage authority.
- Provider and platform-manage test identities are separated in the current live data footprint.
- Provider onboarding, core marketplace event/history, and Admin control-plane non-finance foreign-key relationships now have covering indexes.
- Live catalog verification reports **zero remaining unindexed non-finance foreign keys**. Remaining unindexed foreign keys belong only to finance/payment/refund/payout/recovery/settlement HOLD scope and are intentionally untouched.
- Production signup is session-aware: when Supabase requires email confirmation and returns `session=null`, the app does not send the user into an unauthenticated account redirect loop.
- Production password-recovery UX exists at `/forgot-password` and `/reset-password`, with no-store/noindex protections and generic reset-request copy that avoids account enumeration.
- Production signup email-confirmation callback support exists at `/auth/confirm` for the documented Supabase token-hash `type=email` flow. Missing, unsupported, invalid, or failed confirmation requests fail closed without leaking token values or raw Supabase errors.
- Invalid/expired email-confirmation links land on the private login surface with visible English/Tamil guidance.
- Hosted Supabase Auth production configuration is manually verified: canonical Site URL is `https://www.takeitesee.com`, production redirect URLs cover the canonical origins and reset-password destinations, and the confirmation template uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- Production auth email delivery uses custom SMTP through Resend with the verified sending subdomain `auth.takeitesee.com`; DKIM and sending/SPF-related DNS records are verified. No SMTP secret or API key is stored in this document.
- A real production signup completed `signup -> confirmation email -> /auth/confirm -> authenticated account` successfully.
- A real production password-recovery flow completed `forgot password -> recovery email -> /reset-password -> password update -> sign out -> fresh password sign-in` successfully.
- Supabase email/password minimum password length is `8`, matching the application-side minimum.
- GitHub repository governance is active for the default `main` branch through the `Main branch protection` ruleset: pull requests are required, required approvals are `0` for the solo workflow, squash is the only allowed merge method, GitHub Actions check `web` is required, branch deletion and force pushes are blocked, and the bypass list is empty.
- Guest production access to `GET /api/super-admin/readiness` fails closed with HTTP `401` and does not expose readiness/configuration details.
- The approved TakeItEsee logo is the source of truth for favicon/PWA/Apple-touch/social-image routes and public metadata.
- The approved Privacy Policy is publicly available at `/privacy`, linked from the footer, canonical/indexable, and present in the public sitemap.
- Provider verification now requires consumer-facing legal/public-contact/grievance disclosure before approval and before public service publication. Trigger-only disclosure helpers are not directly executable by API roles.
- The approved Terms of Service is publicly available at `/terms`, linked from the footer, canonical/indexable, and present in the public sitemap.
- INR finance policy remains inactive.

## Production closures completed during Launch Readiness

- PR `#163`: production auth/return-path closure; exact deployment runtime `error/fatal = 0`, `5xx = 0`.
- PR `#164`: root-level global error fallback; CI green and production runtime clean.
- PR `#165`: 17 non-finance Provider onboarding/verification/trust/service-launch foreign-key indexes; canonical production migration applied and verified.
- PR `#166`: 4 core marketplace event/history foreign-key indexes; canonical production migration applied and verified.
- PR `#167`: 6 Admin control-plane foreign-key indexes; canonical production migration applied and verified.
- PR `#168`: refreshed launch-gate evidence after the non-finance FK-index closure.
- PR `#169`: made production signup aware of pending email confirmation and preserved the return path for the later sign-in step.
- PR `#170`: added production Supabase password-recovery request/update flow and private recovery routes.
- PR `#171`: corrected password-recovery page metadata titles while preserving private/noindex behavior.
- PR `#172`: added the secure Supabase SSR `/auth/confirm` token-hash email-confirmation route; exact deployment runtime `error/fatal = 0`, `5xx = 0`.
- PR `#173`: added safe bilingual invalid/expired confirmation-link guidance on the login surface; exact deployment runtime `error/fatal = 0`, `5xx = 0`.
- PR `#174`: refreshed the auth-gate evidence after the code-side confirmation/recovery sequence; production deployment remained healthy and runtime-clean.
- PR `#175`: refreshed manual gate evidence after real Auth email E2E and GitHub `main` ruleset closure; required `web` CI passed under the new ruleset and the exact production deployment remained healthy and runtime-clean.
- PR `#176`: separated the Super Admin finance-readiness gate from public non-finance launch readiness; the exact production deployment remained healthy and guest access to the privileged readiness API continued to fail closed.
- PR `#177`: recorded the final non-finance production launch-candidate audit; public/private smoke, SEO, health, runtime, Vercel feedback, and Supabase advisor checks remained clean.
- PR `#178`: closed the approved TakeItEsee brand-asset/web-identity gate using deterministic favicon/PWA/Apple-touch/social image routes derived from the approved source artwork.
- PR `#179`: propagated the approved social image into nested public Open Graph/Twitter metadata.
- PR `#180`: published the approved Privacy Policy at `/privacy`, linked it from the footer, and added it to the public sitemap.
- PR `#181`: required provider consumer-facing legal/public-contact/grievance disclosure before verification approval and public service publication; canonical production migration applied and verified, including direct-execute hardening for trigger-only helpers.
- PR `#182`: published the approved Terms of Service at `/terms`, linked it from the footer, added it to the public sitemap, and changed the footer legal-readiness note so only Cookie Policy remains pending. Required `web` CI passed and exact production deployment `dpl_CqjbwZJbobAAaJnQznpK2RR2TgAr` remained healthy and runtime-clean.

All of these closures preserved the Finance/Cashfree HOLD boundary.

## Final non-finance launch candidate audit (PR #177 baseline)

The broad final production smoke and advisor pass was completed against release `2138d84754c09538ff001e396fcfd487b78e42db` / deployment `dpl_8qTNVtxakazRSkEjGomhkFGjHZXn`. Subsequent PRs `#178` through `#182` were separately CI-gated, deployed, and production-verified for their scoped changes.

### Public discovery and SEO

- `/` returned `200`, the exact deployment marker, canonical `https://www.takeitesee.com`, indexable metadata, and WebSite structured data.
- `/explore`, `/categories`, `/professionals`, and `/businesses` returned `200` with canonical/indexable metadata and graceful live-catalog empty states where the production catalog currently has no qualifying rows.
- `/robots.txt` allows public discovery while disallowing private/API/account/provider/workflow paths and points to the canonical sitemap.
- `/sitemap.xml` contains only public discovery/help/legal routes and does not include private account, booking, provider, notification, requirement, review, or Admin surfaces.

### Auth and private boundaries

- `/login` is private/noindex and exposes the password-recovery entry point.
- `/forgot-password` and `/reset-password` return `200` with `Cache-Control: no-store, max-age=0` plus `noindex, nofollow, noarchive` protections.
- Guest `/account`, `/bookings`, and `/provider/onboarding` responses expose only generic unauthenticated/checking shells and no customer/provider records.
- Guest `/super-admin` does not expose Super Admin UI or data; the request resolves to the generic account-entry surface. The privileged readiness API separately returns `401` for guests.
- A deliberately unknown production path returned a real HTTP `404` with branded recovery actions and framework-injected `noindex` behavior.

### Database and runtime

- The canonical Supabase project URL resolves to `bukrpkymivkhdpueropt`.
- Fresh Security Advisor output contains the already-known leaked-password warning, intentional audited SECURITY DEFINER notices, and finance/payment HOLD notices; no new non-finance security blocker was identified.
- Fresh Performance Advisor output reconfirmed that remaining missing foreign-key indexes and RLS performance warnings are in finance/payment/refund/payout/recovery/settlement scope. Newly-added non-finance indexes may appear as `unused_index` INFO on the current low-data marketplace; this is not evidence that they should be removed.
- The broad PR `#177` baseline health check remained `app=ok`, `database=ok` and runtime-clean.
- Current release `19a2d0775aa7ce2752261cc21f59fcbce1aebba5` was separately verified after PR `#182`: `/terms` returned `200` with canonical/indexable metadata, the footer linked Privacy Policy and Terms of Service while leaving Cookie Policy pending, `/sitemap.xml` included `/privacy` and `/terms`, `/api/health` returned release `19a2d0775aa7`, deployment-scoped `error`/`fatal` logs were zero, deployment-scoped `5xx` logs were zero, and unresolved Vercel toolbar feedback was zero.

Result: the **implemented non-finance application candidate is production-smoke clean**. Public launch is still not declared fully ready because the external/manual blockers below remain open.

## Intentional Supabase Security Advisor warnings

A small set of anonymous SECURITY DEFINER warnings remains intentionally where functions are required by public marketplace availability or RLS policy evaluation. Signed-in SECURITY DEFINER warnings also remain for authenticated customer/provider/admin workflows.

Live function-definition review previously confirmed the audited functions use an empty fixed search path and explicit ownership, participant, scoped Admin, or Super Admin authorization checks. Removing the `authenticated` grant solely to silence the Advisor would break legitimate application workflows and is not part of this hardening step.

Fresh Security Advisor review continues to report finance/payment/payout/recovery-related notices. Those items remain inside the explicit Finance/Cashfree HOLD boundary and are not launch-readiness change targets.

## Remaining non-finance launch blockers

### 1. Supabase leaked-password protection

The Supabase Security Advisor reports leaked-password protection as disabled. Direct dashboard review confirmed that `Prevent use of leaked passwords` is unavailable on the current project plan and is marked as requiring the Supabase Pro plan or above.

The application and Supabase email provider both enforce an 8-character minimum password, but leaked-password screening remains a plan-level external launch blocker. Do not represent this item as green until the project is on a plan that exposes the setting and the protection is enabled and re-audited.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. Cookie Policy

Privacy Policy and Terms of Service are approved and published. **Cookie Policy remains the only pending legal-policy document.**

Current product UI intentionally links the approved Privacy Policy and Terms of Service while showing Cookie Policy as still being finalized. Do not fabricate Cookie Policy text merely to clear this gate; publication requires explicit approved wording followed by the normal PR, CI, production deployment, and smoke-verification workflow.

## Closed manual/external gates

### Approved TakeItEsee brand asset and web identity

Closed on 2026-09-02 after the product owner reconfirmed the existing `official-takeitesee-logo.png` artwork as the final approved TakeItEsee logo and explicitly approved deriving web identity assets from that exact artwork.

The implementation keeps the approved logo file as the single source of truth and generates square favicon/PWA/Apple-touch images plus the 1200×630 social image without redrawing or substituting the brand mark. Root metadata and the web-app manifest reference those deterministic brand-image routes. Finance/Cashfree behavior is unaffected.

### Hosted Supabase Auth configuration and real-email E2E

Closed on 2026-09-02 after direct dashboard configuration and real production testing:

- canonical Site URL set to `https://www.takeitesee.com`,
- production redirect URLs configured for canonical origins and password recovery,
- custom Resend SMTP configured using the verified `auth.takeitesee.com` sending subdomain,
- confirmation template changed from `ConfirmationURL` to the SSR-compatible token-hash `/auth/confirm` link,
- real signup confirmation email delivered and established an authenticated account session,
- real password recovery email delivered, password update succeeded, and a fresh sign-in with the new password succeeded.

### GitHub `main` branch protection

Closed on 2026-09-02 with active repository ruleset `Main branch protection` targeting the default branch. The ruleset requires a pull request and GitHub Actions `web` status check, permits only squash merges, blocks deletion and non-fast-forward/force pushes, uses zero required approvals for the current solo workflow, and has no bypass actors.

### Privacy Policy and Terms of Service

Privacy Policy wording was approved and published through PR `#180` at `/privacy`. Terms of Service wording was explicitly approved on 2026-09-02 and published through PR `#182` at `/terms`. Both routes are canonical/indexable, linked from the global footer, use the approved brand social metadata, and are present in the public sitemap.

Provider consumer-grievance disclosure needed by the Terms architecture was closed before Terms publication through PR `#181`, including collection, Admin review visibility, public provider disclosure, server-side publishability gating, and trigger-helper execution hardening.

## Deferred finance-only privileged readiness

The existing `LaunchReadinessPanel` is rendered inside `/super-admin/finance`, after Admin authentication plus an explicit `super_admin` role check. Its API, `GET /api/super-admin/readiness`, combines server/database security probes with Cashfree Payments, Cashfree Payouts, sandbox payment evidence, and INR finance-policy state.

That endpoint's overall `blocked` / `sandbox_ready` result is therefore a **finance activation readiness result**, not a public non-finance launch result. While Finance/Cashfree remains HOLD, disabled or incomplete Cashfree/payout configuration and missing sandbox payment evidence are expected and must not be promoted into non-finance public-launch blockers.

Current production verification confirms that guest access to this API returns HTTP `401` with only `Authentication required.` and no privileged readiness payload. A full Super Admin finance-readiness run is intentionally deferred until the Finance/Cashfree HOLD is explicitly lifted. Do not create/elevate a privileged identity, expose a service-role key, activate gateway credentials, or run payment/payout E2E merely to make this finance-only panel green.

## Finance / Cashfree / payment HOLD

Cashfree, payment, cash collection, refunds, payouts, disputes/chargebacks, recovery, settlement, reconciliation, and INR finance behavior are **not part of the current autonomous launch-readiness tranche**.

Do not:

- activate Cashfree sandbox or production credentials,
- change payment/refund/payout/recovery/settlement behavior,
- change finance policies, functions, indexes, state machines, or activation flags,
- run payment/refund/payout end-to-end scenarios,
- enable INR finance policy.

Resume finance work only after the HOLD is explicitly lifted in a later instruction.

## Production activation remains separate

Public non-finance launch readiness and finance activation are separate gates. Clearing website, security, reliability, SEO, auth, brand, legal, or repository-governance blockers must never activate payment or finance behavior indirectly.

## Super Admin finance-readiness endpoint

`GET /api/super-admin/readiness` is Super Admin-only and reports booleans/configuration state without returning secret values or database rows. Guest access correctly returns an authorization failure instead of readiness details. Within the finance workspace it checks:

- canonical Supabase binding,
- service-role database access,
- RPC hardening state,
- public marketplace helper availability,
- INR finance policy activation state,
- Cashfree Payments mode/configuration completeness,
- Cashfree Payouts mode/configuration completeness,
- recent sandbox payment API/webhook evidence.

These finance-workspace checks remain deferred while Finance/Cashfree is HOLD and are not counted as public non-finance launch blockers.
