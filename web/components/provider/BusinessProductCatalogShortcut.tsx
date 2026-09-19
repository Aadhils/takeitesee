'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProviderContext = { provider_type?: 'business' | 'professional' };

export default function BusinessProductCatalogShortcut() {
  const { t } = useIdentityWorkspaceTranslations();
  const [business, setBusiness] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/provider/context', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: { provider?: ProviderContext } | null) => {
        if (!cancelled) setBusiness(payload?.provider?.provider_type === 'business');
      })
      .catch(() => { if (!cancelled) setBusiness(false); });
    return () => { cancelled = true; };
  }, []);

  if (!business) return null;

  return <Card style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
    <div style={{ minWidth: 0 }}>
      <span className="eyebrow">{t('provider.business.sales')}</span>
      <h2 style={{ margin: '.35rem 0' }}>{t('provider.business.productsCatalog')}</h2>
      <p style={{ margin: 0, color: 'var(--color-ink-muted)' }}>{t('provider.business.catalogHelp')}</p>
    </div>
    <Link href="/provider/products" className="button button-secondary">{t('provider.business.openProducts')}</Link>
  </Card>;
}
