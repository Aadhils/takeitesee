'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'bookingCalendar.help': 'Save this booking to Apple, Google, Outlook, or another calendar app.',
  'bookingCalendar.add': 'Add to calendar (.ics)',
} as const;

export type BookingCalendarKey = keyof typeof english;

const tamil: Record<BookingCalendarKey, string> = {
  'bookingCalendar.help': 'Apple, Google, Outlook போன்ற calendar apps-ல் booking நேரத்தை சேமிக்கலாம்.',
  'bookingCalendar.add': 'Calendar-ல் சேர்க்கவும் (.ics)',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useBookingCalendarTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: BookingCalendarKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
