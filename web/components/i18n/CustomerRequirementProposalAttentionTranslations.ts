'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'proposalAttention.loadError': 'Proposal activity could not be loaded.',
  'proposalAttention.noProposalsYet': 'No proposals yet',
  'proposalAttention.latestProposal': 'Latest proposal',
  'proposalAttention.eyebrow': 'Proposal activity',
  'proposalAttention.title': 'Proposals for your requirements',
  'proposalAttention.description': 'Spot requirements with new proposals and jump directly to the latest proposal for review.',
  'proposalAttention.summaryNewSingle': 'new proposal',
  'proposalAttention.summaryNewPlural': 'new proposals',
  'proposalAttention.requirementWithProposals': 'requirement with proposals',
  'proposalAttention.requirementsWithProposals': 'requirements with proposals',
  'proposalAttention.loading': 'Loading proposal activity…',
  'proposalAttention.tryAgain': 'Try again',
  'proposalAttention.unavailable': 'Your requirements are available, but proposal attention is temporarily unavailable.',
  'proposalAttention.empty': 'No requirements yet. You can post a new requirement below.',
  'proposalAttention.rowNewSingle': 'new proposal',
  'proposalAttention.rowNewPlural': 'new proposals',
  'proposalAttention.proposalSingle': 'proposal',
  'proposalAttention.proposalPlural': 'proposals',
  'proposalAttention.activeToReview': 'active to review',
  'proposalAttention.reviewNew': 'Review new proposals',
  'proposalAttention.review': 'Review proposals',
  'proposalAttention.viewRequirement': 'View requirement',
} as const;

export type CustomerRequirementProposalAttentionKey = keyof typeof english;

const tamil: Record<CustomerRequirementProposalAttentionKey, string> = {
  'proposalAttention.loadError': 'Proposal activity load செய்ய முடியவில்லை.',
  'proposalAttention.noProposalsYet': 'இன்னும் proposal வரவில்லை',
  'proposalAttention.latestProposal': 'சமீபத்திய proposal',
  'proposalAttention.eyebrow': 'Proposal activity',
  'proposalAttention.title': 'உங்கள் Requirements-க்கு வந்த Proposals',
  'proposalAttention.description': 'புதிய proposal வந்த requirement-ஐ உடனே கண்டுபிடித்து, exact latest proposal-ஐ review செய்யலாம்.',
  'proposalAttention.summaryNewSingle': 'புதியது',
  'proposalAttention.summaryNewPlural': 'புதியது',
  'proposalAttention.requirementWithProposals': 'proposal உள்ள requirements',
  'proposalAttention.requirementsWithProposals': 'proposal உள்ள requirements',
  'proposalAttention.loading': 'Proposal activity load ஆகிறது…',
  'proposalAttention.tryAgain': 'மீண்டும் முயற்சி செய்',
  'proposalAttention.unavailable': 'Requirements கிடைக்கிறது; proposal attention மட்டும் தற்காலிகமாக கிடைக்கவில்லை.',
  'proposalAttention.empty': 'இன்னும் requirement இல்லை. கீழே புதிய requirement post செய்யலாம்.',
  'proposalAttention.rowNewSingle': 'புதிய proposal',
  'proposalAttention.rowNewPlural': 'புதிய proposal',
  'proposalAttention.proposalSingle': 'மொத்த proposals',
  'proposalAttention.proposalPlural': 'மொத்த proposals',
  'proposalAttention.activeToReview': 'review செய்யலாம்',
  'proposalAttention.reviewNew': 'புதிய Proposals review செய்',
  'proposalAttention.review': 'Proposals review செய்',
  'proposalAttention.viewRequirement': 'Requirement பார்க்க',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useCustomerRequirementProposalAttentionTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: CustomerRequirementProposalAttentionKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
