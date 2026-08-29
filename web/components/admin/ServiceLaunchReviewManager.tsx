'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';

type LaunchReview = { id: string; applicant_user_id: string; service_id: string; service_name: string; provider_type: string; provider_name: string; application_id: string; application_name: string; category_id: string; category_name: string; location_id: string; location_name: string; status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn'; review_note?: string | null; reviewed_at?: string | null; created_at: string };

function tone(status: LaunchReview['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending' || status === 'changes_requested') return 'warning' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'neutral' as const;
}

export default function ServiceLaunchReviewManager() {
  const [items, setItems] = useState<LaunchReview[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/super-admin/service-launches', { cache: 'no-store' });
      const body = await response.json() as { requests?: LaunchReview[]; error?: string };
      if (!response.ok || !body.requests) throw new Error(body.error ?? 'Unable to load service launch reviews.');
      setItems(body.requests);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load service launch reviews.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const review = async (item: LaunchReview, decision: 'approve' | 'changes_requested' | 'reject') => {
    if (busyId) return;
    const note = (notes[item.id] ?? '').trim();
    if (decision !== 'approve' && note.length < 3) { setError('A clear reason is required for changes or rejection.'); return; }
    setBusyId(item.id); setError('');
    try {
      const response = await fetch('/api/super-admin/service-launches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: item.id, decision, note }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Service launch review failed.');
      setNotes((current) => ({ ...current, [item.id]: '' }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Service launch review failed.'); }
    finally { setBusyId(null); }
  };

  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const visible = useMemo(() => filter === 'pending' ? items.filter((item) => item.status === 'pending') : items, [items, filter]);

  return <div className="section-stack">
    <div className="dashboard-grid"><Card><span className="eyebrow">Pending launch reviews</span><h2>{pendingCount}</h2></Card><Card><span className="eyebrow">Launch request history</span><h2>{items.length}</h2></Card></div>
    <div className="button-row"><Button type="button" variant={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setFilter('pending')}>Pending ({pendingCount})</Button><Button type="button" variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>All ({items.length})</Button></div>
    {error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Reload</Button></Card> : null}
    {loading ? <Card><p>Loading service launch reviews…</p></Card> : null}
    {!loading && !visible.length ? <Card><EmptyState title={filter === 'pending' ? 'No service launches waiting' : 'No launch request history'}>Provider category/location launch requests will appear here.</EmptyState></Card> : null}
    {visible.map((item) => <Card key={item.id}>
      <div className="section-heading"><div><span className="eyebrow">{item.provider_type} · {item.provider_name}</span><h2>{item.service_name}</h2></div><Badge tone={tone(item.status)}>{item.status.replaceAll('_',' ')}</Badge></div>
      <dl className="review-details"><div><dt>Application</dt><dd>{item.application_name}</dd></div><div><dt>Category</dt><dd>{item.category_name}</dd></div><div><dt>Location</dt><dd>{item.location_name}</dd></div><div><dt>Requested</dt><dd>{new Date(item.created_at).toLocaleString('en-IN')}</dd></div></dl>
      {item.review_note ? <div style={{ marginTop: '1rem' }}><strong>Review note</strong><p>{item.review_note}</p></div> : null}
      {item.status === 'pending' ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
        <label className="field"><span className="field-label">Reviewer note</span><textarea className="field-control" rows={3} maxLength={1200} value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional for approval; required for changes/rejection" /></label>
        <div className="button-row"><Button type="button" disabled={busyId === item.id} onClick={() => void review(item,'approve')}>Approve scope</Button><Button type="button" variant="secondary" disabled={busyId === item.id} onClick={() => void review(item,'changes_requested')}>Request changes</Button><Button type="button" variant="quiet" disabled={busyId === item.id} onClick={() => void review(item,'reject')}>Reject</Button></div>
        <p className="summary-note">Approval maps the service to this application/category/location. The provider still controls final activation after all launch gates pass.</p>
      </div> : null}
    </Card>)}
  </div>;
}
