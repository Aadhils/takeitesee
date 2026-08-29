'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

type Provider = { id: string; provider_type: 'professional' | 'business'; display_name: string; verified: boolean };
type RequestRecord = {
  id: string; legal_name: string; contact_phone: string; address: string; evidence_type: string; evidence_reference: string;
  evidence_note?: string | null; status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn' | 'revoked';
  review_note?: string | null; reviewed_at?: string | null; created_at: string;
};
type VerificationDocument = { id: string; verification_request_id: string; original_filename: string; mime_type: string; size_bytes: number; status: 'active' | 'deleted'; created_at: string; deleted_at?: string | null };
type Payload = { provider: Provider; requests: RequestRecord[]; documents: VerificationDocument[]; error?: string };

const bucket = 'provider-verification-documents';
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 8 * 1024 * 1024;

function tone(status: RequestRecord['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending' || status === 'changes_requested') return 'warning' as const;
  if (status === 'rejected' || status === 'revoked') return 'danger' as const;
  return 'neutral' as const;
}
function sizeLabel(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function extensionFor(file: File) {
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  if (ext) return ext;
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export default function ProviderVerificationManager() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [form, setForm] = useState({ legal_name: '', contact_phone: '', address: '', evidence_type: 'government_id', evidence_reference: '', evidence_note: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const pending = payload?.requests.find((item) => item.status === 'pending') ?? null;
  const latest = payload?.requests[0] ?? null;
  const pendingDocuments = useMemo(() => pending ? (payload?.documents ?? []).filter((doc) => doc.verification_request_id === pending.id && doc.status === 'active') : [], [payload, pending]);

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

  const uploadDocument = async (file: File) => {
    if (!pending || uploading) return;
    if (!allowedTypes.has(file.type)) { setError('Upload a PDF, JPEG, PNG, or WebP document.'); return; }
    if (file.size <= 0 || file.size > maxBytes) { setError('Verification document must be 8 MB or smaller.'); return; }
    setUploading(true); setError('');
    const supabase = createSupabaseBrowserClient();
    let objectPath = '';
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error(authError?.message ?? 'Authentication required.');
      objectPath = `${authData.user.id}/${pending.id}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const response = await fetch('/api/provider/verification/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: pending.id, object_path: objectPath, original_filename: file.name }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        await supabase.storage.from(bucket).remove([objectPath]);
        throw new Error(body.error ?? 'Verification document could not be registered.');
      }
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (cause) {
      if (objectPath) await supabase.storage.from(bucket).remove([objectPath]);
      setError(cause instanceof Error ? cause.message : 'Verification document could not be uploaded.');
    } finally { setUploading(false); }
  };

  const removeDocument = async (documentId: string) => {
    if (removingId) return;
    setRemovingId(documentId); setError('');
    try {
      const response = await fetch('/api/provider/verification/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: documentId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Verification document could not be removed.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification document could not be removed.'); }
    finally { setRemovingId(null); }
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

  return <LiveProviderShell active="/provider/verification">
    <ProviderHeading eyebrow="Trust & publishing" title="Provider verification" description="Submit private verification evidence. Documents are stored in a non-public bucket and can be opened only by your account or authorized platform reviewers." />
    {loading ? <Card><p>Loading verification status…</p></Card> : null}
    {error ? <Alert title="Verification needs attention" tone="warning">{error}</Alert> : null}

    {payload?.provider ? <Card>
      <div className="section-heading"><div><span className="eyebrow">Provider identity</span><h2>{payload.provider.display_name}</h2></div><Badge tone={payload.provider.verified ? 'success' : 'warning'}>{payload.provider.verified ? 'Verified' : 'Not verified'}</Badge></div>
      <p>{payload.provider.provider_type === 'business' ? 'Business provider' : 'Professional provider'}</p>
      <p className="summary-note">{payload.provider.verified ? 'Verification is approved. Launch-ready services can be activated.' : 'Service activation remains locked until verification and the other launch-readiness gates are complete.'}</p>
    </Card> : null}

    {payload?.provider.verified ? <Alert title="Verification approved" tone="success">Your provider identity is verified. Private evidence remains protected from public access.</Alert> : pending ? <Card>
      <div className="section-heading"><div><span className="eyebrow">Current request</span><h2>{pending.legal_name}</h2></div><Badge tone="warning">Pending review</Badge></div>
      <dl className="review-details"><div><dt>Evidence type</dt><dd>{pending.evidence_type.replaceAll('_',' ')}</dd></div><div><dt>Reference</dt><dd>{pending.evidence_reference}</dd></div><div><dt>Contact</dt><dd>{pending.contact_phone}</dd></div><div><dt>Address</dt><dd>{pending.address}</dd></div></dl>

      <div className="section-stack" style={{ marginTop: '1rem' }}>
        <div><strong>Private verification documents</strong><p className="summary-note">At least one document is required before approval. PDF, JPEG, PNG, or WebP; maximum 8 MB each. Never upload passwords, PINs, OTPs, payment card details, or unrelated records.</p></div>
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(file); }} />
        {uploading ? <p>Encrypting and uploading private evidence…</p> : null}
        {pendingDocuments.length ? <div className="section-stack">{pendingDocuments.map((doc) => <div className="card" key={doc.id} style={{ padding: '1rem' }}><div className="section-heading"><div><strong>{doc.original_filename}</strong><p className="summary-note">{doc.mime_type} · {sizeLabel(Number(doc.size_bytes))}</p></div><Badge tone="success">Private</Badge></div><Button type="button" variant="quiet" loading={removingId === doc.id} onClick={() => void removeDocument(doc.id)}>Remove document</Button></div>)}</div> : <Alert title="Document required" tone="warning">Upload at least one private evidence file so the platform reviewer can approve this request.</Alert>}
      </div>

      <p className="summary-note">Verification details and documents are not public. Reviewer access uses short-lived secure links and is audit logged.</p>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void withdraw(pending.id)}>{busy ? 'Updating…' : 'Withdraw verification request'}</Button>
    </Card> : <>
      {latest ? <Card>
        <div className="section-heading"><div><span className="eyebrow">Previous review</span><h2>Verification {latest.status.replaceAll('_',' ')}</h2></div><Badge tone={tone(latest.status)}>{latest.status.replaceAll('_',' ')}</Badge></div>
        {latest.review_note ? <p><strong>Platform note:</strong> {latest.review_note}</p> : null}
        <p className="summary-note">{latest.status === 'changes_requested' ? 'Submit a fresh request, then upload the corrected private evidence.' : 'You may submit a new request with current evidence.'}</p>
      </Card> : null}
      <Card>
        <h2>Start verification</h2>
        <p className="summary-note">First submit the verification details. The next step will securely upload one or more private supporting documents.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
          <Input label="Legal name" required maxLength={160} value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} />
          <Input label="Contact phone" required maxLength={40} value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} />
          <Input label="Registered / service address" required maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          <Select label="Evidence type" value={form.evidence_type} onChange={(event) => setForm({ ...form, evidence_type: event.target.value })}><option value="government_id">Government-issued identity evidence</option><option value="business_registration">Business registration</option><option value="professional_license">Professional license</option><option value="other">Other reviewable evidence</option></Select>
          <Input label="Evidence reference" required maxLength={120} hint="Use a registration reference or limited identifier such as last 4 digits where appropriate. Do not enter passwords, PINs, or OTPs." value={form.evidence_reference} onChange={(event) => setForm({ ...form, evidence_reference: event.target.value })} />
          <label className="field"><span className="field-label">Evidence note (optional)</span><textarea className="field-control" rows={4} maxLength={1200} value={form.evidence_note} onChange={(event) => setForm({ ...form, evidence_note: event.target.value })} placeholder="Explain what the reviewer should validate" /></label>
          <Button type="submit" loading={busy}>Create verification request</Button>
        </form>
      </Card>
    </>}
  </LiveProviderShell>;
}
