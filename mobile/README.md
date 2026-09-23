# TakeItEsee Mobile

React Native + Expo application workspace for Android and iOS.

## Baseline

- Expo SDK 57
- React Native 0.86
- Expo Router
- TypeScript strict mode
- Supabase Auth client with persistent native session storage
- Native Contract v1 API client using `Authorization: Bearer <Supabase access token>`

The web application remains in `web/`. This mobile workspace is intentionally isolated so native work cannot silently alter web runtime behavior.

## Environment

Copy `.env.example` to `.env` and provide the Supabase project URL and publishable key. Never commit private keys or service-role credentials.

`EXPO_PUBLIC_API_URL` defaults to `https://www.takeitesee.com` in code and may be overridden for development.

## Run locally

```bash
cd mobile
npm install
npm start
```

On Windows, use Expo Go or an Android emulator/device for Android development. Local iOS Simulator builds require macOS/Xcode; iOS cloud/device builds can be added through EAS in a later phase.

## Contract rules

- Native Contract v1 is the source of truth for mobile API integration.
- Browser-cookie compatibility on the web must remain intact.
- Native requests use Supabase access tokens as Bearer tokens.
- Provider identity, roles, ownership checks and marketplace state transitions remain server-authoritative.
- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD.
- Recurrence/recovery remains FROZEN and is outside Native Contract v1.
- `RequirementOccurrenceRecoveryPanel.tsx` is not part of mobile implementation work.

## Next mobile slice

Build the native authentication/session gate against Supabase Auth and `GET /api/mobile/session`, then route authenticated users into the Customer-first mobile shell without duplicating server role logic.
