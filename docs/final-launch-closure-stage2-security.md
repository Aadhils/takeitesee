# TakeItEsee Final Launch Closure — Stage 2 Security Contextual Closure

Last audited: 2026-09-15 (Asia/Kolkata)

## Purpose

This document closes the Stage 2 non-finance security-context review defined by `docs/final-launch-closure-stage1.md`.

Stage 2 is not an attempt to make every generic Supabase Advisor warning disappear. The goal is to identify concrete unsafe authorization/exposure boundaries and change only those that are actually unsafe, while preserving intentional authenticated owner/participant/Admin RPC contracts.

## Hard boundaries

The following remain unchanged:

- One account = Customer + ONE final Provider identity — Professional OR Business, never both.
- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/dispute/recovery activation remains HOLD.
- Recurrence/recovery remains CLOSED / FROZEN.
- Supabase leaked-password protection remains HOLD until the product owner explicitly resumes it after the required plan capability is available.
- Canonical live Supabase remains `bukrpkymivkhdpueropt`.
- Legacy/non-canonical Supabase must not be used for launch decisions or writes.

## Stage 2 starting baseline

Stage 2 started from authoritative `main`:

`cb4bc85aa886597f9a816c78024b9f0b45ef2517`

The fresh canonical Security Advisor baseline contained:

- 3 anonymous-callable `SECURITY DEFINER` warnings
- 88 authenticated-callable `SECURITY DEFINER` warnings before the referral hardening slice
- 3 `RLS enabled with no policy` informational notices
- leaked-password protection disabled (explicit HOLD)

The highest-priority anonymous warning was `record_public_referral_attribution(...)` because it was a public write path.

## Stage 2A — public referral write hardening

PR #549 (`Security: Harden public referral attribution boundary`) fixed one concrete data-integrity/abuse issue.

### Finding

The application route generated the referral attribution UUID in an HttpOnly cookie, but the database RPC was also directly executable by `anon` and `authenticated` roles. A caller could bypass the intended application-cookie boundary and submit arbitrary attribution UUIDs directly to the RPC once public identity handles became available.

This was not a private-data disclosure. It was a future referral-data poisoning/spam surface.

### Production fix

PR #549 moved referral writes behind the existing server-only Supabase service-role client and hardened the database boundary:

- `record_public_referral_attribution(...)` is now `SECURITY INVOKER`
- `search_path=''`
- `anon EXECUTE = false`
- `authenticated EXECUTE = false`
- `service_role EXECUTE = true`
- `landing_path` is bound to the canonical destination handle
- public handle/cookie validation was tightened
- first-touch, self-referral rejection and destination de-dup semantics were preserved
- direct browser table access remains absent

Deployment ordering was intentionally server-first, database-second so the production route was upgraded before browser RPC access was revoked.

Authoritative merged SHA after PR #549:

`588fc29d24e1143f0b6f41a9f6d62d29b8bb013a`

Production deployment:

`dpl_7WtSt2PyxssFFBCrLJNRUiyQScbK`

Post-migration verification confirmed:

- function is not `SECURITY DEFINER`
- empty `search_path`
- no anonymous/authenticated EXECUTE privilege
- service-role EXECUTE remains
- `referral_attribution_events` has no anon/auth SELECT/INSERT privileges
- current referral rows remained `0`

The canonical anonymous `SECURITY DEFINER` Advisor count dropped from 3 to 2.

## Remaining anonymous SECURITY DEFINER warnings — accepted intentional baseline

The two remaining warnings are intentional read-only public projection functions.

### `get_public_booking_conflicts(...)`

Purpose: expose only booking date/time/duration/status conflict slots required for public availability calculation.

Current controls:

- `STABLE`
- `SECURITY DEFINER`
- `search_path=''`
- read-only SQL projection
- only conflict fields are returned
- filters to conflict-relevant booking states
- no customer identity/contact/notes/payment/private booking fields are returned

This function was previously hardened and transaction-verified in the non-finance RPC search-path program. Public execution is intentional for availability discovery.

### `get_public_provider_identity(...)`

Purpose: expose the disclosure-gated public Provider identity projection used by public marketplace pages.

Current controls:

- `STABLE`
- `SECURITY DEFINER`
- `search_path=''`
- read-only SQL projection
- only verified Providers are returned
- marketplace disclosure completeness is enforced
- returned fields are limited to Provider type/id/display name/location/verified state

Public execution is intentional. Revoking this function merely to silence the generic Advisor would break the designed public marketplace projection.

Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## Stage 2B — authenticated SECURITY DEFINER contextual audit

Fresh canonical Advisor after PR #549 reports 87 authenticated `SECURITY DEFINER` findings.

They were classified from the live canonical function definitions as follows:

| Class | Count | `auth.uid()` present | `search_path=''` |
| --- | ---: | ---: | ---: |
| Admin / Super Admin control | 14 | 14 | 14 |
| Customer-owner | 12 | 12 | 12 |
| Provider-owner | 23 | 23 | 23 |
| Participant / reporter | 8 | 8 | 8 |
| Other non-finance scoped functions | 13 | 13 | 13 |
| Intentional public read functions | 2 | 0 | 2 |
| Finance / recovery / frozen | 15 | 15 | 1 |
| **Total** | **87** |  |  |

The 15 Finance/recovery/frozen functions remain outside this launch-closure program and were not changed.

The 72 non-finance functions were audited in context.

## Non-finance authorization findings

### Admin / Super Admin — 14 functions

All audited Admin/Super Admin functions:

- require an authenticated caller
- use empty `search_path`
- enforce scoped Admin/Super Admin authorization through existing admin helpers/membership/scope checks
- do not rely on the generic `authenticated` role alone as authorization

Representative classes include:

- provider application/verification/service launch review
- provider trust/verification revocation
- moderation queue/actions
- scoped service settings
- marketplace issue updates
- Super Admin membership/scope administration

No missing Admin authorization check was found.

### Customer-owner — 12 functions

All audited Customer functions:

- require `auth.uid()`
- use empty `search_path`
- bind requirements/bookings/reviews to the calling customer before returning or mutating state

Representative paths include:

- requirement creation/status/proposal decisions
- requirement occurrence/job operations
- booking completion/no-show/reschedule support
- owned review response paths

No cross-customer access path was found.

### Provider-owner — 23 functions

All audited Provider functions:

- require `auth.uid()`
- use empty `search_path`
- resolve ownership through Professional `user_id`, Business `owner_user_id`, applicant identity, owned service, owned proposal, verification request/document owner, or another provider-scoped helper

A focused full-body review was performed on the Provider functions that did not match the first static owner-pattern heuristic:

- `mark_provider_verification_document_deleted(...)`
- both `provider_submit_requirement_proposal(...)` overloads
- `provider_withdraw_requirement_proposal(...)`
- `register_provider_verification_document(...)`

They enforce, respectively:

- document applicant ownership + pending verification state
- `provider_service_matches_requirement(..., auth.uid())` verified/active owned Service eligibility
- proposal `provider_user_id = auth.uid()` ownership
- verification request `applicant_user_id = auth.uid()` plus caller-specific storage path prefix

No cross-provider write path was found.

### Marketplace participant / reporter — 8 functions

Messaging/safety/reporting functions were full-body checked.

They enforce one or more of:

- caller must be a conversation participant
- message sender must be the caller
- requirement owner or accepted/participating Provider relationship
- reporter cannot report their own content
- moderation report ownership (`reporter_user_id = auth.uid()`)
- block/read state is scoped to the calling participant

`send_marketplace_message(...)` additionally revalidates conversation state and the underlying awarded requirement / shortlisted-interview job application / requested-accepted product-order participant relationship before allowing a message.

No cross-conversation or cross-reporter access path was found.

### Other non-finance scoped functions — 13 functions

Full-body review covered the remaining non-finance helpers, including:

- `apply_booking_closeout_rules(...)`
- requirement occurrence/proposal/history getters
- Provider setup/launch/lead getters
- booking reschedule conflict getter
- booking support case creation
- Admin moderation queues
- marketplace inbox

These functions enforce caller ownership/participant/Admin-view boundaries before privileged reads/writes.

No missing authorization boundary was found.

## Why the remaining authenticated Advisor warnings are accepted

Supabase's authenticated `SECURITY DEFINER` warning is intentionally generic: it flags any signed-in-callable `SECURITY DEFINER` function whether or not the function performs its own caller authorization.

In TakeItEsee, many non-finance RPCs deliberately use `SECURITY DEFINER` so an authorized owner/participant/Admin action can cross table-level RLS boundaries while preserving a narrow application-level contract.

Mass revoking authenticated EXECUTE, or converting every function to `SECURITY INVOKER`, would break legitimate Customer/Provider/Admin workflows and could produce a less auditable authorization model.

The accepted baseline therefore requires both:

1. signed-in caller identity via `auth.uid()` (except the two intentional public read functions), and
2. explicit owner/participant/Admin authorization inside the function before privileged data access or mutation.

Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## RLS-enabled-with-no-policy notices

Current informational findings:

- `cashfree_sandbox_e2e_runs` — Finance HOLD
- `payment_gateway_webhook_events` — Finance HOLD
- `referral_attribution_events` — intentionally no browser table policy

`referral_attribution_events` is intentionally service-only after PR #549:

- RLS enabled
- no anon/auth table grants
- no anon/auth RPC write access
- server service-role route is the only approved write boundary

Therefore adding a browser RLS policy only to silence the informational notice would weaken the intended architecture.

Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Leaked-password protection

The Advisor still reports leaked-password protection disabled.

This remains an explicit plan-level HOLD and is not treated as an application-code failure. It must be resumed only after the required Supabase plan capability is available and the product owner explicitly resumes the work.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Stage 2 decision

**Concrete non-finance security defect found:** yes — public referral attribution direct-RPC write boundary.

**Concrete defect fixed:** yes — PR #549, production + canonical migration verified.

**Additional authenticated non-finance authorization bypass found:** no.

**Remaining anonymous warnings:** 2 intentional read-only public projections.

**Remaining authenticated warnings:** contextual/intentional authenticated RPC baseline; Finance/frozen findings remain outside scope.

**Stage 2 non-finance security contextual closure:** GREEN / CLOSED.

Do not reopen this stage merely because the generic Advisor continues to display intentional warnings. Reopen only for:

- a new concrete exploit/authorization failure,
- changed function/grant semantics,
- changed Supabase exposure model,
- failed real-account UAT,
- new Advisor category/evidence that materially changes the risk assessment.

## Next launch-closure gate

Proceed to Stage 3 — Pilot Marketplace Supply Readiness.

Stage 3 should use real intended Provider/Service data to establish at least one verified Provider with one genuinely public/searchable Service, real category/location/availability context, and a real Customer discovery-to-booking path.

Do not create persistent fake production supply merely to satisfy the launch checklist.