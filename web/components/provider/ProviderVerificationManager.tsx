'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type Provider = { id: string; provider_type: 'professional' | 'business'; display_name: string; verified: boolean };
type RequestRecord = {
  id: string; legal_name: string; contact_phone: string; address: string; evidence_type: string; evidence_reference: string;
  evidence_note?: string | null; status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn';
  review_note?: string | null; reviewed_at?: string | null; created_at: string;
};

type Payload = { provider: Provider; requests: RequestRecord[]; error?: string };

function tone(status: RequestRecord['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending' || status === 'changes_requested') return 'warning' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'neutral' as const;
}

export default function ProviderVerificationManager() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [form, setForm] = useState({ legal_name: '', contact_phone: '', address: '', evidence_type: 'government_id', evidence_reference: '', evidence_note: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/provider/verification', { cache: 'no-store' });
      const body = await response.json() as Payload;
      if (!response.ok || !body.provider) throw new Error(body.error ?? 'Unable to load verification status.');
      setPayload(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load verification status.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/provider/verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { request?: RequestRecord; error?: string };
      if (!response.ok || !body.request) throw new Error(body.error ?? 'Verification request could not be submitted.');
      setForm({ legal_name: '', contact_phone: '', address: '', evidence_type: 'government_id', evidence_reference: '', evidence_note: '' });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification request could not be submitted.'); }
    finally { setBusy(false); }
  };

  const withdraw = async (id: string) => {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/provider/verification', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: id, action: 'withdraw' }) });
      const body = await response.json() as { request?: RequestRecord; error?: string };
      if (!response.ok || !body.request) throw new Error(body.error ?? 'Verification request could not be withdrawn.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification request could not be withdrawn.'); }
    finally { setBusy(false); }
  };

  const pending = payload?.requests.find((item) => item.status === 'pending') ?? null;
  const latest = payload?.requests[0] ?? null;

  return <LiveProviderShell active="/provider/verification">
    <ProviderHeading eyebrow="Trust & publishing" title="Provider verification" description="Verification protects customers and controls when your services can be published to the public marketplace." />
    {loading ? <Card><p>Loading verification status…</p></Card> : null}
    {error ? <Alert title="Verification needs attention" tone="warning">{error}</Alert> : null}

    {payload?.provider ? <Card>
      <div className="section-heading"><div><span className="eyebrow">Provider identity</span><h2>{payload.provider.display_name}</h2></div><Badge tone={payload.provider.verified ? 'success' : 'warning'}>{payload.provider.verified ? 'Verified' : 'Not verified'}</Badge></div>
      <p>{payload.provider.provider_type === 'business' ? 'Business provider' : 'Professional provider'}</p>
      <p className="summary-note">{payload.provider.verified ? 'Publishing is enabled. Active services can appear in public discovery.' : 'You can create drafts, but service publishing is locked until verification is approved.'}</p>
    </Card> : null}

    {payload?.provider.verified ? <Alert title="Verification approved" tone="success">Your provider identity is verified. Keep your profile details accurate; platform review can pause verification if trust information materially changes.</Alert> : pending ? <Card>
      <div className="section-heading"><div><span className="eyebrow">Current request</span><h2>{pending.legal_name}</h2></div><Badge tone="warning">Pending review</Badge></div>
      <dl className="review-details"><div><dt>Evidence type</dt><dd>{pending.evidence_type.replaceAll('_',' ')}</dd></div><div><dt>Reference</dt><dd>{pending.evidence_reference}</dd></div><div><dt>Contact</dt><dd>{pending.contact_phone}</dd></div><div><dt>Address</dt><dd>{pending.address}</dd></div></dl>
      <p className="summary-note">Verification information is private to your account and authorized platform reviewers.</p>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void withdraw(pending.id)}>{busy ? 'Updating…' : 'Withdraw verification request'}</Button>
    </Card> : <>
      {latest ? <Card>
        <div className="section-heading"><div><span className="eyebrow">Previous review</span><h2>Verification {latest.status.replaceAll('_',' ')}</h2></div><Badge tone={tone(latest.status)}>{latest.status.replaceAll('_',' ')}</Badge></div>
        {latest.review_note ? <p><strong>Platform note:</strong> {latest.review_note}</p> : null}
        <p className="summary-note">{latest.status === 'changes_requested' ? 'Update the requested information and submit a new verification request.' : 'You may submit a new request with current evidence.'}</p>
      </Card> : null}
      <Card>
        <h2>Submit verification details</h2>
        <p className="summary-note">Provide a reviewable reference only. Do not enter passwords, PINs, OTPs, or banking credentials.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
          <Input label="Legal name" required maxLength={160} value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} />
          <Input label="Contact phone" required maxLength={40} value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} />
          <Input label="Registered / service address" required maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          <Select label="Evidence type" value={form.evidence_type} onChange={(event) => setForm({ ...form, evidence_type: event.target.value })}><option value="government_id">Government ID reference</option><option value="business_registration">Business registration</option><option value="professional_license">Professional license</option><option value="other">Other reviewable evidence</option></Select>
          <Input label="Evidence reference" required maxLength={120} hint="Reference or registration number used by the reviewer. Never enter passwords or OTPs." value={form.evidence_reference} onChange={(event) => setForm({ ...form, evidence_reference: event.target.value })} />
          <label className="field"><span className="field-label">Evidence note (optional)</span><textarea className="field-control" rows={4} maxLength={1200} value={form.evidence_note} onChange={(event) => setForm({ ...form, evidence_note: event.target.value })} placeholder="Explain how the platform reviewer can validate the reference" /></label>
          <Button type="submit" loading={busy}>Submit verification request</Button>
        </form>
      </Card>
    </>}
  </LiveProviderShell>;
}
