'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { useAdminControlTranslations } from '../i18n/AdminControlTranslations';

type Status = 'open' | 'reviewing' | 'actioned' | 'dismissed';
type ReportRow = {
  id: string;
  report_reference: string;
  context_kind: 'requirement' | 'job_application' | 'professional_portfolio';
  target_type: 'requirement'|'proposal'|'conversation'|'message'|'portfolio_media';
  target_id: string;
  category: string;
  details: string | null;
  status: Status;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  reporter_name: string;
  reported_user_name: string | null;
  requirement_id: string | null;
  requirement_reference: string | null;
  requirement_title: string | null;
  proposal_reference: string | null;
  job_application_id: string | null;
  job_posting_id: string | null;
  job_title: string | null;
  application_status: string | null;
  business_name: string | null;
  message_excerpt: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
  portfolio_caption?: string | null;
  portfolio_media_type?: 'image' | 'video' | null;
  portfolio_preview_url?: string | null;
};

function statusTone(status: Status) {
  if (status === 'open') return 'danger' as const;
  if (status === 'reviewing') return 'warning' as const;
  if (status === 'actioned') return 'success' as const;
  return 'neutral' as const;
}

function label(value: string | null | undefined) {
  return (value || 'unknown').replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

export function MarketplaceModerationManager() {
  const { locale, t } = useAdminControlTranslations();
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
    <div className="section-heading"><div><span className="eyebrow">{t('moderation.eyebrow')}</span><h1>{t('moderation.title')}</h1><p className="detail-copy">{t('moderation.intro')}</p></div><Badge tone={openCount ? 'danger' : 'success'}>{openCount} {t('common.open')}</Badge></div>
    {error ? <Alert title={t('moderation.unavailable')} tone="danger">{error}</Alert> : null}
    {loading ? <Card><p>{t('moderation.loading')}</p></Card> : null}
    {!loading && reports.length === 0 ? <Card><p className="detail-copy">{t('moderation.empty')}</p></Card> : null}
    {!loading ? reports.map((row) => {
      const jobContext = row.context_kind === 'job_application';
      const portfolioContext = row.context_kind === 'professional_portfolio';
      const title = portfolioContext
        ? row.portfolio_caption || 'Professional portfolio media'
        : jobContext ? row.job_title || 'Job application' : row.requirement_title || 'Marketplace report';
      const reference = portfolioContext
        ? [row.professional_name, row.portfolio_media_type ? label(row.portfolio_media_type) : null].filter(Boolean).join(' · ')
        : jobContext
          ? [row.business_name, row.application_status ? `Application ${label(row.application_status)}` : null].filter(Boolean).join(' · ')
          : row.requirement_reference || '';
      const contextLabel = portfolioContext ? 'professional portfolio' : jobContext ? 'job application' : row.target_type;
      return <Card className="policy-card" key={row.id}>
        <div className="section-heading"><div><span className="eyebrow">{row.report_reference} · {contextLabel}</span><h2>{title}</h2><p className="summary-note">{reference}</p></div><Badge tone={statusTone(row.status)}>{row.status.replaceAll('_',' ')}</Badge></div>
        <dl className="review-details"><div><dt>{t('common.category')}</dt><dd>{row.category.replace('_',' ')}</dd></div><div><dt>{t('common.reporter')}</dt><dd>{row.reporter_name}</dd></div><div><dt>{t('common.reportedUser')}</dt><dd>{row.reported_user_name || t('common.notApplicable')}</dd></div><div><dt>{t('common.opened')}</dt><dd>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at))}</dd></div>{row.proposal_reference ? <div><dt>{t('common.proposal')}</dt><dd>{row.proposal_reference}</dd></div> : null}{jobContext || portfolioContext ? <div><dt>Reported item</dt><dd>{portfolioContext ? `${label(row.portfolio_media_type)} work sample` : label(row.target_type)}</dd></div> : null}</dl>
        {row.details ? <Alert title={t('moderation.reporterDetails')} tone="info">{row.details}</Alert> : null}
        {row.message_excerpt ? <div style={{ border: '1px solid #e7eaf0', borderRadius: 12, padding: '.8rem', marginTop: '.7rem' }}><strong>{t('moderation.messageExcerpt')}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.message_excerpt}</p></div> : null}
        {portfolioContext ? <div style={{ border: '1px solid #e7eaf0', borderRadius: 12, padding: '.8rem', marginTop: '.7rem', display: 'grid', gap: '.55rem' }}>
          <strong>Private moderation preview</strong>
          {row.portfolio_preview_url ? row.portfolio_media_type === 'video'
            ? <video src={row.portfolio_preview_url} controls preload="metadata" playsInline style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#101828' }} />
            : <img src={row.portfolio_preview_url} alt={row.portfolio_caption || 'Reported professional portfolio media'} style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 10, background: '#f2f4f7' }} />
          : <p className="summary-note">Preview unavailable. The signed moderation preview may have expired or the media may no longer exist.</p>}
          <p className="summary-note">This preview is generated only after Admin authorization and uses a short-lived private storage URL.</p>
        </div> : null}
        {row.admin_note ? <p className="summary-note"><strong>{t('moderation.latestNote')}</strong> {row.admin_note}</p> : null}
        {row.status === 'open' || row.status === 'reviewing' ? <div style={{ display: 'grid', gap: '.65rem', marginTop: '1rem' }}><label className="field"><span className="field-label">{t('moderation.note')}</span><textarea className="field-control" rows={3} maxLength={2000} value={notes[row.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder={t('moderation.notePlaceholder')} /></label><div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>{row.status === 'open' ? <Button type="button" variant="secondary" loading={busyId===row.id} onClick={() => void update(row.id,'reviewing')}>{t('moderation.startReview')}</Button> : null}<Button type="button" loading={busyId===row.id} onClick={() => void update(row.id,'actioned')}>{t('moderation.actioned')}</Button><Button type="button" variant="quiet" loading={busyId===row.id} onClick={() => void update(row.id,'dismissed')}>{t('moderation.dismiss')}</Button></div><p className="summary-note">Closing a report records the moderation decision only. Portfolio media is not automatically deleted or deactivated.</p></div> : null}
      </Card>;
    }) : null}
  </div>;
}
