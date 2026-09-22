'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'requirementCompletion.eyebrow': 'Service completion',
  'requirementCompletion.confirmFallback': 'Completion could not be confirmed.',
  'requirementCompletion.confirming': 'Confirming…',
  'requirementCompletion.confirmAction': 'Confirm service completed',
  'requirementCompletion.provider.support.label': 'Support open',
  'requirementCompletion.provider.support.title': 'Customer raised a service issue',
  'requirementCompletion.provider.support.body': 'An active support case is attached to this booking. Keep coordinating and wait for support resolution before treating the service record as final.',
  'requirementCompletion.provider.confirmed.label': 'Confirmed',
  'requirementCompletion.provider.confirmed.title': 'Customer confirmed service completion',
  'requirementCompletion.provider.confirmed.body': 'Customer acknowledgement is recorded. Continue to watch the booking closeout section for any review or support activity.',
  'requirementCompletion.provider.awaiting.label': 'Awaiting customer',
  'requirementCompletion.provider.awaiting.title': 'Service complete — awaiting customer acknowledgement',
  'requirementCompletion.provider.awaiting.body': 'You marked the service complete. The customer can confirm completion or raise an issue; keep the coordination channel available until that acknowledgement arrives.',
  'requirementCompletion.customer.support.label': 'Support open',
  'requirementCompletion.customer.support.title': 'Your service issue is with support',
  'requirementCompletion.customer.support.body': 'You do not need to confirm completion while an active service issue is being handled. Follow the case status in the Service lifecycle section below.',
  'requirementCompletion.customer.action.label': 'Action needed',
  'requirementCompletion.customer.action.title': 'Provider marked the service complete',
  'requirementCompletion.customer.action.body': 'If the service was actually completed, confirm completion. If there is a problem, do not confirm yet—message the provider or open support in the Service lifecycle section below. You can review after checking the completion details.',
  'requirementCompletion.customer.acknowledged.label': 'Acknowledged',
  'requirementCompletion.customer.acknowledged.title': 'Completion confirmed — review is the next step',
  'requirementCompletion.customer.acknowledged.body': 'Your completion acknowledgement is recorded. Use the review section further down this booking page to rate the experience; support remains available while its window is open.',
  'requirementCompletion.customer.reviewed.label': 'Reviewed',
  'requirementCompletion.customer.reviewed.title': 'Completion and review are recorded',
  'requirementCompletion.customer.reviewed.body': 'Your customer-side service steps are complete. Final lifecycle status will continue according to the existing booking closeout rules.',
} as const;

export type RequirementCompletionKey = keyof typeof english;

const tamil: Record<RequirementCompletionKey, string> = {
  'requirementCompletion.eyebrow': 'Service completion',
  'requirementCompletion.confirmFallback': 'Completion-ஐ உறுதி செய்ய முடியவில்லை.',
  'requirementCompletion.confirming': 'உறுதி செய்கிறது…',
  'requirementCompletion.confirmAction': 'Service completion உறுதி செய்',
  'requirementCompletion.provider.support.label': 'Support open',
  'requirementCompletion.provider.support.title': 'Customer ஒரு issue பதிவு செய்துள்ளார்',
  'requirementCompletion.provider.support.body': 'Booking closeout-ல் active support case உள்ளது. Service record-ஐ final ஆக assume செய்யாமல், customer coordination மற்றும் support resolution-ஐ தொடருங்கள்.',
  'requirementCompletion.provider.confirmed.label': 'Confirmed',
  'requirementCompletion.provider.confirmed.title': 'Customer service completion-ஐ உறுதி செய்துள்ளார்',
  'requirementCompletion.provider.confirmed.body': 'Customer acknowledgement பதிவு செய்யப்பட்டுள்ளது. Review அல்லது support activity இருந்தால் booking closeout section-ல் தொடர்ந்து பார்க்கலாம்.',
  'requirementCompletion.provider.awaiting.label': 'Awaiting customer',
  'requirementCompletion.provider.awaiting.title': 'Service complete — Customer acknowledgement காத்திருக்கிறது',
  'requirementCompletion.provider.awaiting.body': 'நீங்கள் service-ஐ complete என்று பதிவு செய்துள்ளீர்கள். Customer completion-ஐ confirm செய்யலாம் அல்லது issue/support raise செய்யலாம்; அதுவரை coordination channel open-ஆ வைத்திருங்கள்.',
  'requirementCompletion.customer.support.label': 'Support open',
  'requirementCompletion.customer.support.title': 'உங்கள் service issue support-ல் உள்ளது',
  'requirementCompletion.customer.support.body': 'Active support case இருக்கும் போது completion-ஐ அவசரமாக confirm செய்ய தேவையில்லை. கீழே உள்ள Service lifecycle section-ல் case status-ஐ பார்க்கலாம்.',
  'requirementCompletion.customer.action.label': 'Action needed',
  'requirementCompletion.customer.action.title': 'Provider service-ஐ complete என்று பதிவு செய்துள்ளார்',
  'requirementCompletion.customer.action.body': 'Service உண்மையாக முடிந்திருந்தால் completion-ஐ confirm செய்யுங்கள். ஏதேனும் பிரச்சனை இருந்தால் confirm செய்யாமல் Provider-க்கு message செய்யவும் அல்லது கீழே உள்ள Service lifecycle section-ல் support raise செய்யவும். அதன் பிறகு review கொடுக்கலாம்.',
  'requirementCompletion.customer.acknowledged.label': 'Acknowledged',
  'requirementCompletion.customer.acknowledged.title': 'Completion confirmed — Review அடுத்த step',
  'requirementCompletion.customer.acknowledged.body': 'Service completion acknowledgement பதிவு செய்யப்பட்டுள்ளது. இந்த booking page-ல் கீழே உள்ள review section மூலம் உங்கள் experience-ஐ பதிவு செய்யலாம்; issue இருந்தால் support window இருக்கும் வரை help பெறலாம்.',
  'requirementCompletion.customer.reviewed.label': 'Reviewed',
  'requirementCompletion.customer.reviewed.title': 'Completion மற்றும் review பதிவு செய்யப்பட்டுள்ளது',
  'requirementCompletion.customer.reviewed.body': 'இந்த service interaction-ன் customer-side steps முடிந்துள்ளன. Final lifecycle status existing booking closeout rules-ன் படி update ஆகும்.',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useRequirementCompletionTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: RequirementCompletionKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
