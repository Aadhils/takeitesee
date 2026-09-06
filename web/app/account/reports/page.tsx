'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card } from '../../../components/ui/primitives';
import { useOperationalTranslations } from '../../../components/i18n/OperationalTranslations';
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
  const { locale } = useOperationalTranslations();
  const tamil = locale === 'ta-IN';
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
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load safety reports.');
        if (active) setReports(payload.reports ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load safety reports.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (authenticated === null && loading) {
    return <Card><p>{tamil ? 'உங்கள் safety reports-ஐ சரிபார்க்கிறது…' : 'Checking your safety reports…'}</p></Card>;
  }

  if (authenticated === false) {
    return <main className="container section-stack">
      <Card>
        <h1>{tamil ? 'Safety reports பார்க்க sign in செய்யவும்' : 'Sign in to view safety reports'}</h1>
        <p>{tamil ? 'நீங்கள் TakeItEsee-க்கு report செய்த marketplace safety items-ன் status பார்க்க sign in செய்யவும்.' : 'Sign in to review the status of marketplace safety items you reported to TakeItEsee.'}</p>
        <div className="button-row">
          <Link href="/login?returnTo=%2Faccount%2Freports" className="button button-primary">Sign in</Link>
          <Link href="/account" className="button button-secondary">{tamil ? 'Account-க்கு திரும்பவும்' : 'Back to account'}</Link>
        </div>
      </Card>
    </main>;
  }

  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">{tamil ? 'Marketplace safety' : 'Marketplace safety'}</span>
      <h1>{tamil ? 'என் safety reports' : 'My safety reports'}</h1>
      <p>{tamil
        ? 'நீங்கள் report செய்த marketplace items-ன் review status மற்றும் safe status history இங்கே காணலாம்.'
        : 'Track the review status and safe status history of marketplace items you reported.'}</p>
    </section>

    <Card>
      <h2>{tamil ? 'என்ன காட்டப்படும்?' : 'What is shown here?'}</h2>
      <p>{tamil
        ? 'உங்கள் report reference, category, நீங்கள் கொடுத்த விவரம் மற்றும் review status மட்டும் காட்டப்படும். விசாரணை பாதுகாப்பிற்காக internal moderator notes மற்றும் staff identifiers காட்டப்படாது.'
        : 'You can see your report reference, category, submitted details and review status. Internal moderator notes and staff identifiers are not exposed.'}</p>
      <div className="button-row">
        <Link href="/account/support" className="button button-secondary">{tamil ? 'Platform support' : 'Platform support'}</Link>
        <Link href="/account" className="button button-secondary">{tamil ? 'Account-க்கு திரும்பவும்' : 'Back to account'}</Link>
      </div>
    </Card>

    {error ? <div className="alert alert-error" role="alert"><strong>{error}</strong></div> : null}
    {loading ? <Card><p>{tamil ? 'Reports load ஆகிறது…' : 'Loading reports…'}</p></Card> : null}
    {!loading && !error && reports.length === 0 ? <Card><p>{tamil ? 'நீங்கள் இன்னும் marketplace safety report submit செய்யவில்லை.' : 'You have not submitted any marketplace safety reports yet.'}</p></Card> : null}

    {reports.map((report) => <Card key={report.id}>
      <div className="admin-record-top">
        <div>
          <span className="eyebrow">{report.report_reference}</span>
          <h2>{report.context_label}</h2>
          <p>{words(report.context_kind)} · {words(report.target_type)}</p>
        </div>
        <Badge tone={statusTone(report.status)}>{words(report.status)}</Badge>
      </div>

      <dl className="account-details">
        <div><dt>{tamil ? 'Category' : 'Category'}</dt><dd>{words(report.category)}</dd></div>
        <div><dt>{tamil ? 'Submitted' : 'Submitted'}</dt><dd>{new Date(report.created_at).toLocaleString(locale)}</dd></div>
        <div><dt>{tamil ? 'Last update' : 'Last update'}</dt><dd>{new Date(report.updated_at).toLocaleString(locale)}</dd></div>
        {report.resolved_at ? <div><dt>{tamil ? 'Resolved' : 'Resolved'}</dt><dd>{new Date(report.resolved_at).toLocaleString(locale)}</dd></div> : null}
      </dl>

      {report.details ? <div className="settings-note"><strong>{tamil ? 'நீங்கள் கொடுத்த விவரம்' : 'Your submitted details'}</strong><p>{report.details}</p></div> : null}

      {report.events.length > 0 ? <div className="section-stack">
        <h3>{tamil ? 'Status history' : 'Status history'}</h3>
        <ul>
          {report.events.map((event, index) => <li key={`${report.id}-${event.created_at}-${index}`}>
            <strong>{words(event.event_type)}</strong>
            {event.to_status ? ` · ${words(event.to_status)}` : ''}
            {' · '}{new Date(event.created_at).toLocaleString(locale)}
          </li>)}
        </ul>
      </div> : null}
    </Card>)}
  </main>;
}
