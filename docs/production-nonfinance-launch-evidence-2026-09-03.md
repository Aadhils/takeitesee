# Production non-finance launch evidence — 2026-09-03

This record captures the final representative non-finance production acceptance evidence gathered after the operational go-live checklist and the provider activation repairs. It supplements `docs/phase15-launch-activation-gate.md` and `docs/production-go-live-operator-checklist.md` without changing the Finance/Cashfree or Supabase Pro HOLD boundaries.

## Authoritative production baseline

- Repository: `Aadhils/takeitesee`
- Branch: `main`
- Authoritative merged SHA before this documentation-only refresh: `b7c78eb12775e1259097d15863c4dd8845e60100`
- Production deployment: `dpl_EiZdE29knd6phT9TGphLXQcVc8F5`
- Production target: `production`
- Canonical domains attached: `www.takeitesee.com`, `takeitesee.com`
- Deployment state: `READY`
- Canonical health: HTTP `200`, `status=ok`, `app=ok`, `database=ok`, release `b7c78eb12775`
- Runtime verification after release: no runtime error cluster observed in the checked release window
- Deployment-scoped `5xx`: none observed in the checked release window
- Unresolved Vercel toolbar feedback: none

## Recent launch-readiness closures incorporated

The production baseline above includes the following already-merged work and should not be repeated as new work:

- `#199` final go-live operator checklist consolidation
- `#200` dialog keyboard focus trapping, Escape handling, and focus restoration
- `#201` account/home UI polish and voice-search foundation
- `#202` password visibility controls
- `#203` homepage search visual alignment
- `#204` homepage hero hierarchy calibration
- `#205` homepage microphone positioning
- `#206` mobile voice-search visual refinement
- `#207` provider services trust lookup repair
- `#208` authenticated provider-session trust lookup
- `#209` provider activation trigger private-helper repair
- `#210` provider activation scope-validation repair

## Provider publication acceptance

Representative production provider/service evidence:

- Provider: `Takeitesee Test Business`
- Provider type: business
- Provider verification state: verified
- Service: `Test home service visit`
- Service ID: `e07dfd13-9a59-4111-9e8d-e3426d243543`
- Approved scope: `Home Services · Chennai`
- Provider activation action returned HTTP `200`
- Persisted service state after activation: `status=active`, `active=true`
- Marketplace API returned the service as a live listing
- Public service detail page returned HTTP `200` and rendered the verified provider, Chennai scope, 90-minute duration, INR 750 starting price, and live booking CTA

This confirms the provider verification/publication path was exercised through the product workflow rather than by directly forcing the service active in SQL.

## Customer non-finance booking acceptance

Representative production booking evidence:

- Booking reference: `TIS-20260904-D8715E`
- Service: `Test home service visit`
- Provider: `Takeitesee Test Business`
- Booking date: `2026-09-04`
- Start time: `09:00:00`
- Timezone: `Asia/Kolkata`
- Duration: 90 minutes
- Location: Chennai
- Quoted price: INR 750.00

Acceptance path exercised:

1. Customer opened the live marketplace service detail.
2. Customer selected a date/time from live provider availability.
3. Booking review explicitly stated that payment was not collected in this flow.
4. Customer confirmed the booking request.
5. Production DB persisted the booking as `pending`, `payment_status=unpaid`, `payment_method=unselected`.
6. Provider saw the new request in the provider booking queue.
7. Provider accepted the request through the product UI.
8. Production DB transitioned the booking to `confirmed` while preserving `payment_status=unpaid` and `payment_method=unselected`.
9. Customer `/bookings` displayed the booking under Upcoming with `Confirmed` status.
10. Booking-created and booking-accepted notifications were persisted for the booking participants.

This is the representative end-to-end **non-finance** lifecycle smoke: customer discovery → live availability → booking request → provider receipt → provider acceptance → customer confirmed state.

## HOLD boundaries preserved

The acceptance above does **not** make finance readiness green.

Still HOLD until explicitly resumed:

- Cashfree Payments / Payouts
- customer payment or cash collection
- refunds
- provider payouts
- settlement
- reconciliation
- disputes / chargebacks
- recovery ledger / collections
- INR finance activation
- payment/refund/payout/recovery end-to-end testing

The booking intentionally remains `unpaid` with payment method `unselected`.

Supabase Pro-only leaked-password protection also remains HOLD until plan upgrade plus explicit product-owner resume instruction. This record does not authorize a paid upgrade or claim that warning is cleared.

## Current non-finance classification

**Application implementation:** production-accepted representative non-finance customer/provider lifecycle.

**Marketplace/provider acceptance:** PASS for representative verified business publication and customer discovery.

**Customer/provider booking acceptance:** PASS through provider acceptance and customer confirmed state, without payment collection.

**Operational readiness:** existing incident-response, recovery, monitoring, and go-live procedures remain the operator source of truth.

**Finance readiness:** NO-GO / HOLD.

**Supabase Pro leaked-password protection:** HOLD.

## Release closure rule for this documentation refresh

The PR that introduces this record is documentation-only, but it still must follow the protected production workflow: required `web` CI, squash merge, exact merged-SHA production deployment, canonical `/api/health` verification, runtime/5xx observation, and unresolved-feedback check. Only then should its merged SHA become the newest authoritative production baseline.