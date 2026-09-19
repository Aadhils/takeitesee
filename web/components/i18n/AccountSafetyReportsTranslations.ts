'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'reports.loadFallback': 'Unable to load safety reports.',
  'reports.checking': 'Checking your safety reports…',
  'reports.auth.title': 'Sign in to view safety reports',
  'reports.auth.body': 'Sign in to review the status of marketplace safety items you reported to TakeItEsee.',
  'reports.auth.signIn': 'Sign in',
  'reports.auth.backAccount': 'Back to account',
  'reports.eyebrow': 'Marketplace safety',
  'reports.title': 'My safety reports',
  'reports.intro': 'Track the review status and safe status history of marketplace items you reported.',
  'reports.visibility.title': 'What is shown here?',
  'reports.visibility.body': 'You can see your report reference, category, submitted details and review status. Internal moderator notes and staff identifiers are not exposed.',
  'reports.action.platformSupport': 'Platform support',
  'reports.action.backAccount': 'Back to account',
  'reports.loading': 'Loading reports…',
  'reports.empty': 'You have not submitted any marketplace safety reports yet.',
  'reports.meta.category': 'Category',
  'reports.meta.submitted': 'Submitted',
  'reports.meta.lastUpdate': 'Last update',
  'reports.meta.resolved': 'Resolved',
  'reports.details.title': 'Your submitted details',
  'reports.history.title': 'Status history',
  'reports.status.open': 'Open',
  'reports.status.reviewing': 'Reviewing',
  'reports.status.actioned': 'Actioned',
  'reports.status.dismissed': 'Dismissed',
} as const;

export type AccountSafetyReportsKey = keyof typeof english;

const tamil: Record<AccountSafetyReportsKey, string> = {
  'reports.loadFallback': 'Safety reports-ஐ load செய்ய முடியவில்லை.',
  'reports.checking': 'உங்கள் safety reports-ஐ சரிபார்க்கிறது…',
  'reports.auth.title': 'Safety reports பார்க்க sign in செய்யவும்',
  'reports.auth.body': 'நீங்கள் TakeItEsee-க்கு report செய்த marketplace safety items-ன் status பார்க்க sign in செய்யவும்.',
  'reports.auth.signIn': 'Sign in',
  'reports.auth.backAccount': 'Account-க்கு திரும்பவும்',
  'reports.eyebrow': 'Marketplace safety',
  'reports.title': 'என் safety reports',
  'reports.intro': 'நீங்கள் report செய்த marketplace items-ன் review status மற்றும் safe status history இங்கே காணலாம்.',
  'reports.visibility.title': 'என்ன காட்டப்படும்?',
  'reports.visibility.body': 'உங்கள் report reference, category, நீங்கள் கொடுத்த விவரம் மற்றும் review status மட்டும் காட்டப்படும். விசாரணை பாதுகாப்பிற்காக internal moderator notes மற்றும் staff identifiers காட்டப்படாது.',
  'reports.action.platformSupport': 'Platform support',
  'reports.action.backAccount': 'Account-க்கு திரும்பவும்',
  'reports.loading': 'Reports load ஆகிறது…',
  'reports.empty': 'நீங்கள் இன்னும் marketplace safety report submit செய்யவில்லை.',
  'reports.meta.category': 'Category',
  'reports.meta.submitted': 'Submitted',
  'reports.meta.lastUpdate': 'Last update',
  'reports.meta.resolved': 'Resolved',
  'reports.details.title': 'நீங்கள் கொடுத்த விவரம்',
  'reports.history.title': 'Status history',
  'reports.status.open': 'Open',
  'reports.status.reviewing': 'Review-ல் உள்ளது',
  'reports.status.actioned': 'Actioned',
  'reports.status.dismissed': 'Dismissed',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useAccountSafetyReportsTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: AccountSafetyReportsKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
