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

An authorized Expo/EAS account must link this mobile workspace to an EAS project before the first cloud build. The repository intentionally does not contain an Expo access token or account credential.

From `mobile/`, verify account state first:

```bash
npm run eas:whoami
```

If the project is not linked yet, sign in with the authorized Expo account and run:

```bash
npx eas-cli@latest init
```

Then verify the linked project:

```bash
npm run eas:project:info
```

The linked project adds `expo.extra.eas.projectId` to app configuration. Do not invent or hard-code a project ID before EAS creates or returns it.

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

- authorized Expo/EAS account login and project linkage
- successful Android preview APK cloud build
- Android real-device Customer + Provider UAT
- final square TakeItEsee app icon and Android adaptive icon assets
- splash/launch branding assets
- final package/bundle identifier confirmation before store registration
- production EAS environment values
- Android signing / Google Play Console application registration
- Apple signing / App Store Connect application registration
- iOS TestFlight real-device UAT
- store screenshots and listing copy
- Google Play Data safety disclosure and Apple App Privacy answers based on the implemented app behavior
- final release version and store-submission verification

## Preserved boundaries

- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain on HOLD.
- Recurrence/recovery remains frozen.
- `RequirementOccurrenceRecoveryPanel.tsx` remains outside mobile release work.
- Native clients must continue to use server-authoritative identity, ownership and marketplace state transitions.
