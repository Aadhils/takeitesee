'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './BusinessStorefrontQuickBook.module.css';

type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type ServiceFulfillmentMode = 'at_provider' | 'at_customer' | 'remote';
type BookingAvailabilityMode = 'always_available' | 'on_request' | 'scheduled';

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

function liveStatus(mode: ProviderWorkMode, tamil: boolean) {
  if (mode === 'available') return { label: tamil ? 'இப்போது கிடைக்கிறார்' : 'Available now', tone: 'positive' } as const;
  if (mode === 'busy') return { label: tamil ? 'தற்போது பிஸி' : 'Busy now', tone: 'warning' } as const;
  if (mode === 'paused') return { label: tamil ? 'Live வேலை இடைநிறுத்தம்' : 'Live work paused', tone: 'neutral' } as const;
  return { label: tamil ? 'Live வேலை Offline' : 'Live work offline', tone: 'neutral' } as const;
}

function fulfillmentLabel(modes: ServiceFulfillmentMode[], tamil: boolean) {
  const labels = modes.map((mode) => {
    if (mode === 'at_provider') return tamil ? 'Business இடத்தில்' : 'At business';
    if (mode === 'at_customer') return tamil ? 'உங்கள் இடத்திற்கு வருவர்' : 'Travels to you';
    return tamil ? 'Remote சேவை' : 'Remote';
  });
  return labels.length ? labels.join(' · ') : (tamil ? 'Service area உறுதிசெய்யப்படும்' : 'Service area confirmed with business');
}

function bookingModeCopy(mode: BookingAvailabilityMode, tamil: boolean) {
  if (mode === 'scheduled') {
    return {
      label: tamil ? 'அட்டவணை நேரங்கள்' : 'Scheduled times',
      cta: tamil ? 'நேரம் தேர்வு செய்' : 'Choose time',
      note: tamil ? 'Business அமைத்துள்ள available slots-இல் இருந்து தேர்வு செய்யலாம்.' : 'Choose from the business’s configured available slots.',
    };
  }
  if (mode === 'always_available') {
    return {
      label: tamil ? 'Flexible booking' : 'Flexible booking',
      cta: tamil ? 'Service புக் செய்' : 'Book service',
      note: tamil ? 'Booking நேரம் final confirmation-க்கு முன் மீண்டும் validate செய்யப்படும்.' : 'The selected time is revalidated before the booking request is created.',
    };
  }
  return {
    label: tamil ? 'Business நேரத்தை உறுதிசெய்யும்' : 'Business confirms time',
    cta: tamil ? 'Booking request அனுப்பு' : 'Request booking',
    note: tamil ? 'நீங்கள் விரும்பும் நேரத்தை தேர்வு செய்யுங்கள்; Business accept அல்லது decline செய்யும்.' : 'Choose your preferred time; the business can accept or decline the request.',
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
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const money = (value: number | string | null, currency: string | null) => {
    const amount = numericPrice(value);
    if (amount === null) return tamil ? 'விலை சேவையில் பார்க்கவும்' : 'See service for price';
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
        <span className="eyebrow">Business storefront</span>
        <h2 id="business-storefront-heading">{tamil ? `${businessName} சேவைகளை புக் செய்யுங்கள்` : `Book or request services from ${businessName}`}</h2>
        <p>{tamil
          ? 'Verified services-ஐ தேர்வு செய்து Business-க்கு நேரடியாக booking request அனுப்புங்கள். Live work status, service delivery mode, booking type ஆகியவை கீழே காட்டப்படும்.'
          : 'Choose a verified service and send the booking directly to this business. Live work status, delivery mode, and booking type are shown before you continue.'}</p>
      </div>
      <Link href="/requirements" className="button button-secondary">{tamil ? 'Marketplace-க்கு தேவையை Post செய்' : 'Post a marketplace requirement'}</Link>
    </div>

    {businessLocation ? <div className={styles.locationLine}>⌖ {businessLocation}</div> : null}
    <p className={styles.statusNote}>{tamil
      ? 'Live work status என்பது Business Shop Open/Closed அல்ல; அது தற்போது வேலை ஏற்கும் operational signal மட்டும். Service schedule தனியாகவே செயல்படும்.'
      : 'Live work status is not the business’s Shop Open/Closed state. It only signals current work readiness; each service’s booking schedule remains separate.'}</p>

    {services.length ? <div className={styles.serviceGrid}>
      {services.map((service) => {
        const status = liveStatus(service.live_work_mode, tamil);
        const booking = bookingModeCopy(service.availability_mode, tamil);
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
          <div><dt>{tamil ? 'விலை' : 'Price'}</dt><dd>{money(service.base_price, service.currency)}</dd></div>
          {service.duration_minutes ? <div><dt>{tamil ? 'கால அளவு' : 'Duration'}</dt><dd>{service.duration_minutes} {tamil ? 'நிமிடங்கள்' : 'min'}</dd></div> : null}
          <div><dt>{tamil ? 'சேவை முறை' : 'Service delivery'}</dt><dd>{fulfillmentLabel(service.fulfillment_modes, tamil)}</dd></div>
          {(service.location || businessLocation) ? <div><dt>{tamil ? 'பகுதி' : 'Area'}</dt><dd>{service.location || businessLocation}</dd></div> : null}
        </dl>
        <p className={styles.bookingNote}>{booking.note}</p>
        <div className={styles.actions}>
          <Link href={`/services/${encodeURIComponent(service.id)}/booking`} className="button button-primary">{booking.cta}</Link>
          <Link href={`/services/${encodeURIComponent(service.id)}`} className="button button-secondary">{tamil ? 'விவரம் பார்க்க' : 'View details'}</Link>
        </div>
      </article>})}
    </div> : <div className={styles.emptyState}>
      <strong>{tamil ? 'தற்போது active services இல்லை.' : 'No active services are listed right now.'}</strong>
      <span>{tamil ? 'உங்கள் தேவையை post செய்து marketplace providers-ஐ அணுகலாம்.' : 'You can still post a requirement for the marketplace.'}</span>
    </div>}
  </section>;
}
