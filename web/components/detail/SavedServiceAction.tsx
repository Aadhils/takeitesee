'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../ui/primitives';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';

export default function SavedServiceAction({ serviceId }: { serviceId: string }) {
  const { t } = usePublicProviderTranslations();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch(`/api/account/saved-services?service_id=${encodeURIComponent(serviceId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          setAuthenticated(false);
          setSaved(false);
          return;
        }
        const payload = await response.json() as { saved?: boolean; error?: string };
        if (!response.ok) throw new Error(payload.error || t('publicProvider.savedService.loadError'));
        setAuthenticated(true);
        setSaved(Boolean(payload.saved));
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : t('publicProvider.savedService.loadError'));
      });
    return () => { active = false; };
  }, [serviceId, t]);

  if (authenticated === false) {
    const returnTo = encodeURIComponent(`/services/${serviceId}`);
    return <Link className="button button-secondary" href={`/login?returnTo=${returnTo}`}>{t('publicProvider.savedService.signIn')}</Link>;
  }

  if (authenticated === null && !error) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account/saved-services', {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || (saved
        ? t('publicProvider.savedService.removeError')
        : t('publicProvider.savedService.saveError')));
      setAuthenticated(true);
      setSaved((current) => !current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('publicProvider.savedService.updateError'));
    } finally {
      setBusy(false);
    }
  };

  return <div style={{ display: 'grid', gap: '.45rem' }}>
    <Button type="button" variant={saved ? 'secondary' : 'quiet'} loading={busy} aria-pressed={saved} onClick={() => void toggle()}>
      {saved ? t('publicProvider.savedService.saved') : t('publicProvider.savedService.save')}
    </Button>
    {error ? <span className="field-error" role="alert">{error}</span> : null}
  </div>;
}
