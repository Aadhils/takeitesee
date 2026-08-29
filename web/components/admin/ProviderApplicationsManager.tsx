'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';

type Application = {
  id: string;
  applicant_user_id: string;
  provider_type: 'professional' | 'business';
  display_name: string;
  description?: string | null;
  location: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  result_provider_id?: string | null;
  created_at: string;
  updated_at: string;
};

function tone(status: Application['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'neutral' as const;
}

function moment(value: string) {
  try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
}

export default function ProviderApplicationsManager() {
  const [items, setItems] = useState<Application[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/super-admin/provider-applications', { cache: 'no-store' });
      const body = await response.json() as { applications?: Application[]; error?: string };
      if (!response.ok || !body.applications) throw new Error(body.error ?? 'Unable to load provider applications.');
      setItems(body.applications);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load provider applications.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (application: Application, decision: 'approve' | 'reject') => {
    if (busyId) return;
    const note = (notes[application.id] ?? '').trim();
    if (decision === 'reject' && note.length < 3) {
      setError('Enter a clear rejection reason before rejecting an application.');
      return;
    }
    setBusyId(application.id);
    setError('');
    try {
      const response = await fetch('/api/super-admin/provider-applications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: application.id, decision, note }),
      });
      const body = await response.json() as { application?: Application; error?: string };
      if (!response.ok || !body.application) throw new Error(body.error ?? 'Application review failed.');
      setItems((current) => current.map((item) => item.id === application.id ? body.application! : item));
      setNotes((current) => ({ ...current, [application.id]: '' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Application review failed.');
    } finally { setBusyId(null); }
  };

  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const visible = useMemo(() => filter === 'pending' ? items.filter((item) => item.status === 'pending') : items, [items, filter]);

  return <div className="section-stack">
    <div className="dashboard-grid">
      <Card><span className="eyebrow">Pending review</span><h2>{pendingCount}</h2><p>Applications waiting for a platform decision.</p></Card>
      <Card><span className="eyebrow">All applications</span><h2>{items.length}</h2><p>Full provider onboarding history visible to the platform control plane.</p></Card>
    </div>

    <div className="button-row" aria-label="Application filters">
      <Button type="button" variant={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setFilter('pending')}>Pending ({pendingCount})</Button>
      <Button type="button" variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>All ({items.length})</Button>
    </div>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Reload queue</Button></Card> : null}
    {loading ? <Card><p>Loading provider applications…</p></Card> : null}

    {!loading && !visible.length ? <Card><EmptyState title={filter === 'pending' ? 'No applications waiting' : 'No provider applications'}>{filter === 'pending' ? 'New provider applications will appear here for platform review.' : 'Provider onboarding history will appear here after the first application.'}</EmptyState></Card> : null}

    {visible.map((application) => <Card key={application.id}>
      <div className="section-heading">
        <div><span className="eyebrow">{application.provider_type === 'business' ? 'Business application' : 'Professional application'}</span><h2>{application.display_name}</h2></div>
        <Badge tone={tone(application.status)}>{application.status}</Badge>
      </div>
      <dl className="review-details">
        <div><dt>Service area</dt><dd>{application.location}</dd></div>
        <div><dt>Applicant</dt><dd>{application.applicant_user_id.slice(0, 8)}…</dd></div>
        <div><dt>Submitted</dt><dd>{moment(application.created_at)}</dd></div>
        <div><dt>Provider type</dt><dd>{application.provider_type}</dd></div>
      </dl>
      {application.description ? <div style={{ marginTop: '1rem' }}><strong>About planned services</strong><p>{application.description}</p></div> : null}
      {application.review_note ? <div style={{ marginTop: '1rem' }}><strong>Platform review note</strong><p>{application.review_note}</p></div> : null}
      {application.status === 'pending' ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
        <label className="field"><span className="field-label">Review note</span><textarea className="field-control" rows={3} maxLength={1000} value={notes[application.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Optional for approval; required for rejection" /></label>
        <div className="button-row"><Button type="button" disabled={busyId === application.id} onClick={() => void review(application, 'approve')}>{busyId === application.id ? 'Updating…' : 'Approve provider'}</Button><Button type="button" variant="quiet" disabled={busyId === application.id} onClick={() => void review(application, 'reject')}>Reject with reason</Button></div>
        <p className="summary-note">Approval activates provider ownership and workspace access. It does not mark the provider verified.</p>
      </div> : null}
    </Card>)}
  </div>;
}
