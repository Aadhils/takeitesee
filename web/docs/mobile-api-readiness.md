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

### Public provider directory

`GET /api/marketplace/providers`

Optional provider filter:

- `?type=professional`
- `?type=business`
- `?type=all` (default)

Each provider row includes the existing public directory fields plus `provider_type` and `profile_path`. The endpoint applies the same verified/disclosure/public-readiness rules already used by the web Professionals and Businesses directories.

### Public provider detail

`GET /api/marketplace/providers/professional/{providerId}`

Professional responses include normalized identity/disclosure/contact data, active services, public roles, public portfolio media and public career/resume data when enabled.

`GET /api/marketplace/providers/business/{providerId}`

Business responses include normalized identity/disclosure/contact data, active services and public product summaries.

Native clients must treat `providerId` as an opaque identifier returned by marketplace search or the provider directory; clients must not construct or infer provider ids.

Unavailable or non-public profiles return 404. Unknown provider types return 400. These endpoints are public and do not weaken the existing profile eligibility rules.

## Next mobile-readiness slices

1. Messages bearer propagation.
2. Service completion and reviews.
3. Final native contract freeze before React Native + Expo application work.

## Frozen boundaries

Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD. Recurrence/recovery remains FROZEN. `RequirementOccurrenceRecoveryPanel.tsx` remains untouched.
