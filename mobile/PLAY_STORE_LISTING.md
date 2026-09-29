# Google Play store listing draft

This file is a reviewable source for Play Console entry. It does not publish anything.

## Identity

- App name: TakeItEsee
- Android package: com.uvmart.takeitesee
- Legal operator: UV MART Enterprises Private Limited
- Website: https://www.takeitesee.com

## Default English listing draft

Short description:

> Find services, connect with providers, and manage your service journey in one place.

Full description:

> TakeItEsee is a service marketplace that helps customers discover services, connect with service providers, create service requirements, review proposals, manage bookings, messages, notifications, and service journeys from one place.
>
> Customers can explore available services and provider profiles, create one-time requirements, compare provider proposals, and manage supported booking actions.
>
> Providers can manage matched leads, proposals, bookings, availability, live work status, messages, notifications, and supported customer-service workflows.
>
> TakeItEsee is operated by UV MART Enterprises Private Limited.

## Graphic asset readiness

Do not upload the current rectangular bundled launcher logo as the final Play listing icon.

- Play listing app icon: approved 512 × 512 px PNG is present at `store-assets/takeitesee-play-icon-512.png`.
- Feature graphic: still pending repository handoff; required size is 1024 × 500 px, JPEG or 24-bit PNG without alpha.
- Phone screenshots: still pending; capture only fresh real production/native screens and keep listing claims aligned with shipped functionality.

## Play Console disclosures — verify before submission

These are Console/account state and cannot be proven by repository configuration alone:

- Developer account / organization verification.
- App registration and Play App Signing.
- Privacy Policy URL entered in Play Console and accessible in-app.
- Data safety answers checked against actual app code, APIs, permissions, and third-party SDK behavior.
- Account deletion declarations and deletion path checked for every account-creation flow. See `PLAY_DATA_SAFETY_AUDIT.md`; the native in-app path is present and the external web resource is `/account-deletion`; production verification and Play Console entry remain submission gates.
- App access / reviewer credentials supplied for login-gated functionality. Repository evidence checklist: `PLAY_CONSOLE_DECLARATIONS.md`.
- Content rating and target-audience declarations completed from actual shipped behavior and the 18+ eligibility evidence in `PLAY_CONSOLE_DECLARATIONS.md`.
- Ads declaration checked against the final production AAB/SDK/runtime behavior; do not infer it from source dependencies alone. See `PLAY_CONSOLE_DECLARATIONS.md`.
- Production AAB uploaded to Internal testing before any production-track release.

Never infer Data safety answers from marketing copy. Audit the shipped app and SDKs first. The repository evidence review lives in `PLAY_DATA_SAFETY_AUDIT.md`.
