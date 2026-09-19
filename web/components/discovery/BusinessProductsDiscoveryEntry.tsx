'use client';

import Link from 'next/link';
import { Card } from '../ui/primitives';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';

export default function BusinessProductsDiscoveryEntry() {
  const { t } = usePublicProviderTranslations();

  return <Card style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
    <div style={{ minWidth: 0 }}>
      <span className="eyebrow">{t('publicProvider.productMarketplace.eyebrow')}</span>
      <h2 style={{ margin: '.35rem 0' }}>{t('publicProvider.productMarketplace.entryTitle')}</h2>
      <p style={{ margin: 0, color: 'var(--color-ink-muted)', maxWidth: '70ch' }}>{t('publicProvider.productMarketplace.entryIntro')}</p>
    </div>
    <Link href="/products" className="button button-secondary">{t('publicProvider.productMarketplace.entryBrowse')}</Link>
  </Card>;
}
