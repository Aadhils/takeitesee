# Phase 15 launch activation gate

Last audited: 2026-09-02 (Asia/Kolkata)

This gate records the current TakeItEsee public-launch readiness state. Real customer payments, Cashfree behavior, refunds, payouts, recovery, settlement, reconciliation, and INR finance activation remain explicitly **HOLD** and must not be changed or activated as a side effect of launch-readiness work.

## Current production baseline

- Canonical public domain: `https://www.takeitesee.com`.
- Canonical production Supabase project: `bukrpkymivkhdpueropt`.
- Current audited production release: `baa990a7b3f5030272aa0854a697e35b2f1026fd`.
- Current audited Vercel deployment: `dpl_3L3qp7ejhQvzB9GvjVw4h2sujC6r`.
- `GET /api/health` returned `status=ok`, `app=ok`, `database=ok`, release `baa990a7b3f5`.
- Fresh deployment-scoped runtime verification returned zero `error`/`fatal` entries and zero `5xx` entries.

## Verified green gates

- `takeitesee.com` / `www.takeitesee.com` use the canonical Supabase project `bukrpkymivkhdpueropt`.
- Sitemap, robots, canonical-domain, and public/private indexability audits are clean.
- Public discovery routes use indexable canonical metadata; private/account/provider workflow surfaces use `noindex`/`nofollow` and `X-Robots-Tag` protections where applicable.
- Representative production smoke checks for home, explore, categories, login, provider onboarding, guest bookings, 404 recovery, password-recovery pages, email-confirmation failure handling, and `/api/health` completed without production runtime errors.
- Unknown routes return a real HTTP `404` with branded recovery UI and automatic `noindex` behavior.
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
- Hosted Supabase Auth production configuration is now manually verified: canonical Site URL is `https://www.takeitesee.com`, production redirect URLs cover the canonical origins and reset-password destinations, and the confirmation template uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- Production auth email delivery now uses custom SMTP through Resend with the verified sending subdomain `auth.takeitesee.com`; DKIM and sending/SPF-related DNS records are verified. No SMTP secret or API key is stored in this document.
- A real production signup completed `signup -> confirmation email -> /auth/confirm -> authenticated account` successfully.
- A real production password-recovery flow completed `forgot password -> recovery email -> /reset-password -> password update -> sign out -> fresh password sign-in` successfully.
- Supabase email/password minimum password length is now `8`, matching the application-side minimum.
- GitHub repository governance is active for the default `main` branch through the `Main branch protection` ruleset: pull requests are required, required approvals are `0` for the solo workflow, squash is the only allowed merge method, GitHub Actions check `web` is required, branch deletion and force pushes are blocked, and the bypass list is empty.
- Guest production access to `GET /api/super-admin/readiness` fails closed with HTTP `401` and does not expose readiness/configuration details.
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

Subsequent manual production configuration closed the hosted Auth email-delivery/E2E gate and the GitHub `main` governance gate without changing application code, database behavior, or Finance/Cashfree scope.

All of these closures preserved the Finance/Cashfree HOLD boundary.

## Intentional Supabase Security Advisor warnings

A small set of anonymous SECURITY DEFINER warnings remains intentionally where functions are required by public marketplace availability or RLS policy evaluation. Signed-in SECURITY DEFINER warnings also remain for authenticated customer/provider/admin workflows.

Live function-definition review previously confirmed the audited functions use an empty fixed search path and explicit ownership, participant, scoped Admin, or Super Admin authorization checks. Removing the `authenticated` grant solely to silence the Advisor would break legitimate application workflows and is not part of this hardening step.

Fresh Security Advisor review continues to report finance/payment/payout/recovery-related notices. Those items remain inside the explicit Finance/Cashfree HOLD boundary and are not launch-readiness change targets.

## Remaining non-finance launch blockers

### 1. Supabase leaked-password protection

The Supabase Security Advisor reports leaked-password protection as disabled. Direct dashboard review confirmed that `Prevent use of leaked passwords` is unavailable on the current project plan and is marked as requiring the Supabase Pro plan or above.

The application and Supabase email provider now both enforce an 8-character minimum password, but leaked-password screening remains a plan-level external launch blocker. Do not represent this item as green until the project is on a plan that exposes the setting and the protection is enabled and re-audited.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. Final square brand asset

Favicon, web-app manifest icons, and social-image work remain blocked because a proper approved square TakeItEsee brand asset has not been supplied. Do not invent, crop, redraw, or substitute a brand mark merely to clear this gate.

### 3. Final legal policy text

Privacy Policy, Terms of Service, and Cookie Policy remain blocked pending approved legal text. Current product UI intentionally indicates that legal policy documents are being finalized. Do not fabricate legal terms to clear this gate.

## Closed manual/external gates

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
