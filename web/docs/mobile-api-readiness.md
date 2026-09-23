# TakeItEsee Mobile API Readiness

## Phase 1 — Authentication foundation

Native Android and iOS clients authenticate with Supabase and send the Supabase access token to TakeItEsee API routes as:

`Authorization: Bearer <access-token>`

The server validates that JWT with Supabase, then re-derives platform roles from server-owned records. Browser cookie authentication remains supported and unchanged.

### Native session handshake

`GET /api/mobile/session`

Authenticated response:

```json
{
  "authenticated": true,
  "user_id": "<uuid>",
  "roles": ["customer"]
}
```

Provider accounts continue to resolve their server-owned Professional or Business role in addition to Customer. The endpoint does not return access tokens, refresh tokens, passwords, or profile secrets.

## Completed mobile-readiness slices

1. Bearer-aware Supabase server/session foundation and native session handshake.
2. Customer Requirements auth boundary reads the active request Authorization header when its existing routes call the shared customer Supabase helper without an explicit Request. Existing cookie auth remains the fallback and requirement lifecycle/recurrence logic is unchanged.
3. Marketplace discovery contracts are native-ready: `GET /api/marketplace/services/search` and `POST /api/marketplace/services/nearby` stay public JSON APIs, and `GET /api/marketplace/providers` exposes the existing verified Professional/Business public directory as JSON without duplicating eligibility rules.
4. Provider Requirement Leads authentication is native-ready: GET/PATCH/POST keep their existing provider auth, proposal validation, pricing basis, notification acknowledgement and RPC contracts, while their Supabase RLS client now receives the same bearer-bearing Request. No recurrence behavior was changed.
5. Public Professional/Business profile detail is available as a native JSON contract through `GET /api/marketplace/providers/{providerType}/{providerId}` while reusing the same public profile eligibility loaders used by the web profile pages.
6. Customer Booking list/create is bearer-ready end to end: the existing Customer auth Request is propagated through booking list closeout enrichment, self-booking ownership checks, booking repository reads/inserts and availability/conflict validation. Existing booking payload, idempotency, canonical service values and browser cookie fallback are unchanged.
7. Customer Booking detail/cancel/reschedule is bearer-ready: the same authenticated Request now stays attached to booking ownership reads, cancellation RPC, reschedule availability/conflict checks and reschedule RPC. Existing validation, status rules and mutation payloads are unchanged.
8. Customer Booking calendar export and owned reschedule-slot availability are bearer-ready: the authenticated Request now stays attached to their owned booking/RLS reads, while the public service availability caller keeps the existing no-Request fallback.
9. Notifications GET/PATCH is bearer-ready: the same native Request now drives both the Supabase RLS client and explicit user verification while existing unread modes, message destination enrichment and notification acknowledgement semantics remain unchanged.
10. Provider Booking core is bearer-ready: list/detail reads, status actions and requirement-context reads keep the authenticated Provider Request attached to owner resolution, booking/history/closeout RLS reads and the existing `provider_update_booking_status` RPC. Existing accept/decline/complete validation, completion timing and closeout safety rules are unchanged.
11. Messages is bearer-ready: inbox/unread workspace reads, conversation read/send, message-notification acknowledgement and conversation safety/block reads and writes keep the native Request attached to the Supabase RLS client while existing RPC payloads, participant checks, idempotency, read acknowledgement and block validation remain unchanged.
12. Service completion and Reviews are bearer-ready: customer/provider attendance actions, closeout read state, customer review list/create and provider review list/response keep the authenticated Request attached to RLS reads/writes. Completion/no-show RPC payloads, rating/review-window/duplicate guards, provider response validation, SLA state rules and the existing read-only payment-status close blocker remain unchanged.

## Native Contract v1 — FROZEN

The Phase 1 native API contract is now frozen for the first React Native + Expo client implementation. Existing browser flows remain supported in parallel.

### Authentication contract

- Native authenticated calls send `Authorization: Bearer <Supabase access token>`.
- The server verifies the Supabase user and derives platform Customer / Professional / Business roles from server-owned records.
- Native clients must never infer Provider identity, role, ownership, booking eligibility or requirement eligibility locally.
- 401 means authentication is required or invalid. 403 remains an authorization/participant/ownership denial when a route distinguishes it. Validation/state conflicts continue to use the existing route-specific 4xx responses.
- Browser cookie authentication remains a supported fallback; the native contract must not remove it.

### Public discovery contract

- `GET /api/marketplace/services/search`
- `POST /api/marketplace/services/nearby`
- `GET /api/marketplace/providers`
- `GET /api/marketplace/providers/{providerType}/{providerId}`

Provider IDs are opaque values returned by TakeItEsee. Native clients must not construct or infer them.

### Customer contract families

- `/api/requirements`
- `/api/requirements/{requirementId}` and its existing proposal actions
- `/api/bookings`
- `/api/bookings/{bookingId}` and existing cancel/reschedule/calendar/availability flows
- `POST /api/bookings/{bookingId}/attendance`
- `GET /api/bookings/{bookingId}/closeout`
- `GET|POST /api/reviews`
- `GET|PATCH /api/notifications`
- `GET /api/messages`
- `GET|POST /api/messages/{conversationId}`
- `GET|PATCH /api/messages/{conversationId}/safety`

### Provider contract families

- `GET|PATCH|POST /api/provider/requirement-leads`
- `GET /api/provider/bookings`
- `GET|PATCH /api/provider/bookings/{bookingId}`
- `GET /api/provider/bookings/{bookingId}/requirement-context`
- `POST /api/provider/bookings/{bookingId}/attendance`
- `GET|PATCH /api/provider/reviews`
- Provider Notifications and Messages use the same shared notification/message contracts and workspace scoping already used by the web application.

### Contract invariants

- One account remains Customer + exactly one final Provider identity: Professional OR Business, never both.
- Requirement proposal, booking, message, attendance, closeout and review ownership checks remain server-authoritative.
- Message idempotency, booking idempotency, proposal validation, booking transition validation, attendance/no-show validation, review-window validation and duplicate-review protection remain unchanged.
- Notification unread modes, message workspace scoping and message safety/block semantics remain unchanged.
- Native clients must treat server status/state strings and opaque IDs as authoritative and must not reproduce state machines independently.
- Additive response fields may be introduced without breaking v1. Removing/renaming existing fields, changing existing mutation payloads, changing route methods/paths, or weakening server-side guards requires an explicit Native Contract v2 decision.

### Native client implementation rule

React Native + Expo may now build against Native Contract v1. Client code should centralize base URL, bearer-token injection, JSON/error parsing and route typing so future contract changes are isolated to the API layer rather than screen components.

## Public provider directory

`GET /api/marketplace/providers`

Optional provider filter:

- `?type=professional`
- `?type=business`
- `?type=all` (default)

Each provider row includes the existing public directory fields plus `provider_type` and `profile_path`. The endpoint applies the same verified/disclosure/public-readiness rules already used by the web Professionals and Businesses directories.

## Public provider detail

`GET /api/marketplace/providers/professional/{providerId}`

Professional responses include normalized identity/disclosure/contact data, active services, public roles, public portfolio media and public career/resume data when enabled.

`GET /api/marketplace/providers/business/{providerId}`

Business responses include normalized identity/disclosure/contact data, active services and public product summaries.

Native clients must treat `providerId` as an opaque identifier returned by marketplace search or the provider directory; clients must not construct or infer provider ids.

Unavailable or non-public profiles return 404. Unknown provider types return 400. These endpoints are public and do not weaken the existing profile eligibility rules.

## Phase 1 status

Mobile API Readiness Phase 1 is complete. Native Contract v1 is frozen and ready for React Native + Expo application work.

## Frozen boundaries

Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD and are not part of Native Contract v1. Recurrence/recovery remains FROZEN and is not part of Native Contract v1. `RequirementOccurrenceRecoveryPanel.tsx` remains untouched.
