'use client';

import { useEffect, useState } from 'react';
import { Badge, Button } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProviderType = 'professional' | 'business';
type ProviderReadiness = {
  provider_type: ProviderType;
  provider_id: string;
  display_name: string;
  profile_complete: boolean;
  verified: boolean;
  trust_status: 'normal' | 'reverification_required' | 'suspended';
  trust_reason?: string | null;
  first_service_created: boolean;
  first_service_scoped: boolean;
  marketplace_live: boolean;
  services_total: number;
  services_scoped: number;
  services_active: number;
  pending_launch_requests: number;
  progress_percent: number;
  next_action: { id: string; label: string; href: string };
};

type Payload = { providers?: ProviderReadiness[]; error?: string };

export function ProviderReadinessSummary({ placement = 'account' }: { placement?: 'account' | 'provider' }) {
  const { t } = useIdentityWorkspaceTranslations();
  const [providers, setProviders] = useState<ProviderReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<ProviderType | null>(null);

  const providerLabel = (type: ProviderType) => type === 'professional' ? t('profile.professional') : t('profile.business');
  const trustStatusLabel = (status: ProviderReadiness['trust_status']) =>
    status === 'reverification_required'
      ? t('provider.readinessSummary.trustReverificationRequired')
      : t('provider.readinessSummary.trustSuspended');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/account/provider-readiness', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as Payload;
        if (!response.ok) throw new Error(payload.error || t('provider.readinessSummary.unableLoad'));
        return payload;
      })
      .then((payload) => {
        if (!cancelled) setProviders(payload.providers ?? []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t('provider.readinessSummary.unableLoad'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t]);

  async function openNext(provider: ProviderReadiness) {
    if (opening) return;
    setOpening(provider.provider_type);
    setError('');
    try {
      if (placement === 'provider') {
        window.location.assign(provider.next_action.href);
        return;
      }
      const response = await fetch('/api/account/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: provider.provider_type }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('provider.readinessSummary.unableOpen'));
      window.location.assign(provider.next_action.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.readinessSummary.unableOpen'));
      setOpening(null);
    }
  }

  if (loading || (!providers.length && !error)) return null;

  return <section className="account-readiness" style={placement === 'provider' ? { margin: '-1px 0 0', position: 'relative', zIndex: 3 } : undefined} aria-label={t('provider.readinessSummary.setupStatus')}>
    {error ? <p className="field-error account-readiness-error" role="alert">{error}</p> : null}
    {providers.map((provider) => <div className="account-readiness-card" key={provider.provider_type}>
      <div className="account-readiness-main">
        <div className="account-readiness-copy">
          <div className="account-readiness-kicker">
            <span className="eyebrow">{t('provider.readinessSummary.setupLabel').replace('{label}', providerLabel(provider.provider_type))}</span>
            <Badge tone={provider.marketplace_live ? 'success' : provider.trust_status === 'suspended' ? 'danger' : 'warning'}>
              {provider.marketplace_live ? t('provider.readinessSummary.live') : provider.trust_status === 'suspended' ? t('provider.readinessSummary.suspended') : `${provider.progress_percent}%`}
            </Badge>
          </div>
          <strong className="account-readiness-name">{provider.display_name}</strong>
          <p className="account-readiness-next">{provider.marketplace_live
            ? t('provider.readinessSummary.liveBody')
            : provider.next_action.label}</p>
        </div>
        <Button type="button" className="account-readiness-cta" loading={opening === provider.provider_type} disabled={opening !== null && opening !== provider.provider_type} onClick={() => void openNext(provider)}>
          {provider.marketplace_live ? t('provider.readinessSummary.review') : t('provider.readinessSummary.continue')}
        </Button>
      </div>
      <div className="account-readiness-progress" aria-label={t('provider.readinessSummary.progressReady').replace('{percent}', String(provider.progress_percent))}>
        <span style={{ width: `${provider.progress_percent}%` }} />
      </div>
      {provider.trust_status !== 'normal' ? <p className="account-readiness-trust"><strong>{t('provider.readinessSummary.trustState')}:</strong> {trustStatusLabel(provider.trust_status)}{provider.trust_reason ? ` · ${provider.trust_reason}` : ''}</p> : null}
    </div>)}
  </section>;
}
