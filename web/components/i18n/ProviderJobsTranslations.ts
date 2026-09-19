'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'providerJobs.loadFallback': 'Unable to load jobs workspace.',
  'providerJobs.unavailable': 'Jobs workspace is unavailable for this account.',
  'providerJobs.loading': 'Loading jobs workspace…',

  'providerJobs.business.eyebrow': 'Business · Employer',
  'providerJobs.business.title': 'Post jobs and hire Professionals',
  'providerJobs.business.intro': 'Your Business account is the employer side of TakeItEsee Jobs. Publish roles, review Professional applicants, schedule interviews and make employment offers.',
  'providerJobs.business.viewPublicJobs': 'View public jobs',
  'providerJobs.business.applicantDiscoveryEyebrow': 'Applicant discovery',
  'providerJobs.business.applicantDiscoveryTitle': 'Find applicants faster',
  'providerJobs.business.applicantDiscoveryIntro': 'Search and filter applicants across jobs, hiring stages and Professional verification without changing their application status.',
  'providerJobs.business.openApplicantFinder': 'Open applicant finder',

  'providerJobs.professional.eyebrow': 'Professional · Job seeker',
  'providerJobs.professional.title': 'Find jobs, apply and manage your career journey',
  'providerJobs.professional.intro': 'Verified Business employers publish jobs. Apply with your TakeItEsee resume/profile, then manage applications, interviews and employment offers here.',
  'providerJobs.professional.findJobs': 'Find jobs',
  'providerJobs.professional.myResume': 'My resume',
  'providerJobs.professional.tabsAria': 'Professional career workspace',
  'providerJobs.professional.tabs.applications': 'Applications & interviews',
  'providerJobs.professional.tabs.saved': 'Saved jobs',
  'providerJobs.professional.tabs.offers': 'Employment offers',

  'providerJobs.journey.aria': 'Hiring journey',
  'providerJobs.journey.eyebrow': 'Hiring journey',
  'providerJobs.journey.stagesAria': 'Hiring stages',
  'providerJobs.journey.professional.title': 'How your application becomes a hire',
  'providerJobs.journey.professional.body': 'A Business employer reviews your application and can move it through shortlist/message, interview and a formal offer. Hired is finalized only after you accept the offer.',
  'providerJobs.journey.business.title': 'How a job post becomes a hire',
  'providerJobs.journey.business.body': 'After a Professional applies, move the candidate through review, shortlist/message, interview and a formal offer. Hired is finalized only after the applicant accepts the offer.',
  'providerJobs.journey.professional.step.apply': 'Apply',
  'providerJobs.journey.professional.step.employerReview': 'Employer review',
  'providerJobs.journey.professional.step.shortlistMessage': 'Shortlist & message',
  'providerJobs.journey.professional.step.interview': 'Interview',
  'providerJobs.journey.professional.step.offerDecision': 'Offer decision',
  'providerJobs.journey.professional.step.hired': 'Hired',
  'providerJobs.journey.business.step.postJob': 'Post job',
  'providerJobs.journey.business.step.reviewApplicants': 'Review applicants',
  'providerJobs.journey.business.step.shortlistMessage': 'Shortlist & message',
  'providerJobs.journey.business.step.interview': 'Interview',
  'providerJobs.journey.business.step.sendOffer': 'Send offer',
  'providerJobs.journey.business.step.acceptedHired': 'Accepted → Hired',
} as const;

export type ProviderJobsKey = keyof typeof english;

const tamil: Record<ProviderJobsKey, string> = {
  'providerJobs.loadFallback': 'Jobs workspace-ஐ load செய்ய முடியவில்லை.',
  'providerJobs.unavailable': 'இந்த account-க்கு Jobs workspace கிடைக்கவில்லை.',
  'providerJobs.loading': 'Jobs workspace load ஆகிறது…',

  'providerJobs.business.eyebrow': 'Business · Employer',
  'providerJobs.business.title': 'Jobs post செய்து Professionals-ஐ hire செய்யுங்கள்',
  'providerJobs.business.intro': 'உங்கள் Business account TakeItEsee Jobs-ன் employer side ஆக செயல்படும். Jobs publish செய்து Professional applicants-ஐ review செய்யலாம், interviews schedule செய்து employment offers வழங்கலாம்.',
  'providerJobs.business.viewPublicJobs': 'Public jobs பார்க்க',
  'providerJobs.business.applicantDiscoveryEyebrow': 'Applicant discovery',
  'providerJobs.business.applicantDiscoveryTitle': 'Applicants-ஐ விரைவாக கண்டுபிடிக்கவும்',
  'providerJobs.business.applicantDiscoveryIntro': 'Application status-ஐ மாற்றாமல் jobs, hiring stages மற்றும் Professional verification அடிப்படையில் applicants-ஐ search மற்றும் filter செய்யலாம்.',
  'providerJobs.business.openApplicantFinder': 'Applicant finder திறக்க',

  'providerJobs.professional.eyebrow': 'Professional · Job seeker',
  'providerJobs.professional.title': 'Jobs தேடி, apply செய்து, career journey-ஐ manage செய்யுங்கள்',
  'providerJobs.professional.intro': 'Verified Business employer-கள் jobs publish செய்கிறார்கள். உங்கள் TakeItEsee resume/profile மூலம் apply செய்து applications, interviews மற்றும் employment offers-ஐ இங்கே manage செய்யலாம்.',
  'providerJobs.professional.findJobs': 'Jobs தேடு',
  'providerJobs.professional.myResume': 'என் Resume',
  'providerJobs.professional.tabsAria': 'Professional career workspace',
  'providerJobs.professional.tabs.applications': 'Applications & Interviews',
  'providerJobs.professional.tabs.saved': 'Saved Jobs',
  'providerJobs.professional.tabs.offers': 'Employment Offers',

  'providerJobs.journey.aria': 'Hiring journey',
  'providerJobs.journey.eyebrow': 'Hiring journey',
  'providerJobs.journey.stagesAria': 'Hiring stages',
  'providerJobs.journey.professional.title': 'Job application எப்படி hire ஆகிறது?',
  'providerJobs.journey.professional.body': 'Business employer உங்கள் application-ஐ review செய்து shortlist/message, interview மற்றும் formal offer வழியாக முன்னேற்றுவார். Offer-ஐ நீங்கள் Accept செய்த பிறகே Hired status finalize ஆகும்.',
  'providerJobs.journey.business.title': 'Job post எப்படி hire ஆகிறது?',
  'providerJobs.journey.business.body': 'Professional applicant apply செய்த பிறகு review, shortlist/message, interview மற்றும் formal offer வழியாக hiring complete செய்யலாம். Applicant offer-ஐ Accept செய்த பிறகே Hired finalize ஆகும்.',
  'providerJobs.journey.professional.step.apply': 'Apply',
  'providerJobs.journey.professional.step.employerReview': 'Employer review',
  'providerJobs.journey.professional.step.shortlistMessage': 'Shortlist & message',
  'providerJobs.journey.professional.step.interview': 'Interview',
  'providerJobs.journey.professional.step.offerDecision': 'Offer decision',
  'providerJobs.journey.professional.step.hired': 'Hired',
  'providerJobs.journey.business.step.postJob': 'Job post',
  'providerJobs.journey.business.step.reviewApplicants': 'Applicants review',
  'providerJobs.journey.business.step.shortlistMessage': 'Shortlist & message',
  'providerJobs.journey.business.step.interview': 'Interview',
  'providerJobs.journey.business.step.sendOffer': 'Offer அனுப்பு',
  'providerJobs.journey.business.step.acceptedHired': 'Accepted → Hired',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useProviderJobsTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: ProviderJobsKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
