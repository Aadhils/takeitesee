'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type BusinessShopState = 'open' | 'closed';
type ProviderContext = { provider_type?: 'business' | 'professional' };
type ShopStatus = {
  business_id: string;
  shop_state: BusinessShopState;
  status_changed_at: string | null;
  updated_at: string | null;
};

export default function BusinessShopStatusControl() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [isBusiness, setIsBusiness] = useState(false);
  const [shop, setShop] = useState<ShopStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<BusinessShopState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const contextResponse = await fetch('/api/provider/context', { cache: 'no-store' });
        const contextPayload = await contextResponse.json() as { provider?: ProviderContext; error?: string };
        if (!contextResponse.ok || contextPayload.provider?.provider_type !== 'business') {
          if (!cancelled) { setIsBusiness(false); setLoading(false); }
          return;
        }
        if (!cancelled) setIsBusiness(true);
        const response = await fetch('/api/provider/shop-status', { cache: 'no-store' });
        const payload = await response.json() as { shop?: ShopStatus; error?: string };
        if (!response.ok || !payload.shop) throw new Error(payload.error || 'Unable to load shop status.');
        if (!cancelled) { setShop(payload.shop); setError(''); }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load shop status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const update = async (next: BusinessShopState) => {
    if (saving || shop?.shop_state === next) return;
    setSaving(next);
    setError('');
    try {
      const response = await fetch('/api/provider/shop-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_state: next }),
      });
      const payload = await response.json() as { shop?: ShopStatus; error?: string };
      if (!response.ok || !payload.shop) throw new Error(payload.error || 'Unable to update shop status.');
      setShop(payload.shop);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update shop status.');
    } finally {
      setSaving(null);
    }
  };

  if (!loading && !isBusiness) return null;
  if (loading && !isBusiness) return null;

  const state = shop?.shop_state ?? 'closed';
  return <Card style={{ marginTop: '1rem', display: 'grid', gap: '.8rem' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div>
        <span className="eyebrow">{tamil ? 'Business storefront' : 'Business storefront'}</span>
        <h2 style={{ margin: '.35rem 0' }}>{tamil ? 'Shop Open / Closed' : 'Shop Open / Closed'}</h2>
        <p style={{ margin: 0, color: 'var(--color-ink-muted)' }}>{tamil
          ? 'இது உங்கள் Business storefront operating signal மட்டும். Provider Available/Busy மற்றும் service schedule இரண்டிலிருந்தும் தனி.'
          : 'This is your Business storefront operating signal only. It is separate from Provider Available/Busy and each service schedule.'}</p>
      </div>
      <Badge tone={state === 'open' ? 'success' : 'neutral'}>{state === 'open' ? (tamil ? 'Shop Open' : 'Shop Open') : (tamil ? 'Shop Closed' : 'Shop Closed')}</Badge>
    </div>

    {error ? <Alert title={tamil ? 'Shop status update ஆகவில்லை' : 'Shop status unavailable'} tone="danger">{error}</Alert> : null}

    <div className="button-row">
      <Button type="button" loading={saving === 'open'} disabled={state === 'open'} onClick={() => void update('open')}>
        {tamil ? 'Open shop' : 'Open shop'}
      </Button>
      <Button type="button" variant="secondary" loading={saving === 'closed'} disabled={state === 'closed'} onClick={() => void update('closed')}>
        {tamil ? 'Close shop' : 'Close shop'}
      </Button>
    </div>
    <p className="summary-note" style={{ margin: 0 }}>{tamil
      ? 'Shop Closed செய்தாலும் existing bookings/orders cancel ஆகாது. Booking schedule மற்றும் order lifecycle தனியாகவே செயல்படும்.'
      : 'Closing the shop does not cancel existing bookings or orders. Booking schedules and order lifecycles continue independently.'}</p>
  </Card>;
}
