'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'support.loadFallback': 'Unable to load support requests.',
  'support.submitFallback': 'Unable to submit support request.',
  'support.success.recorded': 'Your support request has been recorded.',
  'support.type.platformGrievance': 'Platform grievance',
  'support.type.accountHelp': 'Account help',
  'support.type.safety': 'Safety concern',
  'support.type.providerConduct': 'Provider conduct',
  'support.type.other': 'Other support',
  'support.checking': 'Checking your account…',
  'support.auth.title': 'Sign in for platform support',
  'support.auth.body': 'Sign in to submit and track an in-app support request. If you cannot sign in, you can still use the Grievance Officer email fallback.',
  'support.auth.signIn': 'Sign in',
  'support.auth.emailOfficer': 'Email Grievance Officer',
  'support.eyebrow': 'Platform support',
  'support.title': 'Support & grievance requests',
  'support.intro': 'Submit and track TakeItEsee platform issues, account help, safety concerns, or provider-conduct concerns that are not booking-specific.',
  'support.new.title': 'New support request',
  'support.new.boundary': 'For booking-specific issues, use Get help from that booking. For privacy access, correction, or deletion review, use the Account privacy workflow.',
  'support.form.type': 'Request type',
  'support.form.subject': 'Subject',
  'support.form.details': 'Details',
  'support.form.hint': '10–4000 characters. Do not include passwords or sensitive payment details.',
  'support.form.submit': 'Submit request',
  'support.form.privacy': 'Privacy requests',
  'support.history.eyebrow': 'Request history',
  'support.history.title': 'Your support requests',
  'support.history.loading': 'Loading requests…',
  'support.history.empty': 'You have not submitted any platform support requests yet.',
  'support.meta.type': 'Type',
  'support.meta.submitted': 'Submitted',
  'support.meta.lastUpdate': 'Last update',
  'support.meta.reviewNote': 'Review note',
  'support.status.submitted': 'Submitted',
  'support.status.inReview': 'In review',
  'support.status.awaitingInformation': 'Awaiting information',
  'support.status.resolved': 'Resolved',
  'support.status.closed': 'Closed',
} as const;

export type AccountSupportKey = keyof typeof english;

const tamil: Record<AccountSupportKey, string> = {
  'support.loadFallback': 'Support requests-ஐ load செய்ய முடியவில்லை.',
  'support.submitFallback': 'Support request submit செய்ய முடியவில்லை.',
  'support.success.recorded': 'உங்கள் support request பதிவு செய்யப்பட்டது.',
  'support.type.platformGrievance': 'Platform grievance',
  'support.type.accountHelp': 'Account உதவி',
  'support.type.safety': 'Safety concern',
  'support.type.providerConduct': 'Provider conduct',
  'support.type.other': 'மற்ற உதவி',
  'support.checking': 'உங்கள் account-ஐ சரிபார்க்கிறது…',
  'support.auth.title': 'Platform support-க்கு sign in செய்யவும்',
  'support.auth.body': 'In-app support request submit செய்து status track செய்ய sign in செய்யவும். Sign in செய்ய முடியாவிட்டால் Grievance Officer email fallback பயன்படுத்தலாம்.',
  'support.auth.signIn': 'Sign in',
  'support.auth.emailOfficer': 'Grievance Officer-க்கு email',
  'support.eyebrow': 'Platform support',
  'support.title': 'Support & grievance requests',
  'support.intro': 'Booking-க்கு அப்பாற்பட்ட TakeItEsee platform issue, account help, safety concern அல்லது provider conduct concern-ஐ submit செய்து status track செய்யவும்.',
  'support.new.title': 'புதிய support request',
  'support.new.boundary': 'Booking-specific issue என்றால் அந்த booking detail-ல் உள்ள Get help flow-ஐ பயன்படுத்தவும். Privacy access/correction/deletion review request என்றால் Account privacy workflow-ஐ பயன்படுத்தவும்.',
  'support.form.type': 'Request வகை',
  'support.form.subject': 'Subject',
  'support.form.details': 'விவரம்',
  'support.form.hint': '10–4000 characters. Sensitive payment details அல்லது passwords பகிர வேண்டாம்.',
  'support.form.submit': 'Request submit செய்',
  'support.form.privacy': 'Privacy requests',
  'support.history.eyebrow': 'Request history',
  'support.history.title': 'உங்கள் support requests',
  'support.history.loading': 'Requests load ஆகிறது…',
  'support.history.empty': 'Support requests இன்னும் இல்லை.',
  'support.meta.type': 'Type',
  'support.meta.submitted': 'Submitted',
  'support.meta.lastUpdate': 'Last update',
  'support.meta.reviewNote': 'Review note',
  'support.status.submitted': 'Submitted',
  'support.status.inReview': 'Review-ல் உள்ளது',
  'support.status.awaitingInformation': 'மேலும் தகவல் காத்திருக்கிறது',
  'support.status.resolved': 'Resolved',
  'support.status.closed': 'Closed',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useAccountSupportTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: AccountSupportKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
