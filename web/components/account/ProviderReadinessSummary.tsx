'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
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

function providerLabel(type: ProviderType) {
  return type === 'professional' ? 'Professional' : 'Business';
}

export function ProviderReadinessSummary() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [providers, setProviders] = useState<ProviderReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<ProviderType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/account/provider-readiness', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as Payload;
        if (!response.ok) throw new Error(payload.error || 'Unable to load provider readiness.');
        return payload;
      })
      .then((payload) => {
        if (!cancelled) setProviders(payload.providers ?? []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load provider readiness.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function openNext(provider: ProviderReadiness) {
    if (opening) return;
    setOpening(provider.provider_type);
    setError('');
    try {
      const response = await fetch('/api/account/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: provider.provider_type }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to open provider workspace.');
      window.location.assign(provider.next_action.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open provider workspace.');
      setOpening(null);
    }
  }

  if (loading || (!providers.length && !error)) return null;

  return <section className="section-stack" aria-labelledby="provider-readiness-title">
    <div>
      <span className="eyebrow">{tamil ? 'Provider readiness' : 'Provider readiness'}</span>
      <h2 id="provider-readiness-title">{tamil ? 'உங்கள் provider profiles launch நிலை' : 'Your provider launch readiness'}</h2>
      <p>{tamil ? 'Professional மற்றும் Business profile-களில் எது complete, எது next action தேவை என்று ஒரே இடத்தில் பாருங்கள்.' : 'See which Professional or Business profile is marketplace-ready and what each workspace needs next.'}</p>
    </div>
    {error ? <p className="field-error" role="alert">{error}</p> : null}
    <div className="provider-profile-grid">
      {providers.map((provider) => <Card className="provider-profile-card" key={provider.provider_type}>
        <div className="section-heading">
          <div><span className="eyebrow">{providerLabel(provider.provider_type)}</span><h2>{provider.display_name}</h2></div>
          <Badge tone={provider.marketplace_live ? 'success' : provider.trust_status === 'suspended' ? 'danger' : 'warning'}>
            {provider.marketplace_live ? (tamil ? 'Marketplace live' : 'Marketplace live') : provider.trust_status === 'suspended' ? (tamil ? 'Suspended' : 'Suspended') : (tamil ? 'Setup in progress' : 'Setup in progress')}
          </Badge>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: '#e7eaf0', overflow: 'hidden' }}>
          <div style={{ width: `${provider.progress_percent}%`, height: '100%', background: 'currentColor' }} />
        </div>
        <p><strong>{provider.progress_percent}% {tamil ? 'ready' : 'ready'}</strong> · {provider.next_action.label}</p>
        <p className="summary-note">
          {provider.services_active} {tamil ? 'active service' : 'active service'}{provider.services_active === 1 ? '' : 's'} · {provider.services_scoped} {tamil ? 'scoped' : 'scoped'} · {provider.pending_launch_requests} {tamil ? 'pending launch request' : 'pending launch request'}{provider.pending_launch_requests === 1 ? '' : 's'}
        </p>
        {provider.trust_status !== 'normal' ? <p className="summary-note"><strong>{tamil ? 'Trust state' : 'Trust state'}:</strong> {provider.trust_status.replaceAll('_', ' ')}{provider.trust_reason ? ` · ${provider.trust_reason}` : ''}</p> : null}
        <Button type="button" loading={opening === provider.provider_type} disabled={opening !== null && opening !== provider.provider_type} onClick={() => void openNext(provider)}>
          {provider.marketplace_live ? (tamil ? 'Setup review செய்ய' : 'Review setup') : (tamil ? 'Next step தொடர' : 'Continue next step')}
        </Button>
      </Card>)}
    </div>
  </section>;
}
