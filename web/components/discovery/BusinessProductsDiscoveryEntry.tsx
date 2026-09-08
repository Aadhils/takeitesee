'use client';

import Link from 'next/link';
import { Card } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

export default function BusinessProductsDiscoveryEntry() {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';

  return <Card style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
    <div style={{ minWidth: 0 }}>
      <span className="eyebrow">{tamil ? 'Business marketplace' : 'Business marketplace'}</span>
      <h2 style={{ margin: '.35rem 0' }}>{tamil ? 'Approved products கண்டுபிடிக்கவும்' : 'Discover approved products'}</h2>
      <p style={{ margin: 0, color: 'var(--color-ink-muted)', maxWidth: '70ch' }}>{tamil
        ? 'Verified Businesses-ன் platform-reviewed products-ஐ stock மற்றும் Shop status உடன் browse செய்யலாம்.'
        : 'Browse platform-reviewed products from verified Businesses with stock and Shop status before opening the storefront.'}</p>
    </div>
    <Link href="/products" className="button button-secondary">{tamil ? 'Products பார்க்க' : 'Browse products'}</Link>
  </Card>;
}
