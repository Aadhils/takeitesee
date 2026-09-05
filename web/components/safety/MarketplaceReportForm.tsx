'use client';

import { FormEvent, useState } from 'react';
import { Alert, Button } from '../ui/primitives';

type TargetType = 'requirement' | 'proposal' | 'conversation' | 'message' | 'portfolio_media' | 'job_posting';
type Category = 'spam' | 'harassment' | 'fraud' | 'unsafe' | 'off_platform' | 'inappropriate' | 'other';

const categories: Array<{ value: Category; label: string }> = [
  { value: 'spam', label: 'Spam or misleading content' },
  { value: 'harassment', label: 'Harassment or abusive behaviour' },
  { value: 'fraud', label: 'Fraud or suspicious request' },
  { value: 'unsafe', label: 'Unsafe or harmful behaviour' },
  { value: 'off_platform', label: 'Pressure to move off Takeitesee' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Other safety concern' },
];

export function MarketplaceReportForm({ targetType, targetId, label = 'Report' }: { targetType: TargetType; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>(targetType === 'portfolio_media' ? 'inappropriate' : 'spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || reference) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, category, details }),
      });
      const payload = await response.json() as { report?: { report_reference?: string }; error?: string };
      if (!response.ok || !payload.report?.report_reference) throw new Error(payload.error || 'Report could not be submitted.');
      setReference(payload.report.report_reference);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  return <div style={{ display: 'grid', gap: '.55rem' }}>
    {!open && !reference ? <Button type="button" variant="quiet" onClick={() => setOpen(true)}>{label}</Button> : null}
    {reference ? <Alert title="Report submitted" tone="success">Reference {reference}. The marketplace safety team can review it without deleting the audit history.</Alert> : null}
    {open && !reference ? <form onSubmit={submit} style={{ display: 'grid', gap: '.6rem', maxWidth: 520 }}>
      <label className="field"><span className="field-label">Safety concern</span><select className="field-control" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <label className="field"><span className="field-label">Details (optional)</span><textarea className="field-control" rows={3} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Add context that helps the moderation team review this safely." /></label>
      {error ? <Alert title="Report not submitted" tone="danger">{error}</Alert> : null}
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}><Button type="submit" variant="danger" loading={busy}>Submit report</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>Cancel</Button></div>
    </form> : null}
  </div>;
}
