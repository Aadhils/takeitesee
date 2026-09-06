'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type DisclosureValues = {
  legal_name: string;
  contact_phone: string;
  address: string;
  public_contact_email: string;
  website_url: string;
  grievance_officer_name: string;
  grievance_officer_designation: string;
  grievance_email: string;
  grievance_phone: string;
};
type Provider = {
  id: string;
  provider_type: 'professional' | 'business';
  display_name: string;
  verified: boolean;
  marketplace_disclosure_complete: boolean;
  missing_disclosure_fields: string[];
  disclosure: DisclosureValues;
};
type RequestRecord = {
  id: string; legal_name: string; contact_phone: string; address: string; public_contact_email: string; website_url?: string | null;
  grievance_officer_name: string; grievance_officer_designation: string; grievance_email: string; grievance_phone: string;
  evidence_type: string; evidence_reference: string; evidence_note?: string | null;
  status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn' | 'revoked';
  review_note?: string | null; reviewed_at?: string | null; created_at: string;
};
type VerificationDocument = { id: string; verification_request_id: string; original_filename: string; mime_type: string; size_bytes: number; status: 'active' | 'deleted'; created_at: string; deleted_at?: string | null };
type Payload = { provider: Provider; requests: RequestRecord[]; documents: VerificationDocument[]; error?: string };

const bucket = 'provider-verification-documents';
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 8 * 1024 * 1024;
const emptyForm = {
  legal_name: '', contact_phone: '', address: '', public_contact_email: '', website_url: '',
  grievance_officer_name: '', grievance_officer_designation: 'Grievance Officer', grievance_email: '', grievance_phone: '',
  evidence_type: 'government_id', evidence_reference: '', evidence_note: '',
};

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
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const [payload, setPayload] = useState<Payload | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
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
      const hasPending = body.requests.some((item) => item.status === 'pending');
      if (body.provider.verified && !body.provider.marketplace_disclosure_complete && !hasPending) {
        setForm((current) => ({
          ...current,
          ...body.provider.disclosure,
          grievance_officer_designation: body.provider.disclosure.grievance_officer_designation || 'Grievance Officer',
        }));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load verification status.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pending = payload?.requests.find((item) => item.status === 'pending') ?? null;
  const latest = payload?.requests[0] ?? null;
  const remediation = Boolean(payload?.provider.verified && !payload.provider.marketplace_disclosure_complete);
  const pendingDocuments = useMemo(() => pending ? (payload?.documents ?? []).filter((doc) => doc.verification_request_id === pending.id && doc.status === 'active') : [], [payload, pending]);
  const missingDisclosureLabel = (value: string) => ({
    legal_name: text('Legal name', 'Legal பெயர்'),
    principal_address: text('Principal address', 'முதன்மை முகவரி'),
    public_contact_email: text('Public contact email', 'பொது தொடர்பு மின்னஞ்சல்'),
    public_contact_phone: text('Public contact phone', 'பொது தொடர்பு தொலைபேசி'),
    grievance_officer_name: text('Grievance officer name', 'Grievance officer பெயர்'),
    grievance_officer_designation: text('Grievance officer designation', 'Grievance officer பதவி'),
    grievance_email: text('Grievance email', 'Grievance மின்னஞ்சல்'),
    grievance_phone: text('Grievance phone', 'Grievance தொலைபேசி'),
  } as Record<string, string>)[value] ?? value;
  const missingDisclosure = payload?.provider.missing_disclosure_fields.map(missingDisclosureLabel).join(' · ') ?? '';

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/provider/verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { request?: RequestRecord; error?: string };
      if (!response.ok || !body.request) throw new Error(body.error ?? 'Verification request could not be submitted.');
      setForm({ ...emptyForm });
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
      <p className="summary-note">{payload.provider.verified
        ? payload.provider.marketplace_disclosure_complete
          ? t('verification.approvedHelp')
          : text('Identity verification is approved, but public marketplace disclosure is incomplete. Complete the correction workflow below before this profile can become public-ready.', 'Identity verification approved. ஆனால் public marketplace disclosure முழுமையில்லை. இந்த profile public-ready ஆக கீழே உள்ள correction workflow-ஐ முடிக்கவும்.')
        : t('verification.lockedHelp')}</p>
    </Card> : null}

    {!loading && payload?.provider ? pending ? <Card>
      <div className="section-heading"><div><span className="eyebrow">{remediation ? text('Disclosure correction', 'Disclosure correction') : t('verification.currentRequest')}</span><h2>{pending.legal_name}</h2></div><Badge tone="warning">{t('verification.pendingReview')}</Badge></div>
      <dl className="review-details">
        <div><dt>{t('verification.contact')}</dt><dd>{pending.contact_phone}</dd></div><div><dt>{t('verification.address')}</dt><dd>{pending.address}</dd></div>
        <div><dt>{text('Public email', 'பொது மின்னஞ்சல்')}</dt><dd>{pending.public_contact_email}</dd></div><div><dt>{text('Website', 'இணையதளம்')}</dt><dd>{pending.website_url || '—'}</dd></div>
        <div><dt>{text('Grievance officer', 'Grievance officer')}</dt><dd>{pending.grievance_officer_name} · {pending.grievance_officer_designation}</dd></div>
        <div><dt>{text('Grievance contact', 'Grievance தொடர்பு')}</dt><dd>{pending.grievance_email} · {pending.grievance_phone}</dd></div>
        <div><dt>{t('verification.evidenceType')}</dt><dd>{evidenceLabel(pending.evidence_type)}</dd></div><div><dt>{t('verification.reference')}</dt><dd>{pending.evidence_reference}</dd></div>
      </dl>
      <Alert title={text('Public marketplace disclosure', 'பொது marketplace disclosure')} tone="info">{text('Legal identity, public contact and grievance contact above will be copied to your public provider disclosure only after platform approval. Uploaded evidence documents remain private.', 'மேலுள்ள legal identity, public contact மற்றும் grievance contact platform approval பிறகே உங்கள் public provider disclosure-க்கு copy ஆகும். Upload செய்யும் evidence documents private ஆகவே இருக்கும்.')}</Alert>

      <div className="section-stack" style={{ marginTop: '1rem' }}>
        <div><strong>{t('verification.privateDocs')}</strong><p className="summary-note">{t('verification.docsHelp')}</p></div>
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(file); }} />
        {uploading ? <p>{t('verification.uploading')}</p> : null}
        {pendingDocuments.length ? <div className="section-stack">{pendingDocuments.map((doc) => <div className="card" key={doc.id} style={{ padding: '1rem' }}><div className="section-heading"><div><strong>{doc.original_filename}</strong><p className="summary-note">{doc.mime_type} · {sizeLabel(Number(doc.size_bytes))}</p></div><Badge tone="success">{t('verification.private')}</Badge></div><Button type="button" variant="quiet" loading={removingId === doc.id} onClick={() => void removeDocument(doc.id)}>{t('verification.removeDocument')}</Button></div>)}</div> : <Alert title={t('verification.documentRequired')} tone="warning">{t('verification.documentRequiredHelp')}</Alert>}
      </div>

      <p className="summary-note">{t('verification.auditHelp')}</p>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void withdraw(pending.id)}>{busy ? t('reason.updating') : t('verification.withdraw')}</Button>
    </Card> : payload.provider.verified && payload.provider.marketplace_disclosure_complete ? <Alert title={t('verification.approved')} tone="success">{text('Your verified marketplace identity and grievance contact are used for the public provider disclosure required for live services.', 'Live சேவைகளுக்குத் தேவையான பொது வழங்குநர் தகவல் மற்றும் grievance contact உங்கள் சரிபார்க்கப்பட்ட marketplace identity-யிலிருந்து காட்டப்படும்.')}</Alert> : <>
      {remediation ? <Alert title={text('Public marketplace disclosure is incomplete', 'Public marketplace disclosure முழுமையில்லை')} tone="warning">{text(
        `Missing: ${missingDisclosure}. Submit the corrected legal, public-contact and grievance details below. Your verified badge remains unchanged, but public marketplace eligibility stays blocked until the correction is reviewed and approved.`,
        `Missing: ${missingDisclosure}. கீழே corrected legal, public-contact மற்றும் grievance details submit செய்யவும். Verified badge மாறாது; correction review செய்து approve ஆகும் வரை public marketplace eligibility blocked ஆக இருக்கும்.`,
      )}</Alert> : null}
      {latest ? <Card>
        <div className="section-heading"><div><span className="eyebrow">{t('verification.previous')}</span><h2>{t('verification.title')} · {statusLabel(latest.status)}</h2></div><Badge tone={tone(latest.status)}>{statusLabel(latest.status)}</Badge></div>
        {latest.review_note ? <p><strong>{t('verification.platformNote')}</strong> {latest.review_note}</p> : null}
        <p className="summary-note">{latest.status === 'changes_requested' ? t('verification.changesHelp') : t('verification.newHelp')}</p>
      </Card> : null}
      <Card>
        <h2>{remediation ? text('Complete public marketplace disclosure', 'Public marketplace disclosure-ஐ complete செய்யவும்') : t('verification.start')}</h2>
        <p className="summary-note">{remediation
          ? text('Submit the missing or corrected disclosure details for platform review. Existing verified status is preserved while this correction is pending.', 'Missing அல்லது corrected disclosure details-ஐ platform review-க்கு submit செய்யவும். Correction pending இருக்கும் போது existing verified status preserve ஆகும்.')
          : t('verification.startHelp')}</p>
        <Alert title={remediation ? text('Correction requires platform review', 'Correction-க்கு platform review தேவை') : text('Marketplace public-contact requirement', 'Marketplace பொது தொடர்பு தேவை')} tone="info">{text('The legal identity, public contact and grievance officer details entered below will be public only after approval. Use business-facing contact details that consumers can use for service grievances.', 'கீழே உள்ள legal identity, public contact மற்றும் grievance officer விவரங்கள் approval பிறகே public ஆகும். Customers grievance அனுப்ப பயன்படுத்தக்கூடிய business-facing contact details-ஐ பயன்படுத்தவும்.')}</Alert>
        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
          <Input label={t('verification.legalName')} required maxLength={160} value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} />
          <Input label={text('Public contact phone', 'பொது தொடர்பு தொலைபேசி')} required maxLength={40} value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} />
          <Input label={t('verification.registeredAddress')} required maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          <Input label={text('Public contact email', 'பொது தொடர்பு மின்னஞ்சல்')} type="email" required maxLength={254} value={form.public_contact_email} onChange={(event) => setForm({ ...form, public_contact_email: event.target.value })} />
          <Input label={text('Website URL (optional)', 'Website URL (விருப்பம்)')} type="url" maxLength={300} value={form.website_url} onChange={(event) => setForm({ ...form, website_url: event.target.value })} />
          <Input label={text('Grievance officer name', 'Grievance officer பெயர்')} required maxLength={160} value={form.grievance_officer_name} onChange={(event) => setForm({ ...form, grievance_officer_name: event.target.value })} />
          <Input label={text('Grievance officer designation', 'Grievance officer பதவி')} required maxLength={120} value={form.grievance_officer_designation} onChange={(event) => setForm({ ...form, grievance_officer_designation: event.target.value })} />
          <Input label={text('Grievance email', 'Grievance மின்னஞ்சல்')} type="email" required maxLength={254} value={form.grievance_email} onChange={(event) => setForm({ ...form, grievance_email: event.target.value })} />
          <Input label={text('Grievance phone', 'Grievance தொலைபேசி')} required maxLength={40} value={form.grievance_phone} onChange={(event) => setForm({ ...form, grievance_phone: event.target.value })} />
          <Select label={t('verification.evidenceType')} value={form.evidence_type} onChange={(event) => setForm({ ...form, evidence_type: event.target.value })}><option value="government_id">{evidenceLabel('government_id')}</option><option value="business_registration">{evidenceLabel('business_registration')}</option><option value="professional_license">{evidenceLabel('professional_license')}</option><option value="other">{evidenceLabel('other')}</option></Select>
          <Input label={t('verification.evidenceReference')} required maxLength={120} hint={t('verification.referenceHint')} value={form.evidence_reference} onChange={(event) => setForm({ ...form, evidence_reference: event.target.value })} />
          <label className="field"><span className="field-label">{t('verification.evidenceNote')}</span><textarea className="field-control" rows={4} maxLength={1200} value={form.evidence_note} onChange={(event) => setForm({ ...form, evidence_note: event.target.value })} placeholder={t('verification.notePlaceholder')} /></label>
          <Button type="submit" loading={busy}>{remediation ? text('Submit disclosure correction', 'Disclosure correction submit செய்யவும்') : t('verification.create')}</Button>
        </form>
      </Card>
    </> : null}
  </LiveProviderShell>;
}
