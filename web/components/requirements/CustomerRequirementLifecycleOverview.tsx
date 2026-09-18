'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

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
  const { locale } = useOperationalTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
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
        <span className="eyebrow">{tamil ? 'Requirement lifecycle' : 'Requirement lifecycle'}</span>
        <h2>{tamil ? 'Active work மற்றும் history தனித்தனியாக' : 'Separate active work from history'}</h2>
      </div>
      <Badge tone="neutral">{requirements.length}</Badge>
    </div>
    <p className="detail-copy">
      {tamil
        ? 'Open/paused needs இன்னும் provider selection-க்கு முன் உள்ளவை. Awarded என்றால் Provider தேர்ந்தெடுக்கப்பட்டு service journey Bookings-ல் தொடர்கிறது. Fulfilled/cancelled records history ஆகும்.'
        : 'Open or paused needs are still before provider selection. Awarded means a provider was selected and the service journey continues in Bookings. Fulfilled or cancelled records are history.'}
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.75rem', marginTop: '.9rem' }}>
      <div style={{ padding: '.85rem', border: '1px solid var(--color-border)', borderRadius: '.8rem' }}><span className="eyebrow">{tamil ? 'Open needs' : 'Open needs'}</span><strong style={{ display: 'block', marginTop: '.3rem', fontSize: '1.4rem' }}>{counts.open}</strong></div>
      <div style={{ padding: '.85rem', border: '1px solid var(--color-border)', borderRadius: '.8rem' }}><span className="eyebrow">{tamil ? 'Awarded work' : 'Awarded work'}</span><strong style={{ display: 'block', marginTop: '.3rem', fontSize: '1.4rem' }}>{counts.awarded}</strong></div>
      <div style={{ padding: '.85rem', border: '1px solid var(--color-border)', borderRadius: '.8rem' }}><span className="eyebrow">{tamil ? 'History' : 'History'}</span><strong style={{ display: 'block', marginTop: '.3rem', fontSize: '1.4rem' }}>{counts.history}</strong></div>
    </div>
    {counts.awarded > 0 ? <div style={{ marginTop: '.9rem', display: 'grid', gap: '.45rem' }}>
      <strong>{tamil ? 'Provider தேர்ந்தெடுத்த work எங்கே?' : 'Where does awarded work continue?'}</strong>
      <p className="summary-note" style={{ margin: 0 }}>{tamil ? 'Schedule, service execution, completion confirmation மற்றும் support status ஆகியவை My Bookings-ல் தொடர்ந்து track செய்யப்படும். Requirement status final history-ஆக மாறுவது தனி lifecycle step.' : 'Schedule, service execution, completion confirmation and support status continue in My Bookings. The requirement becomes final history only when its existing lifecycle reaches that stage.'}</p>
      <div><Link className="button button-secondary" href="/bookings">{tamil ? 'My Bookings பார்க்க' : 'Open My Bookings'}</Link></div>
    </div> : null}
  </Card>;
}
