'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'requirementBookingContext.eyebrow': 'Requirement coordination',
  'requirementBookingContext.title': 'Continue with your selected provider',
  'requirementBookingContext.body': 'This booking was created from “{title}”. Keep schedule and service-detail coordination in the same private conversation.',
  'requirementBookingContext.messageProvider': 'Message provider',
  'requirementBookingContext.openRequirement': 'Open requirement',
} as const;

export type RequirementBookingContextKey = keyof typeof english;

const tamil: Record<RequirementBookingContextKey, string> = {
  'requirementBookingContext.eyebrow': 'Requirement coordination',
  'requirementBookingContext.title': 'Selected Provider உடன் coordination தொடருங்கள்',
  'requirementBookingContext.body': 'இந்த booking “{title}” requirement-லிருந்து உருவானது. Schedule அல்லது service details பற்றி பேச வேண்டுமெனில் அதே private conversation-ஐ தொடருங்கள்.',
  'requirementBookingContext.messageProvider': 'Provider-க்கு message செய்',
  'requirementBookingContext.openRequirement': 'Requirement பார்க்க',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useRequirementBookingContextTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: RequirementBookingContextKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
