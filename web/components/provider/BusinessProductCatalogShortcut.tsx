'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProviderContext = { provider_type?: 'business' | 'professional' };

export default function BusinessProductCatalogShortcut() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
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
      <span className="eyebrow">{tamil ? 'Business sales' : 'Business sales'}</span>
      <h2 style={{ margin: '.35rem 0' }}>{tamil ? 'Products & catalog' : 'Products & catalog'}</h2>
      <p style={{ margin: 0, color: 'var(--color-ink-muted)' }}>{tamil
        ? 'விற்பனை செய்யும் products-ஐ private catalog-ல் தயார் செய்யுங்கள். Public launch இன்னும் தனி approval stage.'
        : 'Prepare products you plan to sell in your private catalog. Public launch remains a separate approval stage.'}</p>
    </div>
    <Link href="/provider/products" className="button button-secondary">{tamil ? 'Products திற' : 'Open products'}</Link>
  </Card>;
}
