# Final Launch Closure — Stage 3: Pilot Marketplace Supply Readiness

Status: Stage 3B authoritative readiness plan
Scope: non-finance pilot marketplace supply only
Canonical production database: `bukrpkymivkhdpueropt`
Baseline main before this document: `2da6ccd5abcb5ee9f0790034d78e1aa54e55a932`

## Purpose

Stage 3 moves TakeItEsee from a technically healthy marketplace candidate to a marketplace with at least one genuine, owner-controlled Provider supply path that can be discovered and booked by a real Customer.

This stage must not create persistent synthetic production fixtures, silently promote existing test Providers, invent Provider content, or bypass normal Provider/Admin UI workflows. Real Provider content must be supplied or confirmed by the Provider owner through the normal application UI.

## Production supply snapshot

Current canonical production supply audit found:

- `Takeitesee Test Business`
  - Provider type: Business
  - Verification: not verified
  - Services: 2
  - Active services: 0
  - Existing service names are explicitly test-labelled
  - Not eligible for the real pilot
- `Takeitesee Test Professional`
  - Provider type: Professional
  - Verification: verified
  - Services: 1
  - Active services: 0
  - Existing service name is explicitly test-labelled
  - Not eligible for the real pilot
- `Shakthi`
  - Provider type: Professional
  - Verification: verified
  - Marketplace disclosure: complete
  - Trust state: `normal`
  - Provider services: 0
  - Current public handle: none
  - Profile basics: incomplete because `description` is empty
  - Existing active professional roles:
    - Web Developer — service bookings enabled
    - Acting Driver — service bookings enabled

The existing three Services are all paused test Services and must remain excluded from the real pilot acceptance evidence.

## Stage 3 pilot candidate

`Shakthi` is the cleanest existing candidate because the identity is already verified, marketplace disclosure is complete, trust is normal, and no synthetic Service needs to be promoted.

However, this identity is only a candidate. The application must not invent or silently insert the missing profile description, public handle, Service title, Service description, price, duration, category choice, launch location, availability, or other owner-controlled content.

## Current blocking gate

The immediate P0 blocker is Provider profile completeness.

The Professional profile currently has:

- display/headline: present
- service area: present
- description: missing

The Provider Setup workflow deliberately blocks launch approval until profile basics are complete.

### Required UI action

Route: `/provider/profile`

The Provider owner must enter a genuine profile description and save it through the normal Provider Profile UI. The existing API path is `/api/provider/profile` and the normal PATCH flow preserves Provider ownership checks.

Do not fill this field directly in the database for launch evidence.

## Canonical Stage 3 sequence

### Gate 1 — Provider profile basics

Route: `/provider/profile`

Acceptance:

- display name present
- genuine description present
- location/service area present
- Provider profile readiness reports complete

Current status: **BLOCKED — description missing**

### Gate 2 — Public Provider handle

Route: `/provider/handle`

The Provider owner may claim a canonical handle through `/api/identity-handle?context=provider`.

Rules already enforced by the application/database:

- authenticated owner only
- lowercase canonicalization
- 3–30 characters
- letters, numbers and single hyphens only
- reserved handles rejected
- globally used/retired handles rejected
- one current handle per identity

A handle is not the Service launch gate itself, but it is required for Stage 3 public-profile/share evidence.

Current status: **PENDING — no current handle**

### Gate 3 — Create one genuine pilot Service

Route: `/provider/services`

Create the Service through the normal Provider Catalog UI. Do not clone or rename one of the existing test Services.

The Provider owner must provide genuine values for:

- Service name
- Service description
- Admin-managed platform category
- Base price
- Duration
- Initial non-public status until launch gates are complete

The current taxonomy contains matching examples for the existing roles, including:

- Technology & Digital → Website Development
- Automotive & Mobility → Driver Services

These are availability findings, not automatic selections. The Provider owner must select the category that truthfully matches the actual pilot Service.

Current status: **PENDING — no Service exists for the candidate**

### Gate 4 — Category and launch-location approval

Route: `/provider/setup`

The Provider Setup UI:

- reads the Service's canonical Admin-managed category
- locks that category during launch approval
- lets the Provider choose an active launch location
- submits the normal launch request to `/api/provider/setup`
- uses `submit_service_launch_request_for_type(...)`

The workflow must not bypass this step by directly inserting ecosystem scope rows.

Acceptance:

- one real Service has an approved `service_ecosystem_scope`
- the scope category matches the Service catalog category
- the launch location is owner-selected and genuine
- no pending/changes-requested blocker remains

Current status: **PENDING**

### Gate 5 — Admin launch review

Use the existing Admin/Super Admin Service Launch Review workflow.

Acceptance:

- real launch request reviewed by an authorized Admin/Super Admin
- approval creates/maintains the canonical Service ecosystem scope
- no direct production-table approval is used as launch evidence

Current status: **PENDING**

### Gate 6 — Service availability / reach readiness

Routes involved:

- `/provider/schedule`
- `/provider/services` reach controls where applicable

The Provider must configure genuine booking availability/reach appropriate to the Service before customer booking UAT.

Acceptance:

- Service has owner-controlled availability/reach compatible with the selected launch location and Service mode
- no synthetic schedule data is inserted only to make a test pass

Current status: **PENDING**

### Gate 7 — Manual Service activation

Route: `/provider/services`

TakeItEsee deliberately does not auto-reactivate/publish a Service after approval.

Activation requires the existing readiness gates to pass:

- profile complete
- Provider verified
- marketplace disclosure complete
- trust state normal
- category/location scope approved
- Service launch-ready

The Provider then manually sets the Service to `Active` through the normal Services UI.

Current status: **PENDING**

### Gate 8 — Public discovery evidence

Acceptance must be captured from public Customer-facing surfaces:

- Service is visible through the public marketplace under the approved category/location
- Provider public profile is reachable and public-ready
- canonical handle resolves to the same Professional identity
- Service is not a test-labelled fixture
- public access does not expose private verification data

Current status: **PENDING**

### Gate 9 — Real Customer booking evidence

This is the bridge into Stage 4 UAT.

Acceptance:

- a real Customer can discover the pilot Service
- availability loads
- Customer can select date/time
- booking review works
- booking confirmation works
- Provider receives the expected booking/notification attention
- no payment/Cashfree activation is introduced

Current status: **PENDING**

## Human-content boundary

The following values must not be invented by launch automation:

- Provider biography/description
- Provider handle choice
- Service name/description
- Service price/duration
- exact Service category if multiple legitimate categories could apply
- launch location
- availability schedule
- public media/content

The owner should enter these through TakeItEsee. After each owner-controlled step, the launch closure process may use canonical DB/app checks to verify the resulting state.

## Existing test supply exclusion

The following existing records must not be counted as Stage 3 pilot acceptance evidence:

- `Takeitesee Test Business`
- `Takeitesee Test Professional`
- `Test website consultation`
- `Test professional consultation`
- `Test home service visit`

They may remain paused for regression/history purposes unless a separate cleanup decision is approved.

## Stage 3 priority order

P0-1. Complete genuine Provider profile basics.

P0-2. Claim a canonical Provider handle for public evidence.

P0-3. Create one genuine pilot Service via `/provider/services`.

P0-4. Submit category/location launch approval via `/provider/setup`.

P0-5. Complete authorized Admin launch review.

P0-6. Configure real availability/reach.

P0-7. Manually activate the Service through Provider UI.

P0-8. Verify public search/profile/handle visibility.

P0-9. Run the first real Customer discovery → booking → confirmation flow.

Only after P0-1 through P0-9 have evidence should Stage 3 be declared complete and Stage 4 real-account/device UAT become the active launch gate.

## Non-goals / protected boundaries

- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD.
- Recurrence/recovery remains FROZEN.
- Supabase leaked-password protection remains HOLD pending the approved plan upgrade.
- One account = Customer + one final Provider identity (Professional OR Business, never both) remains authoritative.
- No fake production Provider or Service should be created only for launch closure.
- No direct database mutation should substitute for owner/Admin UI evidence unless a genuine application defect requires a separately reviewed fix.

## Stage 3B verdict

The software path required for the pilot already exists. No missing code behavior was found in this audit.

The next real blocker is operational/user-owned content, not development: complete the candidate Professional profile description in `/provider/profile`, then continue the canonical Provider UI sequence above.
