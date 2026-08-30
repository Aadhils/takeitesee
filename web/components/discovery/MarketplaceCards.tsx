'use client';

import { useLanguage } from '../i18n/LanguageProvider';

export { LiveMarketplaceServiceCard as ServiceCard } from './LiveMarketplacePresentation';

export function Rating({ value, count }: { value: number; count: number }) {
  const { locale } = useLanguage();
  const label = locale === 'ta-IN'
    ? `5-ல் ${value.toFixed(1)} மதிப்பீடு, ${count} விமர்சனங்கள்`
    : `${value.toFixed(1)} out of 5 stars from ${count} reviews`;
  return <span className="rating" aria-label={label}><span aria-hidden="true">★</span> {value.toFixed(1)} <small>({count})</small></span>;
}
