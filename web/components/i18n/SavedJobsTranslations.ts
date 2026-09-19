'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'savedJobs.loadFallback': 'Unable to load saved jobs.',
  'savedJobs.removeFallback': 'Unable to remove saved job.',
  'savedJobs.removeSuccess': 'Saved job removed.',
  'savedJobs.eyebrow': 'Career shortlist',
  'savedJobs.title': 'Saved jobs',
  'savedJobs.intro': 'Keep interesting opportunities here and return when you are ready to apply.',
  'savedJobs.browseJobs': 'Browse jobs',
  'savedJobs.loading': 'Loading saved jobs…',
  'savedJobs.empty.title': 'No saved jobs yet',
  'savedJobs.empty.body': 'Use Save job on the public Jobs page to build a shortlist.',
  'savedJobs.empty.cta': 'Explore jobs',
  'savedJobs.unavailable.badge': 'Unavailable',
  'savedJobs.unavailable.title': 'This saved job is no longer available',
  'savedJobs.savedLabel': 'Saved',
  'savedJobs.unavailable.body': 'The job may have closed, been paused, or expired. You can remove it from your shortlist.',
  'savedJobs.removing': 'Removing…',
  'savedJobs.removeSavedJob': 'Remove saved job',
  'savedJobs.verifiedBusinessFallback': 'Verified business',
  'savedJobs.applyBy': 'Apply by',
  'savedJobs.viewApply': 'View & apply',
  'savedJobs.remove': 'Remove',
  'savedJobs.employment.fullTime': 'Full time',
  'savedJobs.employment.partTime': 'Part time',
  'savedJobs.employment.contract': 'Contract',
  'savedJobs.employment.freelance': 'Freelance',
  'savedJobs.employment.internship': 'Internship',
  'savedJobs.employment.temporary': 'Temporary',
  'savedJobs.workplace.onsite': 'On-site',
  'savedJobs.workplace.remote': 'Remote',
  'savedJobs.workplace.hybrid': 'Hybrid',
} as const;

export type SavedJobsKey = keyof typeof english;

const tamil: Record<SavedJobsKey, string> = {
  'savedJobs.loadFallback': 'Saved jobs-ஐ load செய்ய முடியவில்லை.',
  'savedJobs.removeFallback': 'Saved job-ஐ அகற்ற முடியவில்லை.',
  'savedJobs.removeSuccess': 'Saved job அகற்றப்பட்டது.',
  'savedJobs.eyebrow': 'Career shortlist',
  'savedJobs.title': 'Saved jobs',
  'savedJobs.intro': 'Apply செய்யும் முன் விருப்பமான jobs-ஐ save செய்து இங்கே மீண்டும் பார்க்கலாம்.',
  'savedJobs.browseJobs': 'Jobs தேடுங்கள்',
  'savedJobs.loading': 'Saved jobs ஏற்றப்படுகின்றன…',
  'savedJobs.empty.title': 'Saved jobs இன்னும் இல்லை',
  'savedJobs.empty.body': 'Public Jobs page-ல் விருப்பமான opportunity-ஐ Save job அழுத்தி இங்கே வைத்துக்கொள்ளலாம்.',
  'savedJobs.empty.cta': 'Jobs பார்க்க',
  'savedJobs.unavailable.badge': 'Unavailable',
  'savedJobs.unavailable.title': 'இந்த saved job இப்போது available இல்லை',
  'savedJobs.savedLabel': 'Saved',
  'savedJobs.unavailable.body': 'Job close, pause அல்லது expire ஆகியிருக்கலாம். உங்கள் shortlist record மட்டும் வைத்திருக்கிறது.',
  'savedJobs.removing': 'Removing…',
  'savedJobs.removeSavedJob': 'Saved list-லிருந்து அகற்று',
  'savedJobs.verifiedBusinessFallback': 'Verified business',
  'savedJobs.applyBy': 'Apply by',
  'savedJobs.viewApply': 'Job பார்த்து Apply செய்ய',
  'savedJobs.remove': 'Unsave',
  'savedJobs.employment.fullTime': 'Full time',
  'savedJobs.employment.partTime': 'Part time',
  'savedJobs.employment.contract': 'Contract',
  'savedJobs.employment.freelance': 'Freelance',
  'savedJobs.employment.internship': 'Internship',
  'savedJobs.employment.temporary': 'Temporary',
  'savedJobs.workplace.onsite': 'On-site',
  'savedJobs.workplace.remote': 'Remote',
  'savedJobs.workplace.hybrid': 'Hybrid',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useSavedJobsTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: SavedJobsKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
