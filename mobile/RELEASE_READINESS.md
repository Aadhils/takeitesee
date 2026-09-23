# TakeItEsee Mobile Release Readiness

This file tracks the native Android/iOS release foundation separately from feature development.

## Current native identity

- App name: `TakeItEsee`
- Expo slug: `takeitesee`
- User-facing version: `0.1.0`
- Android application ID: `com.uvmart.takeitesee`
- Android version code: `1`
- iOS bundle identifier: `com.uvmart.takeitesee`
- iOS build number: `1`

The Android application ID and iOS bundle identifier are still pre-store identifiers. They should be treated as final before the first Play Console/App Store Connect registration because changing them after publication creates a different app identity.

## Build profiles

`eas.json` defines:

- `preview`: internal distribution; Android produces an installable APK for real-device UAT.
- `production`: production environment; Android produces an AAB for Google Play. iOS uses the normal production archive path managed by EAS.

No `developmentClient` profile is enabled yet because `expo-dev-client` is not installed. Local development can continue with the existing Expo workflow until a custom development client is intentionally introduced.

## First cloud-build handoff

Before the first cloud build, an authorized Expo/EAS account must link this mobile workspace to an EAS project and configure credentials/environment values. From `mobile/`:

```bash
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile preview
```

After Android preview UAT is clean, production/store builds can use:

```bash
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

The first iOS device/TestFlight build also requires access to an Apple Developer/App Store Connect team and its signing credentials.

## Still required before store submission

- final square TakeItEsee app icon and Android adaptive icon assets
- splash/launch branding assets
- final package/bundle identifier confirmation before store registration
- production EAS project linkage and environment values
- Android signing / Google Play Console application registration
- Apple signing / App Store Connect application registration
- real-device Android and iOS Customer + Provider UAT
- store screenshots and listing copy
- Google Play Data safety disclosure and Apple App Privacy answers based on the implemented app behavior
- final release version/build-number bump and submission verification

## Preserved boundaries

- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain on HOLD.
- Recurrence/recovery remains frozen.
- `RequirementOccurrenceRecoveryPanel.tsx` remains outside mobile release work.
- Native clients must continue to use server-authoritative identity, ownership and marketplace state transitions.
