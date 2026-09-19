'use client';

import { FormEvent, useState } from 'react';
import { useMarketplaceReportTranslations, type MarketplaceReportKey } from '../i18n/MarketplaceReportTranslations';
import { Alert, Button } from '../ui/primitives';

type TargetType = 'requirement' | 'proposal' | 'conversation' | 'message' | 'portfolio_media' | 'job_posting';
type Category = 'spam' | 'harassment' | 'fraud' | 'unsafe' | 'off_platform' | 'inappropriate' | 'other';

const categories: Array<{ value: Category; labelKey: MarketplaceReportKey }> = [
  { value: 'spam', labelKey: 'marketplaceReport.category.spam' },
  { value: 'harassment', labelKey: 'marketplaceReport.category.harassment' },
  { value: 'fraud', labelKey: 'marketplaceReport.category.fraud' },
  { value: 'unsafe', labelKey: 'marketplaceReport.category.unsafe' },
  { value: 'off_platform', labelKey: 'marketplaceReport.category.offPlatform' },
  { value: 'inappropriate', labelKey: 'marketplaceReport.category.inappropriate' },
  { value: 'other', labelKey: 'marketplaceReport.category.other' },
];

export function MarketplaceReportForm({ targetType, targetId, label }: { targetType: TargetType; targetId: string; label?: string }) {
  const { t } = useMarketplaceReportTranslations();
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
      if (!response.ok || !payload.report?.report_reference) throw new Error(payload.error || t('marketplaceReport.error.fallback'));
      setReference(payload.report.report_reference);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('marketplaceReport.error.fallback'));
    } finally {
      setBusy(false);
    }
  };

  return <div style={{ display: 'grid', gap: '.55rem' }}>
    {!open && !reference ? <Button type="button" variant="quiet" onClick={() => setOpen(true)}>{label ?? t('marketplaceReport.action.open')}</Button> : null}
    {reference ? <Alert title={t('marketplaceReport.success.title')} tone="success">{t('marketplaceReport.success.reference')} {reference}. {t('marketplaceReport.success.audit')}</Alert> : null}
    {open && !reference ? <form onSubmit={submit} style={{ display: 'grid', gap: '.6rem', maxWidth: 520 }}>
      <label className="field"><span className="field-label">{t('marketplaceReport.field.concern')}</span><select className="field-control" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option value={item.value} key={item.value}>{t(item.labelKey)}</option>)}</select></label>
      <label className="field"><span className="field-label">{t('marketplaceReport.field.details')}</span><textarea className="field-control" rows={3} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder={t('marketplaceReport.field.detailsPlaceholder')} /></label>
      {error ? <Alert title={t('marketplaceReport.error.title')} tone="danger">{error}</Alert> : null}
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}><Button type="submit" variant="danger" loading={busy}>{t('marketplaceReport.action.submit')}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>{t('marketplaceReport.action.cancel')}</Button></div>
    </form> : null}
  </div>;
}
