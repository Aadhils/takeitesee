'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
import { useCustomerRequirementLifecycleTranslations } from '../i18n/CustomerRequirementLifecycleTranslations';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type RequirementSummary = {
  id: string;
  reference: string;
  title: string;
  status: RequirementStatus;
  updated_at: string;
  closed_at: string | null;
};

export default function CustomerRequirementLifecycleOverview() {
  const { t } = useCustomerRequirementLifecycleTranslations();
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const response = await fetch('/api/requirements', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as { requirements?: RequirementSummary[] };
      if (sequence === loadSequence.current) setRequirements(payload.requirements ?? []);
    } catch {
      // This overview is supplementary and must not block the requirement workspace.
    } finally {
      if (sequence === loadSequence.current) setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const refreshOnPageShow = () => { void load(); };
    window.addEventListener('pageshow', refreshOnPageShow);
    window.addEventListener('focus', refresh);
    window.addEventListener('popstate', refreshOnPageShow);
    window.addEventListener('takeitesee:requirements-changed', refreshOnPageShow);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('pageshow', refreshOnPageShow);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('popstate', refreshOnPageShow);
      window.removeEventListener('takeitesee:requirements-changed', refreshOnPageShow);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const counts = useMemo(() => ({
    open: requirements.filter((row) => row.status === 'open' || row.status === 'paused').length,
    awarded: requirements.filter((row) => row.status === 'awarded').length,
    history: requirements.filter((row) => row.status === 'fulfilled' || row.status === 'cancelled').length,
  }), [requirements]);

  if (!loaded || requirements.length === 0) return null;

  return <Card className="policy-card">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{t('requirementLifecycle.eyebrow')}</span>
        <h2>{t('requirementLifecycle.title')}</h2>
      </div>
      <Badge tone="neutral">{requirements.length}</Badge>
    </div>
    <p className="detail-copy">{t('requirementLifecycle.description')}</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.75rem', marginTop: '.9rem' }}>
      <div style={{ padding: '.85rem', border: '1px solid var(--color-border)', borderRadius: '.8rem' }}><span className="eyebrow">{t('requirementLifecycle.openNeeds')}</span><strong style={{ display: 'block', marginTop: '.3rem', fontSize: '1.4rem' }}>{counts.open}</strong></div>
      <div style={{ padding: '.85rem', border: '1px solid var(--color-border)', borderRadius: '.8rem' }}><span className="eyebrow">{t('requirementLifecycle.awardedWork')}</span><strong style={{ display: 'block', marginTop: '.3rem', fontSize: '1.4rem' }}>{counts.awarded}</strong></div>
      <div style={{ padding: '.85rem', border: '1px solid var(--color-border)', borderRadius: '.8rem' }}><span className="eyebrow">{t('requirementLifecycle.history')}</span><strong style={{ display: 'block', marginTop: '.3rem', fontSize: '1.4rem' }}>{counts.history}</strong></div>
    </div>
    {counts.awarded > 0 ? <div style={{ marginTop: '.9rem', display: 'grid', gap: '.45rem' }}>
      <strong>{t('requirementLifecycle.awardedQuestion')}</strong>
      <p className="summary-note" style={{ margin: 0 }}>{t('requirementLifecycle.awardedBody')}</p>
      <div><Link className="button button-secondary" href="/bookings">{t('requirementLifecycle.openBookings')}</Link></div>
    </div> : null}
  </Card>;
}
