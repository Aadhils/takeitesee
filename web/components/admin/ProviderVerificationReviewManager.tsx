'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';

type VerificationStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn' | 'revoked';
type ReviewDecision = 'approve' | 'changes_requested' | 'reject' | 'revoke';
type RequestRecord = {
  id: string; applicant_user_id: string; provider_type: 'professional' | 'business'; professional_id?: string | null; business_id?: string | null;
  legal_name: string; contact_phone: string; address: string; evidence_type: string; evidence_reference: string; evidence_note?: string | null;
  status: VerificationStatus; review_note?: string | null; reviewed_at?: string | null; created_at: string;
};

function tone(status: VerificationStatus) {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending' || status === 'changes_requested') return 'warning' as const;
  if (status === 'rejected' || status === 'revoked') return 'danger' as const;
  return 'neutral' as const;
}

export default function ProviderVerificationReviewManager() {
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/super-admin/provider-verifications', { cache: 'no-store' });
      const body = await response.json() as { requests?: RequestRecord[]; error?: string };
      if (!response.ok || !body.requests) throw new Error(body.error ?? 'Unable to load verification queue.');
      setItems(body.requests);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load verification queue.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const review = async (item: RequestRecord, decision: ReviewDecision) => {
    if (busyId) return;
    const note = (notes[item.id] ?? '').trim();
    if (decision !== 'approve' && note.length < 3) { setError('A clear review reason is required for changes, rejection, or revocation.'); return; }
    setBusyId(item.id); setError('');
    try {
      const response = await fetch('/api/super-admin/provider-verifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: item.id, decision, note }) });
      const body = await response.json() as { request?: RequestRecord; error?: string };
      if (!response.ok || !body.request) throw new Error(body.error ?? 'Verification review failed.');
      setItems((current) => current.map((row) => row.id === item.id ? body.request! : row));
      setNotes((current) => ({ ...current, [item.id]: '' }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification review failed.'); }
    finally { setBusyId(null); }
  };

  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const visible = useMemo(() => filter === 'pending' ? items.filter((item) => item.status === 'pending') : items, [items, filter]);

  return <div className="section-stack">
    <div className="dashboard-grid"><Card><span className="eyebrow">Pending KYC review</span><h2>{pendingCount}</h2></Card><Card><span className="eyebrow">Verification history</span><h2>{items.length}</h2></Card></div>
    <div className="button-row"><Button type="button" variant={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setFilter('pending')}>Pending ({pendingCount})</Button><Button type="button" variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>All ({items.length})</Button></div>
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Reload</Button></Card> : null}
    {loading ? <Card><p>Loading provider verification requests…</p></Card> : null}
    {!loading && !visible.length ? <Card><EmptyState title={filter === 'pending' ? 'No verification reviews waiting' : 'No verification history'}>Provider verification requests will appear here.</EmptyState></Card> : null}
    {visible.map((item) => <Card key={item.id}>
      <div className="section-heading"><div><span className="eyebrow">{item.provider_type} verification</span><h2>{item.legal_name}</h2></div><Badge tone={tone(item.status)}>{item.status.replaceAll('_',' ')}</Badge></div>
      <dl className="review-details"><div><dt>Contact</dt><dd>{item.contact_phone}</dd></div><div><dt>Address</dt><dd>{item.address}</dd></div><div><dt>Evidence type</dt><dd>{item.evidence_type.replaceAll('_',' ')}</dd></div><div><dt>Evidence reference</dt><dd>{item.evidence_reference}</dd></div></dl>
      {item.evidence_note ? <div style={{ marginTop: '1rem' }}><strong>Provider evidence note</strong><p>{item.evidence_note}</p></div> : null}
      {item.review_note ? <div style={{ marginTop: '1rem' }}><strong>Review note</strong><p>{item.review_note}</p></div> : null}
      {item.status === 'pending' || item.status === 'approved' ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
        <label className="field"><span className="field-label">Reviewer note</span><textarea className="field-control" rows={3} maxLength={1200} value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={item.status === 'approved' ? 'Reason required to revoke verification' : 'Optional for approval; required for changes/rejection'} /></label>
        {item.status === 'pending' ? <div className="button-row"><Button type="button" disabled={busyId === item.id} onClick={() => void review(item,'approve')}>Approve verification</Button><Button type="button" variant="secondary" disabled={busyId === item.id} onClick={() => void review(item,'changes_requested')}>Request changes</Button><Button type="button" variant="quiet" disabled={busyId === item.id} onClick={() => void review(item,'reject')}>Reject</Button></div> : <Button type="button" variant="danger" disabled={busyId === item.id} onClick={() => void review(item,'revoke')}>Revoke verification & pause services</Button>}
        <p className="summary-note">{item.status === 'approved' ? 'Revocation removes verified publishing eligibility and pauses this provider’s active services.' : 'Approval enables service publishing. It does not automatically activate any draft service.'}</p>
      </div> : null}
    </Card>)}
  </div>;
}
