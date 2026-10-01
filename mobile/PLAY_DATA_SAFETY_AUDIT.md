# Google Play Data Safety audit

Status: repository evidence review. This is not a submitted Play Console declaration.

## Audited native surface

Android package: `com.uvmart.takeitesee`.

The native app uses Supabase authentication and TakeItEsee server APIs. Data transmitted off-device therefore counts as collection for Google Play Data Safety purposes even when it is sent to TakeItEsee infrastructure.

### Evidence-backed data categories

The shipped customer/provider workflows can transmit:

- Personal info: name, email address, optional phone number, user/account identifiers.
- User content: service requirements, proposals, booking-related content, messages, reviews, support/privacy request content, provider profile/service information where applicable.
- App activity: marketplace/account actions needed to provide bookings, proposals, notifications, reviews and provider workflows.
- Authentication/security information needed for account sessions and service protection.

The public Privacy Policy additionally describes profile/location/service-region information, provider verification evidence, operational/security logs, and preferences. Before Play Console submission, compare every Data Safety category and purpose against the final production APIs, database writes, storage, and third-party processors.

## Current native permissions / SDK audit

At this audit point, `mobile/app.json` does not directly declare camera, microphone, contacts, SMS/call-log, health, or precise/background-location permissions. The mobile dependency manifest contains Supabase and Expo application/runtime libraries and does not list an advertising or analytics SDK.

The production AAB has now been built and inspected offline. The archive/package audit found no obvious advertising/analytics SDK evidence. The generated artifact contains permission strings including `INTERNET`, `VIBRATE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, and `DUMP`; because Android App Bundle manifests are protobuf-encoded and may carry SDK/tooling constraints, string presence alone is not treated as an effective runtime-permission declaration. Confirm the final effective permissions in Play's processed manifest/App Bundle Explorer after Internal testing upload.

## Sharing / processors

Do not answer Play Console's "shared" questions from the Privacy Policy wording alone. Supabase, Vercel and Resend are documented infrastructure/technology processors, and marketplace information can be made available to the relevant customer/provider. Apply Google's Data Safety definitions and service-provider exceptions to the final data flow before selecting Console answers.

## Account deletion

TakeItEsee account creation exists, so the Play account-deletion requirement applies.

Implemented paths:
- Native Account screen links to the Privacy Policy.
- Native Account screen links to `https://www.takeitesee.com/account/privacy`, where an authenticated user can submit a deletion request through the existing privacy-request workflow.
- Public Privacy Policy explains deletion requests and legitimate retention reasons.

Remaining external-web requirement:
- Public external resource: `https://www.takeitesee.com/account-deletion`. It does not require the mobile app to be installed and clearly routes the user through web sign-in for identity verification, then to the existing deletion-request workflow.

## Submission gate

Do not submit Data Safety or claim account-deletion compliance until:
1. Play's processed manifest/App Bundle Explorer confirms the final effective permissions for the uploaded production AAB;
2. final API/storage/SDK data flows are mapped to Google's categories and purposes;
3. the external web deletion resource is production-verified and entered in the Play Console Data deletion URL field;
4. Play Console answers are reconciled with the published Privacy Policy.
