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

### Public provider directory

`GET /api/marketplace/providers`

Optional provider filter:

- `?type=professional`
- `?type=business`
- `?type=all` (default)

Each provider row includes the existing public directory fields plus `provider_type` and `profile_path`. The endpoint applies the same verified/disclosure/public-readiness rules already used by the web Professionals and Businesses directories.

## Next mobile-readiness slices

1. Public provider detail JSON contract for Professional and Business profile screens.
2. Provider requirement leads and proposal actions, isolated from frozen recurrence logic.
3. Customer/provider booking RLS client propagation where a route authenticates with Request but later opens a separate Supabase client.
4. Notifications and messages.
5. Service completion and reviews.
6. Final native contract freeze before React Native + Expo application work.

## Frozen boundaries

Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD. Recurrence/recovery remains FROZEN. `RequirementOccurrenceRecoveryPanel.tsx` remains untouched.
