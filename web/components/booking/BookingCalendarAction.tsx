'use client';

import { useBookingCalendarTranslations } from '../i18n/BookingCalendarTranslations';
import styles from './BookingCalendarAction.module.css';

export function BookingCalendarAction({ bookingId }: { bookingId: string }) {
  const { t } = useBookingCalendarTranslations();

  return <div className={styles.calendarAction}>
    <span className="summary-note">{t('bookingCalendar.help')}</span>
    <a
      className="button button-secondary"
      href={`/api/bookings/${encodeURIComponent(bookingId)}/calendar`}
      download
    >
      {t('bookingCalendar.add')}
    </a>
  </div>;
}
