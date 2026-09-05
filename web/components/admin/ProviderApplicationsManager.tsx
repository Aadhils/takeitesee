'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useAdminControlTranslations } from '../i18n/AdminControlTranslations';

type ExistingProfile = { id: string; display_name: string; verified: boolean };
type Application = {
  id: string; applicant_user_id: string; provider_type: 'professional' | 'business'; display_name: string; description?: string | null; location: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; review_note?: string | null; reviewed_by?: string | null; reviewed_at?: string | null;
  result_provider_id?: string | null; created_at: string; updated_at: string;
  applicant?: { name?: string | null; email?: string | null } | null;
  existing_profiles?: { professional?: ExistingProfile | null; business?: ExistingProfile | null } | null;
};

function tone(status: Application['status']) { if (status === 'approved') return 'success' as const; if (status === 'rejected') return 'danger' as const; if (status === 'pending') return 'warning' as const; return 'neutral' as const; }

export default function ProviderApplicationsManager() {
  const { locale, t } = useAdminControlTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const text = (en: string, ta: string) => tamil ? ta : en;
  const [items, setItems] = useState<Application[]>([]); const [filter, setFilter] = useState<'pending' | 'all'>('pending'); const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const moment = (value: string) => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return value; } };
  const statusLabel = (status: Application['status']) => status === 'pending' ? t('common.pending') : status === 'approved' ? t('common.approved') : status === 'rejected' ? t('common.rejected') : t('common.withdrawn');

  const load = useCallback(async () => { setLoading(true); setError(''); try { const response = await fetch('/api/super-admin/provider-applications', { cache: 'no-store' }); const body = await response.json() as { applications?: Application[]; error?: string }; if (!response.ok || !body.applications) throw new Error(body.error ?? 'Unable to load provider applications.'); setItems(body.applications); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load provider applications.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  const review = async (application: Application, decision: 'approve' | 'reject') => { if (busyId) return; const note = (notes[application.id] ?? '').trim(); if (decision === 'reject' && note.length < 3) { setError('Enter a clear rejection reason before rejecting an application.'); return; } setBusyId(application.id); setError(''); try { const response = await fetch('/api/super-admin/provider-applications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_id: application.id, decision, note }) }); const body = await response.json() as { application?: Application; error?: string }; if (!response.ok || !body.application) throw new Error(body.error ?? 'Application review failed.'); setItems((current) => current.map((item) => item.id === application.id ? { ...item, ...body.application } : item)); setNotes((current) => ({ ...current, [application.id]: '' })); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Application review failed.'); } finally { setBusyId(null); } };

  const pendingCount = items.filter((item) => item.status === 'pending').length; const visible = useMemo(() => filter === 'pending' ? items.filter((item) => item.status === 'pending') : items, [items, filter]);
  return <div className="section-stack">
    <div className="dashboard-grid"><Card><span className="eyebrow">{t('applications.pendingReview')}</span><h2>{pendingCount}</h2><p>{t('applications.pendingHelp')}</p></Card><Card><span className="eyebrow">{t('applications.all')}</span><h2>{items.length}</h2><p>{t('applications.allHelp')}</p></Card></div>
    <div className="button-row" aria-label={t('applications.filters')}><Button type="button" variant={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setFilter('pending')}>{t('common.pending')} ({pendingCount})</Button><Button type="button" variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>{t('common.all')} ({items.length})</Button></div>
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{t('applications.reload')}</Button></Card> : null}
    {loading ? <Card><p>{t('applications.loading')}</p></Card> : null}
    {!loading && !visible.length ? <Card><EmptyState title={filter === 'pending' ? t('applications.nonePending') : t('applications.noneAll')}>{filter === 'pending' ? t('applications.nonePendingHelp') : t('applications.noneAllHelp')}</EmptyState></Card> : null}
    {visible.map((application) => {
      const professional = application.existing_profiles?.professional ?? null;
      const business = application.existing_profiles?.business ?? null;
      const identityConflict = application.status === 'pending' && Boolean(professional || business);
      const applicantName = application.applicant?.name?.trim() || application.display_name;
      const applicantEmail = application.applicant?.email?.trim() || null;
      return <Card key={application.id}>
        <div className="section-heading"><div><span className="eyebrow">{application.provider_type === 'business' ? t('applications.business') : t('applications.professional')}</span><h2>{application.display_name}</h2><div className="button-row" style={{ marginTop: '.5rem' }}>{identityConflict ? <Badge tone="danger">{text('Provider identity conflict', 'Provider identity conflict')}</Badge> : null}</div></div><Badge tone={tone(application.status)}>{statusLabel(application.status)}</Badge></div>
        <dl className="review-details">
          <div><dt>{t('applications.applicant')}</dt><dd><strong>{applicantName}</strong>{applicantEmail ? <><br />{applicantEmail}</> : null}<br /><span style={{ opacity: .7 }}>{application.applicant_user_id.slice(0, 8)}…</span></dd></div>
          <div><dt>{t('applications.serviceArea')}</dt><dd>{application.location}</dd></div>
          <div><dt>{t('applications.submitted')}</dt><dd>{moment(application.created_at)}</dd></div>
          <div><dt>{t('applications.providerType')}</dt><dd>{application.provider_type === 'business' ? t('common.business') : t('common.professional')}</dd></div>
        </dl>
        <div style={{ marginTop: '1rem' }}>
          <strong>{text('Existing provider identity', 'ஏற்கனவே உள்ள provider identity')}</strong>
          {!professional && !business ? <p className="summary-note">{text('No existing Provider profile. This is a first-provider application.', 'Provider profile ஏற்கனவே இல்லை. இது first-provider application.')}</p> : <div className="dashboard-grid" style={{ marginTop: '.65rem' }}>
            {professional ? <Card><span className="eyebrow">{t('common.professional')}</span><h3>{professional.display_name}</h3><Badge tone={professional.verified ? 'success' : 'warning'}>{professional.verified ? t('common.verified') : t('common.notVerified')}</Badge></Card> : null}
            {business ? <Card><span className="eyebrow">{t('common.business')}</span><h3>{business.display_name}</h3><Badge tone={business.verified ? 'success' : 'warning'}>{business.verified ? t('common.verified') : t('common.notVerified')}</Badge></Card> : null}
          </div>}
        </div>
        {identityConflict ? <p role="alert" style={{ marginTop: '1rem', color: 'var(--danger, #b42318)', fontWeight: 650 }}>{text('One account may own only one Provider identity. Approval is disabled because this applicant already owns a Professional or Business provider profile. Reject this stale/conflicting request; the other provider type requires a separate account.', 'ஒரு account-க்கு ஒரு Provider identity மட்டும் அனுமதி. இந்த applicant ஏற்கனவே Professional அல்லது Business provider profile வைத்திருப்பதால் approval disabled. இந்த conflicting request-ஐ reject செய்யவும்; மற்ற provider type-க்கு தனி account தேவை.')}</p> : null}
        {application.description ? <div style={{ marginTop: '1rem' }}><strong>{t('applications.about')}</strong><p>{application.description}</p></div> : null}
        {application.review_note ? <div style={{ marginTop: '1rem' }}><strong>{t('applications.reviewNote')}</strong><p>{application.review_note}</p></div> : null}
        {application.status === 'pending' ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}><label className="field"><span className="field-label">{t('applications.note')}</span><textarea className="field-control" rows={3} maxLength={1000} value={notes[application.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))} placeholder={t('applications.notePlaceholder')} /></label><div className="button-row"><Button type="button" disabled={busyId === application.id || identityConflict} onClick={() => void review(application, 'approve')}>{busyId === application.id ? t('applications.updating') : t('applications.approve')}</Button><Button type="button" variant="quiet" disabled={busyId === application.id} onClick={() => void review(application, 'reject')}>{t('applications.reject')}</Button></div><p className="summary-note">{identityConflict ? text('Approval is disabled by the one-provider-per-account policy.', 'One-provider-per-account policy காரணமாக approval disabled.') : t('applications.approvalHelp')}</p></div> : null}
      </Card>;
    })}
  </div>;
}
