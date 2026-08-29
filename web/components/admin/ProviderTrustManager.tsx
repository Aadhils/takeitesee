'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Input } from '../ui/primitives';

type TrustStatus = 'normal' | 'reverification_required' | 'suspended';
type ProviderTrust = {
  trust_state_id: string;
  provider_type: 'professional' | 'business';
  provider_id: string;
  owner_user_id: string;
  display_name: string;
  verified: boolean;
  status: TrustStatus;
  reason?: string | null;
  active_services: number;
  updated_at: string;
};

type TrustAction = 'require_reverification' | 'suspend' | 'restore';

function tone(status: TrustStatus) {
  if (status === 'normal') return 'success' as const;
  if (status === 'reverification_required') return 'warning' as const;
  return 'danger' as const;
}

export default function ProviderTrustManager() {
  const [items, setItems] = useState<ProviderTrust[]>([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState<Record<string,string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/super-admin/provider-trust', { cache: 'no-store' });
      const body = await response.json() as { providers?: ProviderTrust[]; error?: string };
      if (!response.ok || !body.providers) throw new Error(body.error ?? 'Unable to load provider trust state.');
      setItems(body.providers);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load provider trust state.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (item: ProviderTrust, action: TrustAction) => {
    if (busyId) return;
    const actionReason = (reason[item.trust_state_id] ?? '').trim();
    if (actionReason.length < 3) { setError('Enter a clear reason before changing provider trust state.'); return; }
    setBusyId(item.trust_state_id); setError('');
    try {
      const response = await fetch('/api/super-admin/provider-trust', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_type: item.provider_type, provider_id: item.provider_id, action, reason: actionReason }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Provider trust action failed.');
      setReason((current) => ({ ...current, [item.trust_state_id]: '' }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Provider trust action failed.'); }
    finally { setBusyId(null); }
  };

  const counts = useMemo(() => ({
    normal: items.filter((item) => item.status === 'normal').length,
    review: items.filter((item) => item.status === 'reverification_required').length,
    suspended: items.filter((item) => item.status === 'suspended').length,
  }), [items]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => `${item.display_name} ${item.provider_type} ${item.status}`.toLowerCase().includes(query));
  }, [items, search]);

  return <div className="section-stack">
    <div className="dashboard-grid">
      <Card><span className="eyebrow">Normal</span><h2>{counts.normal}</h2></Card>
      <Card><span className="eyebrow">Re-verification</span><h2>{counts.review}</h2></Card>
      <Card><span className="eyebrow">Suspended</span><h2>{counts.suspended}</h2></Card>
    </div>
    <div style={{ maxWidth: 420 }}><Input label="Find provider" placeholder="Name, type, or status" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Reload</Button></Card> : null}
    {loading ? <Card><p>Loading provider trust state…</p></Card> : null}
    {!loading && !visible.length ? <Card><EmptyState title="No providers found">Provider trust records will appear here after provider approval.</EmptyState></Card> : null}

    {visible.map((item) => <Card key={item.trust_state_id}>
      <div className="section-heading">
        <div><span className="eyebrow">{item.provider_type}</span><h2>{item.display_name}</h2></div>
        <Badge tone={tone(item.status)}>{item.status.replaceAll('_',' ')}</Badge>
      </div>
      <div className="admin-provider-meta">
        <span><strong>{item.verified ? 'Verified' : 'Not verified'}</strong> identity</span>
        <span><strong>{item.active_services}</strong> active services</span>
        <span><strong>{new Date(item.updated_at).toLocaleDateString('en-IN')}</strong> last trust update</span>
      </div>
      {item.reason ? <p><strong>Current trust note:</strong> {item.reason}</p> : null}
      <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
        <label className="field"><span className="field-label">Trust action reason</span><textarea className="field-control" rows={3} maxLength={1200} value={reason[item.trust_state_id] ?? ''} onChange={(event) => setReason((current) => ({ ...current, [item.trust_state_id]: event.target.value }))} placeholder="Required for every trust-state change" /></label>
        <div className="button-row">
          {item.status === 'normal' ? <Button type="button" variant="secondary" disabled={busyId === item.trust_state_id} onClick={() => void act(item,'require_reverification')}>Require re-verification</Button> : null}
          {item.status !== 'suspended' ? <Button type="button" variant="danger" disabled={busyId === item.trust_state_id} onClick={() => void act(item,'suspend')}>Suspend provider</Button> : null}
          {item.status !== 'normal' ? <Button type="button" disabled={busyId === item.trust_state_id} onClick={() => void act(item,'restore')}>Restore trust state</Button> : null}
        </div>
        <p className="summary-note">Suspension and re-verification pause active services but preserve existing bookings, history, support, and closeout. Restore never auto-reactivates services.</p>
      </div>
    </Card>)}
  </div>;
}
