'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

export default function SavedProductAction({ productId }: { productId: string }) {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch(`/api/account/saved-products?product_id=${encodeURIComponent(productId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          setAuthenticated(false);
          setSaved(false);
          return;
        }
        const payload = await response.json() as { saved?: boolean; error?: string };
        setAuthenticated(true);
        if (!response.ok) throw new Error(payload.error || 'Unable to load saved Product state.');
        setSaved(Boolean(payload.saved));
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load saved Product state.');
      });
    return () => { active = false; };
  }, [productId]);

  if (authenticated === false) {
    const returnTo = encodeURIComponent(`/products/${productId}`);
    return <Link className="button button-secondary" href={`/login?returnTo=${returnTo}`}>{tamil ? 'Product சேமிக்க Sign in' : 'Sign in to save Product'}</Link>;
  }

  if (authenticated === null && !error) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account/saved-products', {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || (saved ? 'Unable to remove saved Product.' : 'Unable to save Product.'));
      setAuthenticated(true);
      setSaved((current) => !current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update saved Product.');
    } finally {
      setBusy(false);
    }
  };

  return <div style={{ display: 'grid', gap: '.45rem' }}>
    <Button type="button" variant={saved ? 'secondary' : 'quiet'} loading={busy} aria-pressed={saved} onClick={() => void toggle()}>
      {saved ? (tamil ? 'சேமிக்கப்பட்டது ✓' : 'Saved ✓') : (tamil ? 'Product சேமி' : 'Save Product')}
    </Button>
    {error ? <span className="field-error" role="alert">{error}</span> : null}
  </div>;
}
