'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'marketplaceReport.action.open': 'Report',
  'marketplaceReport.category.spam': 'Spam or misleading content',
  'marketplaceReport.category.harassment': 'Harassment or abusive behaviour',
  'marketplaceReport.category.fraud': 'Fraud or suspicious request',
  'marketplaceReport.category.unsafe': 'Unsafe or harmful behaviour',
  'marketplaceReport.category.offPlatform': 'Pressure to move off Takeitesee',
  'marketplaceReport.category.inappropriate': 'Inappropriate content',
  'marketplaceReport.category.other': 'Other safety concern',
  'marketplaceReport.field.concern': 'Safety concern',
  'marketplaceReport.field.details': 'Details (optional)',
  'marketplaceReport.field.detailsPlaceholder': 'Add context that helps the moderation team review this safely.',
  'marketplaceReport.error.fallback': 'Report could not be submitted.',
  'marketplaceReport.error.title': 'Report not submitted',
  'marketplaceReport.success.title': 'Report submitted',
  'marketplaceReport.success.reference': 'Reference',
  'marketplaceReport.success.audit': 'The marketplace safety team can review it without deleting the audit history.',
  'marketplaceReport.action.submit': 'Submit report',
  'marketplaceReport.action.cancel': 'Cancel',
} as const;

export type MarketplaceReportKey = keyof typeof english;

const tamil: Record<MarketplaceReportKey, string> = {
  'marketplaceReport.action.open': 'Report',
  'marketplaceReport.category.spam': 'Spam அல்லது தவறாக வழிநடத்தும் content',
  'marketplaceReport.category.harassment': 'தொந்தரவு அல்லது அவமதிக்கும் நடத்தை',
  'marketplaceReport.category.fraud': 'மோசடி அல்லது சந்தேகமான கோரிக்கை',
  'marketplaceReport.category.unsafe': 'பாதுகாப்பற்ற அல்லது தீங்கு விளைவிக்கும் நடத்தை',
  'marketplaceReport.category.offPlatform': 'Takeitesee-க்கு வெளியே செல்ல அழுத்தம் கொடுப்பது',
  'marketplaceReport.category.inappropriate': 'பொருத்தமற்ற content',
  'marketplaceReport.category.other': 'பிற safety concern',
  'marketplaceReport.field.concern': 'பாதுகாப்பு பிரச்சனை',
  'marketplaceReport.field.details': 'விவரங்கள் (விருப்பத்தேர்வு)',
  'marketplaceReport.field.detailsPlaceholder': 'Moderation team பாதுகாப்பாக review செய்ய உதவும் context-ஐ சேர்க்கவும்.',
  'marketplaceReport.error.fallback': 'Report submit செய்ய முடியவில்லை.',
  'marketplaceReport.error.title': 'Report submit ஆகவில்லை',
  'marketplaceReport.success.title': 'Report submit செய்யப்பட்டது',
  'marketplaceReport.success.reference': 'Reference',
  'marketplaceReport.success.audit': 'Audit history-ஐ delete செய்யாமல் marketplace safety team இதை review செய்யலாம்.',
  'marketplaceReport.action.submit': 'Report submit செய்',
  'marketplaceReport.action.cancel': 'ரத்து செய்',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useMarketplaceReportTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: MarketplaceReportKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
