'use client';

import Link from 'next/link';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
import styles from './BusinessStorefrontQuickBook.module.css';

type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type ServiceFulfillmentMode = 'at_provider' | 'at_customer' | 'remote';
type BookingAvailabilityMode = 'always_available' | 'on_request' | 'scheduled';
type Translate = ReturnType<typeof usePublicProviderTranslations>['t'];

type StorefrontService = {
  id: string;
  name: string;
  description: string;
  base_price: number | string | null;
  currency: string | null;
  duration_minutes: number | null;
  location: string | null;
  live_work_mode: ProviderWorkMode;
  fulfillment_modes: ServiceFulfillmentMode[];
  availability_mode: BookingAvailabilityMode;
};

function numericPrice(value: number | string | null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function liveStatus(mode: ProviderWorkMode, t: Translate) {
  if (mode === 'available') return { label: t('publicProvider.businessQuickBook.availableNow'), tone: 'positive' } as const;
  if (mode === 'busy') return { label: t('publicProvider.businessQuickBook.busyNow'), tone: 'warning' } as const;
  if (mode === 'paused') return { label: t('publicProvider.businessQuickBook.livePaused'), tone: 'neutral' } as const;
  return { label: t('publicProvider.businessQuickBook.liveOffline'), tone: 'neutral' } as const;
}

function fulfillmentLabel(modes: ServiceFulfillmentMode[], t: Translate) {
  const labels = modes.map((mode) => {
    if (mode === 'at_provider') return t('publicProvider.businessQuickBook.atBusiness');
    if (mode === 'at_customer') return t('publicProvider.businessQuickBook.travelsToYou');
    return t('publicProvider.businessQuickBook.remote');
  });
  return labels.length ? labels.join(' · ') : t('publicProvider.businessQuickBook.serviceAreaConfirmed');
}

function bookingModeCopy(mode: BookingAvailabilityMode, t: Translate) {
  if (mode === 'scheduled') {
    return {
      label: t('publicProvider.businessQuickBook.scheduledTimes'),
      cta: t('publicProvider.businessQuickBook.chooseTime'),
      note: t('publicProvider.businessQuickBook.scheduledNote'),
    };
  }
  if (mode === 'always_available') {
    return {
      label: t('publicProvider.businessQuickBook.flexibleBooking'),
      cta: t('publicProvider.businessQuickBook.bookService'),
      note: t('publicProvider.businessQuickBook.flexibleNote'),
    };
  }
  return {
    label: t('publicProvider.businessQuickBook.businessConfirmsTime'),
    cta: t('publicProvider.businessQuickBook.requestBooking'),
    note: t('publicProvider.businessQuickBook.requestNote'),
  };
}

export default function BusinessStorefrontQuickBook({
  businessName,
  businessLocation,
  services,
}: {
  businessName: string;
  businessLocation: string;
  services: StorefrontService[];
}) {
  const { locale, t } = usePublicProviderTranslations();
  const money = (value: number | string | null, currency: string | null) => {
    const amount = numericPrice(value);
    if (amount === null) return t('publicProvider.businessQuickBook.priceFallback');
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency || 'INR'} ${amount.toFixed(2)}`;
    }
  };

  return <section className={styles.storefront} aria-labelledby="business-storefront-heading">
    <div className={styles.headingRow}>
      <div>
        <span className="eyebrow">{t('publicProvider.businessQuickBook.storefront')}</span>
        <h2 id="business-storefront-heading">{t('publicProvider.businessQuickBook.title').replace('{businessName}', businessName)}</h2>
        <p>{t('publicProvider.businessQuickBook.intro')}</p>
      </div>
      <Link href="/requirements" className="button button-secondary">{t('publicProvider.businessQuickBook.postRequirement')}</Link>
    </div>

    {businessLocation ? <div className={styles.locationLine}>⌖ {businessLocation}</div> : null}
    <p className={styles.statusNote}>{t('publicProvider.businessQuickBook.statusNote')}</p>

    {services.length ? <div className={styles.serviceGrid}>
      {services.map((service) => {
        const status = liveStatus(service.live_work_mode, t);
        const booking = bookingModeCopy(service.availability_mode, t);
        return <article className={styles.serviceCard} key={service.id}>
          <div className={styles.serviceCopy}>
            <div className={styles.signalRow}>
              <span className={`${styles.signal} ${styles[status.tone]}`}>{status.label}</span>
              <span className={styles.signal}>{booking.label}</span>
            </div>
            <h3>{service.name}</h3>
            {service.description ? <p>{service.description}</p> : null}
          </div>
        <dl className={styles.serviceFacts}>
          <div><dt>{t('publicProvider.businessQuickBook.price')}</dt><dd>{money(service.base_price, service.currency)}</dd></div>
          {service.duration_minutes ? <div><dt>{t('publicProvider.businessQuickBook.duration')}</dt><dd>{service.duration_minutes} {t('publicProvider.businessQuickBook.durationUnit')}</dd></div> : null}
          <div><dt>{t('publicProvider.businessQuickBook.serviceDelivery')}</dt><dd>{fulfillmentLabel(service.fulfillment_modes, t)}</dd></div>
          {(service.location || businessLocation) ? <div><dt>{t('publicProvider.businessQuickBook.area')}</dt><dd>{service.location || businessLocation}</dd></div> : null}
        </dl>
        <p className={styles.bookingNote}>{booking.note}</p>
        <div className={styles.actions}>
          <Link href={`/services/${encodeURIComponent(service.id)}/booking`} className="button button-primary">{booking.cta}</Link>
          <Link href={`/services/${encodeURIComponent(service.id)}`} className="button button-secondary">{t('publicProvider.businessQuickBook.viewDetails')}</Link>
        </div>
      </article>})}
    </div> : <div className={styles.emptyState}>
      <strong>{t('publicProvider.businessQuickBook.emptyTitle')}</strong>
      <span>{t('publicProvider.businessQuickBook.emptyHelp')}</span>
    </div>}
  </section>;
}
