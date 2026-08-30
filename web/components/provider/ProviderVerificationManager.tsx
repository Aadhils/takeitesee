'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

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
  const { t, locale } = useRemainingWorkspaceTranslations();
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

  const statusLabel = (status: RequestRecord['status']) => locale === 'ta-IN' ? ({ pending: 'நிலுவையில்', approved: 'அங்கீகரிக்கப்பட்டது', changes_requested: 'மாற்றங்கள் கோரப்பட்டன', rejected: 'நிராகரிக்கப்பட்டது', withdrawn: 'திரும்பப் பெறப்பட்டது', revoked: 'ரத்து செய்யப்பட்டது' }[status]) : status.replaceAll('_', ' ');
  const evidenceLabel = (value: string) => locale === 'ta-IN' ? ({ government_id: 'அரசு வழங்கிய அடையாள ஆதாரம்', business_registration: 'வணிக பதிவு', professional_license: 'தொழில்முறை உரிமம்', other: 'மற்ற சரிபார்க்கக்கூடிய ஆதாரம்' }[value] ?? value.replaceAll('_', ' ')) : value.replaceAll('_', ' ');

  return <LiveProviderShell active="/provider/verification">
    <ProviderHeading eyebrow={t('verification.eyebrow')} title={t('verification.title')} description={t('verification.intro')} />
    {loading ? <Card><p>{t('verification.loading')}</p></Card> : null}
    {error ? <Alert title={t('verification.attention')} tone="warning">{error}</Alert> : null}

    {payload?.provider ? <Card>
      <div className="section-heading"><div><span className="eyebrow">{t('verification.providerIdentity')}</span><h2>{payload.provider.display_name}</h2></div><Badge tone={payload.provider.verified ? 'success' : 'warning'}>{payload.provider.verified ? t('common.verified') : t('verification.notVerified')}</Badge></div>
      <p>{payload.provider.provider_type === 'business' ? t('common.business') : t('common.professional')}</p>
      <p className="summary-note">{payload.provider.verified ? t('verification.approvedHelp') : t('verification.lockedHelp')}</p>
    </Card> : null}

    {payload?.provider.verified ? <Alert title={t('verification.approved')} tone="success">{t('verification.privateProtected')}</Alert> : pending ? <Card>
      <div className="section-heading"><div><span className="eyebrow">{t('verification.currentRequest')}</span><h2>{pending.legal_name}</h2></div><Badge tone="warning">{t('verification.pendingReview')}</Badge></div>
      <dl className="review-details"><div><dt>{t('verification.evidenceType')}</dt><dd>{evidenceLabel(pending.evidence_type)}</dd></div><div><dt>{t('verification.reference')}</dt><dd>{pending.evidence_reference}</dd></div><div><dt>{t('verification.contact')}</dt><dd>{pending.contact_phone}</dd></div><div><dt>{t('verification.address')}</dt><dd>{pending.address}</dd></div></dl>

      <div className="section-stack" style={{ marginTop: '1rem' }}>
        <div><strong>{t('verification.privateDocs')}</strong><p className="summary-note">{t('verification.docsHelp')}</p></div>
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(file); }} />
        {uploading ? <p>{t('verification.uploading')}</p> : null}
        {pendingDocuments.length ? <div className="section-stack">{pendingDocuments.map((doc) => <div className="card" key={doc.id} style={{ padding: '1rem' }}><div className="section-heading"><div><strong>{doc.original_filename}</strong><p className="summary-note">{doc.mime_type} · {sizeLabel(Number(doc.size_bytes))}</p></div><Badge tone="success">{t('verification.private')}</Badge></div><Button type="button" variant="quiet" loading={removingId === doc.id} onClick={() => void removeDocument(doc.id)}>{t('verification.removeDocument')}</Button></div>)}</div> : <Alert title={t('verification.documentRequired')} tone="warning">{t('verification.documentRequiredHelp')}</Alert>}
      </div>

      <p className="summary-note">{t('verification.auditHelp')}</p>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void withdraw(pending.id)}>{busy ? t('reason.updating') : t('verification.withdraw')}</Button>
    </Card> : <>
      {latest ? <Card>
        <div className="section-heading"><div><span className="eyebrow">{t('verification.previous')}</span><h2>{t('verification.title')} · {statusLabel(latest.status)}</h2></div><Badge tone={tone(latest.status)}>{statusLabel(latest.status)}</Badge></div>
        {latest.review_note ? <p><strong>{t('verification.platformNote')}</strong> {latest.review_note}</p> : null}
        <p className="summary-note">{latest.status === 'changes_requested' ? t('verification.changesHelp') : t('verification.newHelp')}</p>
      </Card> : null}
      <Card>
        <h2>{t('verification.start')}</h2>
        <p className="summary-note">{t('verification.startHelp')}</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
          <Input label={t('verification.legalName')} required maxLength={160} value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} />
          <Input label={t('verification.contactPhone')} required maxLength={40} value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} />
          <Input label={t('verification.registeredAddress')} required maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          <Select label={t('verification.evidenceType')} value={form.evidence_type} onChange={(event) => setForm({ ...form, evidence_type: event.target.value })}><option value="government_id">{evidenceLabel('government_id')}</option><option value="business_registration">{evidenceLabel('business_registration')}</option><option value="professional_license">{evidenceLabel('professional_license')}</option><option value="other">{evidenceLabel('other')}</option></Select>
          <Input label={t('verification.evidenceReference')} required maxLength={120} hint={t('verification.referenceHint')} value={form.evidence_reference} onChange={(event) => setForm({ ...form, evidence_reference: event.target.value })} />
          <label className="field"><span className="field-label">{t('verification.evidenceNote')}</span><textarea className="field-control" rows={4} maxLength={1200} value={form.evidence_note} onChange={(event) => setForm({ ...form, evidence_note: event.target.value })} placeholder={t('verification.notePlaceholder')} /></label>
          <Button type="submit" loading={busy}>{t('verification.create')}</Button>
        </form>
      </Card>
    </>}
  </LiveProviderShell>;
}
