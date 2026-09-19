'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'security.password.show': 'Show password',
  'security.password.hide': 'Hide password',
  'security.password.minValidation': 'Your new password must be at least 8 characters.',
  'security.password.mismatchValidation': 'The new passwords do not match.',
  'security.password.sameValidation': 'Choose a new password that is different from your current password.',
  'security.password.verifyFailed': 'Your current password could not be verified.',
  'security.password.updateSuccess': 'Your password has been updated securely.',
  'security.password.updateFallback': 'Unable to update your password.',
  'security.email.invalidValidation': 'Enter a valid new email address.',
  'security.email.sameValidation': 'Enter a new email address that is different from your current email.',
  'security.email.updateSuccess': 'Your email change request was submitted. Your sign-in email changes only after the confirmation steps required by Supabase Auth are completed.',
  'security.email.updateFallback': 'Unable to update your email.',
  'security.checking': 'Checking your account security…',
  'security.auth.title': 'Sign in to manage account security',
  'security.auth.body': 'Sign in to your TakeItEsee account to change your password or email.',
  'security.auth.signIn': 'Sign in',
  'security.auth.forgotPassword': 'Forgot password?',
  'security.eyebrow': 'Account security',
  'security.title': 'Manage your sign-in security',
  'security.intro': 'Your current password is re-verified before password or email changes are requested.',
  'security.signedInEmail': 'Signed-in email',
  'security.password.title': 'Change password',
  'security.password.current': 'Current password',
  'security.password.new': 'New password',
  'security.password.newHint': 'Use at least 8 characters.',
  'security.password.confirm': 'Confirm new password',
  'security.password.updateAction': 'Update password',
  'security.password.backSettings': 'Back to settings',
  'security.password.recoveryBody': 'If you do not remember your current password, use the secure recovery email flow instead.',
  'security.password.resetAction': 'Reset password',
  'security.email.title': 'Change sign-in email',
  'security.email.body': 'The new address is processed through the Supabase Auth secure email-change flow. Your current email remains the sign-in address until the required confirmation is complete.',
  'security.email.currentPassword': 'Current password',
  'security.email.new': 'New email',
  'security.email.requestAction': 'Request email change',
} as const;

export type AccountSecurityKey = keyof typeof english;

const tamil: Record<AccountSecurityKey, string> = {
  'security.password.show': 'Password-ஐ காட்டு',
  'security.password.hide': 'Password-ஐ மறை',
  'security.password.minValidation': 'புதிய password குறைந்தது 8 characters இருக்க வேண்டும்.',
  'security.password.mismatchValidation': 'புதிய passwords இரண்டும் பொருந்தவில்லை.',
  'security.password.sameValidation': 'தற்போதைய password-இலிருந்து வேறுபட்ட புதிய password பயன்படுத்தவும்.',
  'security.password.verifyFailed': 'தற்போதைய password-ஐ verify செய்ய முடியவில்லை.',
  'security.password.updateSuccess': 'உங்கள் password பாதுகாப்பாக update செய்யப்பட்டது.',
  'security.password.updateFallback': 'Password update செய்ய முடியவில்லை.',
  'security.email.invalidValidation': 'செல்லுபடியாகும் புதிய email address-ஐ உள்ளிடவும்.',
  'security.email.sameValidation': 'தற்போதைய email-இலிருந்து வேறுபட்ட புதிய email பயன்படுத்தவும்.',
  'security.email.updateSuccess': 'Email change request பதிவு செய்யப்பட்டது. Supabase Auth தேவைப்படும் confirmation steps முடிந்த பிறகே sign-in email மாற்றப்படும்.',
  'security.email.updateFallback': 'Email update செய்ய முடியவில்லை.',
  'security.checking': 'உங்கள் account security-ஐ சரிபார்க்கிறது…',
  'security.auth.title': 'Account Security-க்கு sign in செய்யவும்',
  'security.auth.body': 'Password அல்லது email மாற்ற உங்கள் TakeItEsee account-ல் sign in செய்யவும்.',
  'security.auth.signIn': 'Sign in',
  'security.auth.forgotPassword': 'Password மறந்துவிட்டதா?',
  'security.eyebrow': 'Account security',
  'security.title': 'உங்கள் sign-in security-ஐ நிர்வகிக்கவும்',
  'security.intro': 'Password அல்லது email மாற்றத்தை அனுமதிக்கும் முன் உங்கள் தற்போதைய password மீண்டும் verify செய்யப்படும்.',
  'security.signedInEmail': 'Signed-in email',
  'security.password.title': 'Password மாற்றவும்',
  'security.password.current': 'தற்போதைய password',
  'security.password.new': 'புதிய password',
  'security.password.newHint': 'குறைந்தது 8 characters.',
  'security.password.confirm': 'புதிய password-ஐ உறுதிப்படுத்தவும்',
  'security.password.updateAction': 'Password update செய்',
  'security.password.backSettings': 'Settings-க்கு திரும்பவும்',
  'security.password.recoveryBody': 'தற்போதைய password நினைவில் இல்லையெனில் secure recovery email flow-ஐ பயன்படுத்தவும்.',
  'security.password.resetAction': 'Password reset',
  'security.email.title': 'Sign-in email மாற்றவும்',
  'security.email.body': 'புதிய email request Supabase Auth secure email-change policy வழியாக process செய்யப்படும். தேவையான confirmation முடியும் வரை தற்போதைய email தான் sign-in address.',
  'security.email.currentPassword': 'தற்போதைய password',
  'security.email.new': 'புதிய email',
  'security.email.requestAction': 'Email change request அனுப்பு',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useAccountSecurityTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: AccountSecurityKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
