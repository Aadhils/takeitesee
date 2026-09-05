'use client';

import { useOperationalTranslations } from '../i18n/OperationalTranslations';

export function BookingCalendarAction({ bookingId }: { bookingId: string }) {
  const { locale } = useOperationalTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');

  return <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
    <span className="summary-note">{tamil ? 'Apple, Google, Outlook போன்ற calendar apps-ல் booking நேரத்தை சேமிக்கலாம்.' : 'Save this booking to Apple, Google, Outlook, or another calendar app.'}</span>
    <a
      className="button button-secondary"
      href={`/api/bookings/${encodeURIComponent(bookingId)}/calendar`}
      download
    >
      {tamil ? 'Calendar-ல் சேர்க்கவும் (.ics)' : 'Add to calendar (.ics)'}
    </a>
  </div>;
}
