'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '../../../components/account/CustomerSupportSafetyResponsive.module.css';
import { Badge, Card } from '../../../components/ui/primitives';
import { useAccountSafetyReportsTranslations } from '../../../components/i18n/AccountSafetyReportsTranslations';
import { getCurrentCustomerAsync } from '../../../services/auth-adapter';

type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
type ReportEvent = {
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
};
type SafetyReport = {
  id: string;
  report_reference: string;
  context_kind: 'requirement' | 'job_application' | 'professional_portfolio' | 'job_posting';
  target_type: string;
  category: string;
  details: string | null;
  status: ReportStatus;
  context_label: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  events: ReportEvent[];
};

function statusTone(status: ReportStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'actioned') return 'success';
  if (status === 'reviewing') return 'warning';
  if (status === 'dismissed') return 'neutral';
  return 'info';
}

function words(value: string) {
  return value.replaceAll('_', ' ');
}

export default function AccountSafetyReportsPage() {
  const { locale, t } = useAccountSafetyReportsTranslations();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const auth = await getCurrentCustomerAsync();
        if (!active) return;
        setAuthenticated(auth.authenticated);
        if (!auth.authenticated) return;

        const response = await fetch('/api/account/reports', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json() as { reports?: SafetyReport[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? t('reports.loadFallback'));
        if (active) setReports(payload.reports ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t('reports.loadFallback'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [t]);

  const statusLabel = (status: ReportStatus) => {
    if (status === 'open') return t('reports.status.open');
    if (status === 'reviewing') return t('reports.status.reviewing');
    if (status === 'actioned') return t('reports.status.actioned');
    return t('reports.status.dismissed');
  };

  if (authenticated === null && loading) {
    return <div className={styles.supportSafetyJourney}><Card><p>{t('reports.checking')}</p></Card></div>;
  }

  if (authenticated === false) {
    return <div className={styles.supportSafetyJourney}><main className="container section-stack">
      <Card>
        <h1>{t('reports.auth.title')}</h1>
        <p>{t('reports.auth.body')}</p>
        <div className="button-row">
          <Link href="/login?returnTo=%2Faccount%2Freports" className="button button-primary">{t('reports.auth.signIn')}</Link>
          <Link href="/account" className="button button-secondary">{t('reports.auth.backAccount')}</Link>
        </div>
      </Card>
    </main></div>;
  }

  return <div className={styles.supportSafetyJourney}><main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">{t('reports.eyebrow')}</span>
      <h1>{t('reports.title')}</h1>
      <p>{t('reports.intro')}</p>
    </section>

    <Card>
      <h2>{t('reports.visibility.title')}</h2>
      <p>{t('reports.visibility.body')}</p>
      <div className="button-row">
        <Link href="/account/support" className="button button-secondary">{t('reports.action.platformSupport')}</Link>
        <Link href="/account" className="button button-secondary">{t('reports.action.backAccount')}</Link>
      </div>
    </Card>

    {error ? <div className="alert alert-error" role="alert"><strong>{error}</strong></div> : null}
    {loading ? <Card><p>{t('reports.loading')}</p></Card> : null}
    {!loading && !error && reports.length === 0 ? <Card><p>{t('reports.empty')}</p></Card> : null}

    {reports.map((report) => <Card key={report.id}>
      <div className="admin-record-top">
        <div>
          <span className="eyebrow">{report.report_reference}</span>
          <h2>{report.context_label}</h2>
          <p>{words(report.context_kind)} · {words(report.target_type)}</p>
        </div>
        <Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge>
      </div>

      <dl className="account-details">
        <div><dt>{t('reports.meta.category')}</dt><dd>{words(report.category)}</dd></div>
        <div><dt>{t('reports.meta.submitted')}</dt><dd>{new Date(report.created_at).toLocaleString(locale)}</dd></div>
        <div><dt>{t('reports.meta.lastUpdate')}</dt><dd>{new Date(report.updated_at).toLocaleString(locale)}</dd></div>
        {report.resolved_at ? <div><dt>{t('reports.meta.resolved')}</dt><dd>{new Date(report.resolved_at).toLocaleString(locale)}</dd></div> : null}
      </dl>

      {report.details ? <div className="settings-note"><strong>{t('reports.details.title')}</strong><p>{report.details}</p></div> : null}

      {report.events.length > 0 ? <div className="section-stack">
        <h3>{t('reports.history.title')}</h3>
        <ul>
          {report.events.map((event, index) => <li key={`${report.id}-${event.created_at}-${index}`}>
            <strong>{words(event.event_type)}</strong>
            {event.to_status ? ` · ${words(event.to_status)}` : ''}
            {' · '}{new Date(event.created_at).toLocaleString(locale)}
          </li>)}
        </ul>
      </div> : null}
    </Card>)}
  </main></div>;
}
