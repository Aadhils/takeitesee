'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './BusinessStorefrontQuickBook.module.css';

type StorefrontService = {
  id: string;
  name: string;
  description: string;
  base_price: number | string | null;
  currency: string | null;
  duration_minutes: number | null;
  location: string | null;
};

function numericPrice(value: number | string | null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
        <span className="eyebrow">{tamil ? 'Business storefront' : 'Business storefront'}</span>
        <h2 id="business-storefront-heading">{tamil ? `${businessName} சேவைகளை புக் செய்யுங்கள்` : `Book services from ${businessName}`}</h2>
        <p>{tamil
          ? 'TakeItEsee-ல் live ஆக உள்ள verified services-ஐ தேர்வு செய்து நேரடியாக booking தொடங்குங்கள்.'
          : 'Choose a live verified service and start the existing TakeItEsee booking flow directly.'}</p>
      </div>
      <Link href="/requirements" className="button button-secondary">{tamil ? 'தேவையை Post செய்யுங்கள்' : 'Post a requirement'}</Link>
    </div>

    {businessLocation ? <div className={styles.locationLine}>⌖ {businessLocation}</div> : null}

    {services.length ? <div className={styles.serviceGrid}>
      {services.map((service) => <article className={styles.serviceCard} key={service.id}>
        <div className={styles.serviceCopy}>
          <span className={styles.serviceLabel}>{tamil ? 'Active service' : 'Active service'}</span>
          <h3>{service.name}</h3>
          {service.description ? <p>{service.description}</p> : null}
        </div>
        <dl className={styles.serviceFacts}>
          <div><dt>{tamil ? 'விலை' : 'Price'}</dt><dd>{money(service.base_price, service.currency)}</dd></div>
          {service.duration_minutes ? <div><dt>{tamil ? 'கால அளவு' : 'Duration'}</dt><dd>{service.duration_minutes} {tamil ? 'நிமிடங்கள்' : 'min'}</dd></div> : null}
          {(service.location || businessLocation) ? <div><dt>{tamil ? 'இடம்' : 'Area'}</dt><dd>{service.location || businessLocation}</dd></div> : null}
        </dl>
        <div className={styles.actions}>
          <Link href={`/services/${encodeURIComponent(service.id)}/booking`} className="button button-primary">{tamil ? 'Service புக் செய்யுங்கள்' : 'Book service'}</Link>
          <Link href={`/services/${encodeURIComponent(service.id)}`} className="button button-secondary">{tamil ? 'விவரம் பார்க்க' : 'View details'}</Link>
        </div>
      </article>)}
    </div> : <div className={styles.emptyState}>
      <strong>{tamil ? 'தற்போது active services இல்லை.' : 'No active services are listed right now.'}</strong>
      <span>{tamil ? 'உங்கள் தேவையை post செய்து marketplace providers-ஐ அணுகலாம்.' : 'You can still post a requirement for the marketplace.'}</span>
    </div>}
  </section>;
}
