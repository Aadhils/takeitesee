'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'requirementLifecycle.eyebrow': 'Requirement lifecycle',
  'requirementLifecycle.title': 'Separate active work from history',
  'requirementLifecycle.description': 'Open or paused needs are still before provider selection. Awarded means a provider was selected and the service journey continues in Bookings. Fulfilled or cancelled records are history.',
  'requirementLifecycle.openNeeds': 'Open needs',
  'requirementLifecycle.awardedWork': 'Awarded work',
  'requirementLifecycle.history': 'History',
  'requirementLifecycle.awardedQuestion': 'Where does awarded work continue?',
  'requirementLifecycle.awardedBody': 'Schedule, service execution, completion confirmation and support status continue in My Bookings. The requirement becomes final history only when its existing lifecycle reaches that stage.',
  'requirementLifecycle.openBookings': 'Open My Bookings',
} as const;

export type CustomerRequirementLifecycleKey = keyof typeof english;

const tamil: Record<CustomerRequirementLifecycleKey, string> = {
  'requirementLifecycle.eyebrow': 'Requirement lifecycle',
  'requirementLifecycle.title': 'Active work மற்றும் history தனித்தனியாக',
  'requirementLifecycle.description': 'Open/paused needs இன்னும் provider selection-க்கு முன் உள்ளவை. Awarded என்றால் Provider தேர்ந்தெடுக்கப்பட்டு service journey Bookings-ல் தொடர்கிறது. Fulfilled/cancelled records history ஆகும்.',
  'requirementLifecycle.openNeeds': 'Open needs',
  'requirementLifecycle.awardedWork': 'Awarded work',
  'requirementLifecycle.history': 'History',
  'requirementLifecycle.awardedQuestion': 'Provider தேர்ந்தெடுத்த work எங்கே?',
  'requirementLifecycle.awardedBody': 'Schedule, service execution, completion confirmation மற்றும் support status ஆகியவை My Bookings-ல் தொடர்ந்து track செய்யப்படும். Requirement status final history-ஆக மாறுவது தனி lifecycle step.',
  'requirementLifecycle.openBookings': 'My Bookings பார்க்க',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useCustomerRequirementLifecycleTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: CustomerRequirementLifecycleKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
