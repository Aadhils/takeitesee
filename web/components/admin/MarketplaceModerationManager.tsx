'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';

type Status = 'open' | 'reviewing' | 'actioned' | 'dismissed';
type ReportRow = {
  id: string; report_reference: string; target_type: 'requirement'|'proposal'|'conversation'|'message'; target_id: string;
  category: string; details: string | null; status: Status; admin_note: string | null; created_at: string; updated_at: string; resolved_at: string | null;
  reporter_name: string; reported_user_name: string | null; requirement_id: string; requirement_reference: string; requirement_title: string;
  proposal_reference: string | null; message_excerpt: string | null;
};

function statusTone(status: Status) {
  if (status === 'open') return 'danger' as const;
  if (status === 'reviewing') return 'warning' as const;
  if (status === 'actioned') return 'success' as const;
  return 'neutral' as const;
}

export function MarketplaceModerationManager() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/moderation', { cache: 'no-store' });
      const payload = await response.json() as { reports?: ReportRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Moderation queue could not be loaded.');
      setReports(payload.reports ?? []); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Moderation queue could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const openCount = useMemo(() => reports.filter((row) => row.status === 'open').length, [reports]);

  const update = async (reportId: string, status: Status) => {
    if (busyId) return;
    setBusyId(reportId); setError('');
    try {
      const response = await fetch('/api/admin/moderation', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, status, note: notes[reportId] || '' }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Moderation report could not be updated.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Moderation report could not be updated.'); }
    finally { setBusyId(''); }
  };

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <div className="section-heading"><div><span className="eyebrow">Live safety operations</span><h1>Marketplace moderation</h1><p className="detail-copy">Review scoped reports from requirements, proposals and private messaging. Closing a report records an audit decision; it does not automatically suspend an account.</p></div><Badge tone={openCount ? 'danger' : 'success'}>{openCount} open</Badge></div>
    {error ? <Alert title="Moderation queue unavailable" tone="danger">{error}</Alert> : null}
    {loading ? <Card><p>Loading moderation reports…</p></Card> : null}
    {!loading && reports.length === 0 ? <Card><p className="detail-copy">No marketplace safety reports are waiting for review.</p></Card> : null}
    {!loading ? reports.map((row) => <Card className="policy-card" key={row.id}>
      <div className="section-heading"><div><span className="eyebrow">{row.report_reference} · {row.target_type}</span><h2>{row.requirement_title}</h2><p className="summary-note">{row.requirement_reference}</p></div><Badge tone={statusTone(row.status)}>{row.status}</Badge></div>
      <dl className="review-details"><div><dt>Category</dt><dd>{row.category.replace('_',' ')}</dd></div><div><dt>Reporter</dt><dd>{row.reporter_name}</dd></div><div><dt>Reported user</dt><dd>{row.reported_user_name || 'Not applicable'}</dd></div><div><dt>Opened</dt><dd>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at))}</dd></div>{row.proposal_reference ? <div><dt>Proposal</dt><dd>{row.proposal_reference}</dd></div> : null}</dl>
      {row.details ? <Alert title="Reporter details" tone="info">{row.details}</Alert> : null}
      {row.message_excerpt ? <div style={{ border: '1px solid #e7eaf0', borderRadius: 12, padding: '.8rem', marginTop: '.7rem' }}><strong>Reported message excerpt</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.message_excerpt}</p></div> : null}
      {row.admin_note ? <p className="summary-note"><strong>Latest admin note:</strong> {row.admin_note}</p> : null}
      {row.status === 'open' || row.status === 'reviewing' ? <div style={{ display: 'grid', gap: '.65rem', marginTop: '1rem' }}><label className="field"><span className="field-label">Moderation note</span><textarea className="field-control" rows={3} maxLength={2000} value={notes[row.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Required when actioning or dismissing a report." /></label><div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>{row.status === 'open' ? <Button type="button" variant="secondary" loading={busyId===row.id} onClick={() => void update(row.id,'reviewing')}>Start review</Button> : null}<Button type="button" loading={busyId===row.id} onClick={() => void update(row.id,'actioned')}>Mark actioned</Button><Button type="button" variant="quiet" loading={busyId===row.id} onClick={() => void update(row.id,'dismissed')}>Dismiss report</Button></div></div> : null}
    </Card>) : null}
  </div>;
}
