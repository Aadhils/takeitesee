'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'privacy.loadFallback': 'Unable to load privacy requests.',
  'privacy.submitFallback': 'Unable to submit privacy request.',
  'privacy.validation.minDetails': 'Enter at least 10 characters describing your request.',
  'privacy.success.recorded': 'Your privacy request has been recorded securely.',
  'privacy.type.access': 'Access to my information',
  'privacy.type.correction': 'Correction of my information',
  'privacy.type.deletion': 'Account / information deletion request',
  'privacy.checking': 'Checking your account…',
  'privacy.auth.title': 'Sign in to manage privacy requests',
  'privacy.auth.body': 'Sign in to submit access, correction, or deletion requests for your personal information.',
  'privacy.auth.signIn': 'Sign in',
  'privacy.auth.viewPolicy': 'View Privacy Policy',
  'privacy.eyebrow': 'Account privacy',
  'privacy.title': 'Manage your privacy requests',
  'privacy.intro': 'Submit a request to access, correct, or review deletion of eligible personal information.',
  'privacy.new.title': 'New request',
  'privacy.new.deletionNotice': 'A deletion request does not immediately delete your account. Eligible deletion is reviewed against legal retention, security, audit, and unresolved-obligation requirements before processing.',
  'privacy.form.type': 'Request type',
  'privacy.form.details': 'Request details',
  'privacy.form.hint': 'Describe what you want us to access, correct, or review for deletion. 10–2000 characters.',
  'privacy.form.submit': 'Submit privacy request',
  'privacy.form.policy': 'Privacy Policy',
  'privacy.history.eyebrow': 'Request history',
  'privacy.history.title': 'Your requests',
  'privacy.history.loading': 'Loading requests…',
  'privacy.history.empty': 'You have not submitted any privacy requests yet.',
  'privacy.meta.submitted': 'Submitted',
  'privacy.meta.lastUpdate': 'Last update',
  'privacy.meta.resolved': 'Resolved',
  'privacy.meta.reviewNote': 'Review note',
  'privacy.status.submitted': 'Submitted',
  'privacy.status.inReview': 'In review',
  'privacy.status.awaitingInformation': 'Awaiting information',
  'privacy.status.completed': 'Completed',
  'privacy.status.declined': 'Declined',
} as const;

export type AccountPrivacyKey = keyof typeof english;

const tamil: Record<AccountPrivacyKey, string> = {
  'privacy.loadFallback': 'Privacy requests-ஐ load செய்ய முடியவில்லை.',
  'privacy.submitFallback': 'Privacy request submit செய்ய முடியவில்லை.',
  'privacy.validation.minDetails': 'குறைந்தது 10 characters கொண்ட விவரத்தை எழுதவும்.',
  'privacy.success.recorded': 'உங்கள் privacy request பாதுகாப்பாக பதிவு செய்யப்பட்டது.',
  'privacy.type.access': 'தகவல் அணுகல்',
  'privacy.type.correction': 'தகவல் திருத்தம்',
  'privacy.type.deletion': 'Account / தகவல் நீக்க கோரிக்கை',
  'privacy.checking': 'உங்கள் account-ஐ சரிபார்க்கிறது…',
  'privacy.auth.title': 'Privacy requests-க்கு sign in செய்யவும்',
  'privacy.auth.body': 'உங்கள் தனிப்பட்ட தகவலுக்கான access, correction அல்லது deletion request submit செய்ய sign in செய்யவும்.',
  'privacy.auth.signIn': 'Sign in',
  'privacy.auth.viewPolicy': 'Privacy Policy பார்க்க',
  'privacy.eyebrow': 'Account privacy',
  'privacy.title': 'உங்கள் privacy requests-ஐ நிர்வகிக்கவும்',
  'privacy.intro': 'உங்கள் தகவலை access செய்ய, திருத்த அல்லது eligible தகவலை நீக்க review request submit செய்யலாம்.',
  'privacy.new.title': 'புதிய request',
  'privacy.new.deletionNotice': 'Deletion request account-ஐ உடனடியாக delete செய்யாது. சட்டபூர்வ retention, security, audit மற்றும் unresolved obligations review செய்யப்பட்ட பிறகே eligible deletion process செய்யப்படும்.',
  'privacy.form.type': 'Request வகை',
  'privacy.form.details': 'Request விவரம்',
  'privacy.form.hint': 'எதை access / correct / delete செய்ய வேண்டும் என்பதை தெளிவாக எழுதவும். 10–2000 characters.',
  'privacy.form.submit': 'Privacy request submit செய்',
  'privacy.form.policy': 'Privacy Policy',
  'privacy.history.eyebrow': 'Request history',
  'privacy.history.title': 'உங்கள் requests',
  'privacy.history.loading': 'Requests load ஆகிறது…',
  'privacy.history.empty': 'Privacy requests இன்னும் இல்லை.',
  'privacy.meta.submitted': 'Submitted',
  'privacy.meta.lastUpdate': 'Last update',
  'privacy.meta.resolved': 'Resolved',
  'privacy.meta.reviewNote': 'Review note',
  'privacy.status.submitted': 'Submitted',
  'privacy.status.inReview': 'Review-ல் உள்ளது',
  'privacy.status.awaitingInformation': 'மேலும் தகவல் காத்திருக்கிறது',
  'privacy.status.completed': 'Completed',
  'privacy.status.declined': 'Declined',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useAccountPrivacyTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: AccountPrivacyKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
