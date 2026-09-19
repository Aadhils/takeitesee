'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'recovery.eyebrow': 'Secure password reset',
  'recovery.checking.title': 'Checking your recovery link…',
  'recovery.checking.body': 'Checking that this password reset came from a valid Supabase recovery session.',
  'recovery.checking.session': 'Checking recovery session…',
  'recovery.invalid.title': 'This recovery link is not active.',
  'recovery.invalid.body': 'Request a new password-reset email and open the latest recovery link.',
  'recovery.invalid.sessionBoundary': 'A normal signed-in session does not unlock the password recovery form.',
  'recovery.invalid.requestAnother': 'Request another reset email',
  'recovery.invalid.backToSignIn': 'Back to sign in',
} as const;

export type PasswordRecoveryKey = keyof typeof english;

const tamil: Record<PasswordRecoveryKey, string> = {
  'recovery.eyebrow': 'பாதுகாப்பான password reset',
  'recovery.checking.title': 'Recovery link-ஐ சரிபார்க்கிறது…',
  'recovery.checking.body': 'இந்த password reset request Supabase recovery session-இலிருந்து வந்ததா என்பதை சரிபார்க்கிறது.',
  'recovery.checking.session': 'Recovery session-ஐ சரிபார்க்கிறது…',
  'recovery.invalid.title': 'இந்த recovery link active இல்லை.',
  'recovery.invalid.body': 'புதிய password-reset email request செய்து அதில் வரும் சமீபத்திய recovery link-ஐ திறக்கவும்.',
  'recovery.invalid.sessionBoundary': 'சாதாரண signed-in session மட்டும் password recovery form-ஐ திறக்காது.',
  'recovery.invalid.requestAnother': 'புதிய reset email request செய்',
  'recovery.invalid.backToSignIn': 'Sign in-க்கு திரும்பவும்',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function usePasswordRecoveryTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: PasswordRecoveryKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
