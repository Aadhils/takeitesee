# TakeItEsee Mobile Release Readiness

This file tracks the native Android/iOS release foundation separately from feature development.

## Current native identity

- App name: `TakeItEsee`
- Expo slug: `takeitesee`
- User-facing version: `0.1.0`
- Android application ID: `com.uvmart.takeitesee`
- Android seed version code: `1`
- iOS bundle identifier: `com.uvmart.takeitesee`
- iOS seed build number: `1`

The Android application ID and iOS bundle identifier are still pre-store identifiers. They should be treated as final before the first Play Console/App Store Connect registration because changing them after publication creates a different app identity.

## EAS versioning and build profiles

`eas.json` defines:

- EAS CLI minimum: `>= 16.18.0`.
- committed source required before cloud builds.
- remote app-version source so EAS is authoritative for developer-facing build numbers after project linkage.
- `preview`: internal distribution; Android produces an installable APK for real-device UAT.
- `production`: production environment; Android produces an AAB for Google Play and production build numbers auto-increment remotely.
- `submit.production`: reserved for the later store-submission phase.

The `android.versionCode` and `ios.buildNumber` values in `app.json` are the initial seed values. Once the EAS project is linked, remote EAS versioning becomes authoritative for developer-facing build numbers.

No `developmentClient` profile is enabled yet because `expo-dev-client` is not installed. Local development can continue with the existing Expo workflow until a custom development client is intentionally introduced.

## Android preview build handoff

The mobile workspace is already linked in repository configuration to the EAS project owned by `uvmart-takeitesee` with project ID `aee79da4-1e18-4cdb-b5bd-421180d0decd`. The repository intentionally does not contain an Expo access token or account credential. Authorized account access and signing state still require external verification before a production build.

From `mobile/`, verify account state first:

```bash
npm run eas:whoami
```

Do not run `eas init` again for this linked project. Verify that the authorized Expo account resolves the committed project identity:

```bash
npm run eas:project:info
```

The committed `expo.extra.eas.projectId` and `owner` are the repository identity for this app. If `eas:project:info` reports a different owner or project ID, stop the release handoff and reconcile the account/project mapping instead of re-initializing or overwriting the committed identity.

With account access and project linkage complete, queue the installable Android preview APK with:

```bash
npm run build:android:preview
```

That preview profile is intentionally an APK so it can be installed directly on an Android phone or emulator for Customer + Provider real-device UAT.

## Production build handoff

After Android preview UAT is clean, production/store builds can use:

```bash
npm run build:android:production
npm run build:ios:production
```

Android production creates an AAB for Google Play. The first iOS device/TestFlight build also requires access to an Apple Developer/App Store Connect team and its signing credentials.

## Still required before store submission

- Expo/EAS project linkage is complete (`uvmart-takeitesee` / committed EAS project ID).
- Android preview APK workflow and real-device Customer + Provider UAT are complete through the current mobile release baseline.
- Native splash and launcher branding are configured with the bundled official TakeItEsee logo.
- The approved dedicated 512 × 512 Play Store listing icon is present at `store-assets/takeitesee-play-icon-512.png`; do not treat the rectangular bundled launcher logo as final store artwork.
- final package/bundle identifier confirmation before store registration
- production EAS environment values
- Android signing/keystore state must be verified in the authorized EAS account; repository config alone cannot prove credential existence.
- Google Play Console application registration and Play App Signing state must be verified externally.
- Apple signing / App Store Connect application registration
- iOS TestFlight real-device UAT
- real production/native store screenshots and the 1024 × 500 feature graphic
- review and approve the Play Store listing copy in `PLAY_STORE_LISTING.md`
- Google Play Data safety disclosure and Apple App Privacy answers based on the implemented app behavior
- final release version and store-submission verification

## Google Play internal-track handoff

The production submit profile intentionally targets Google Play `internal` testing first. This does not publish the app to production. A production AAB and authorized Google Play service credentials are still required before `npm run submit:android:internal` can succeed.

Do not change the submit track to `production` until Play Console setup, disclosures, store assets, internal testing, and release review are complete.

`PLAY_STORE_LISTING.md` is the repository source for reviewable listing copy and the external Console checklist. It must not claim that Console-only requirements are complete.

## Preserved boundaries

- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain on HOLD.
- Recurrence/recovery remains frozen.
- `RequirementOccurrenceRecoveryPanel.tsx` remains outside mobile release work.
- Native clients must continue to use server-authoritative identity, ownership and marketplace state transitions.
