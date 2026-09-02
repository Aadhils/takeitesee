'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Badge, Button, Card, Select, Textarea } from '../../../components/ui/primitives';
import { useOperationalTranslations } from '../../../components/i18n/OperationalTranslations';
import { getCurrentCustomerAsync } from '../../../services/auth-adapter';

type PrivacyRequest = {
  id: string;
  request_type: 'access' | 'correction' | 'deletion';
  details: string;
  status: 'submitted' | 'in_review' | 'awaiting_information' | 'completed' | 'declined';
  review_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

async function readRequests(): Promise<PrivacyRequest[]> {
  const response = await fetch('/api/account/privacy-requests', { cache: 'no-store', headers: { Accept: 'application/json' } });
  const payload = await response.json() as { requests?: PrivacyRequest[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Unable to load privacy requests.');
  return payload.requests ?? [];
}

function statusTone(status: PrivacyRequest['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'declined') return 'danger';
  if (status === 'awaiting_information') return 'warning';
  return 'info';
}

function humanStatus(status: PrivacyRequest['status']) {
  return status.replaceAll('_', ' ');
}

export default function AccountPrivacyPage() {
  const { locale } = useOperationalTranslations();
  const tamil = locale === 'ta-IN';
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [requestType, setRequestType] = useState<PrivacyRequest['request_type']>('access');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const auth = await getCurrentCustomerAsync();
        if (!active) return;
        setAuthenticated(auth.authenticated);
        if (!auth.authenticated) return;
        const current = await readRequests();
        if (active) setRequests(current);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load privacy requests.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const normalizedDetails = details.trim();
    if (normalizedDetails.length < 10) {
      setError(tamil ? 'குறைந்தது 10 characters கொண்ட விவரத்தை எழுதவும்.' : 'Enter at least 10 characters describing your request.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      const response = await fetch('/api/account/privacy-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request_type: requestType, details: normalizedDetails }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to submit privacy request.');
      setDetails('');
      setRequests(await readRequests());
      setSuccess(tamil ? 'உங்கள் privacy request பாதுகாப்பாக பதிவு செய்யப்பட்டது.' : 'Your privacy request has been recorded securely.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit privacy request.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = (type: PrivacyRequest['request_type']) => {
    if (type === 'access') return tamil ? 'தகவல் அணுகல்' : 'Access to my information';
    if (type === 'correction') return tamil ? 'தகவல் திருத்தம்' : 'Correction of my information';
    return tamil ? 'Account / தகவல் நீக்க கோரிக்கை' : 'Account / information deletion request';
  };

  if (authenticated === null && loading) return <Card><p>{tamil ? 'உங்கள் account-ஐ சரிபார்க்கிறது…' : 'Checking your account…'}</p></Card>;

  if (authenticated === false) {
    return <main className="container section-stack">
      <Card>
        <h1>{tamil ? 'Privacy requests-க்கு sign in செய்யவும்' : 'Sign in to manage privacy requests'}</h1>
        <p>{tamil ? 'உங்கள் தனிப்பட்ட தகவலுக்கான access, correction அல்லது deletion request submit செய்ய sign in செய்யவும்.' : 'Sign in to submit access, correction, or deletion requests for your personal information.'}</p>
        <div className="button-row">
          <Link className="button button-primary" href="/login?returnTo=%2Faccount%2Fprivacy">{tamil ? 'Sign in' : 'Sign in'}</Link>
          <Link className="button button-secondary" href="/privacy">{tamil ? 'Privacy Policy பார்க்க' : 'View Privacy Policy'}</Link>
        </div>
      </Card>
    </main>;
  }

  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">{tamil ? 'Account privacy' : 'Account privacy'}</span>
      <h1>{tamil ? 'உங்கள் privacy requests-ஐ நிர்வகிக்கவும்' : 'Manage your privacy requests'}</h1>
      <p>{tamil ? 'உங்கள் தகவலை access செய்ய, திருத்த அல்லது eligible தகவலை நீக்க review request submit செய்யலாம்.' : 'Submit a request to access, correct, or review deletion of eligible personal information.'}</p>
    </section>

    <Card>
      <h2>{tamil ? 'புதிய request' : 'New request'}</h2>
      <p>{tamil ? 'Deletion request account-ஐ உடனடியாக delete செய்யாது. சட்டபூர்வ retention, security, audit மற்றும் unresolved obligations review செய்யப்பட்ட பிறகே eligible deletion process செய்யப்படும்.' : 'A deletion request does not immediately delete your account. Eligible deletion is reviewed against legal retention, security, audit, and unresolved-obligation requirements before processing.'}</p>
      <form onSubmit={submit} className="section-stack">
        <Select label={tamil ? 'Request வகை' : 'Request type'} value={requestType} onChange={(event) => setRequestType(event.target.value as PrivacyRequest['request_type'])}>
          <option value="access">{typeLabel('access')}</option>
          <option value="correction">{typeLabel('correction')}</option>
          <option value="deletion">{typeLabel('deletion')}</option>
        </Select>
        <Textarea label={tamil ? 'Request விவரம்' : 'Request details'} required maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} hint={tamil ? 'எதை access / correct / delete செய்ய வேண்டும் என்பதை தெளிவாக எழுதவும். 10–2000 characters.' : 'Describe what you want us to access, correct, or review for deletion. 10–2000 characters.'} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {success ? <div className="alert alert-success" role="status"><strong>{success}</strong></div> : null}
        <div className="button-row">
          <Button type="submit" loading={submitting}>{tamil ? 'Privacy request submit செய்' : 'Submit privacy request'}</Button>
          <Link className="button button-secondary" href="/privacy">{tamil ? 'Privacy Policy' : 'Privacy Policy'}</Link>
        </div>
      </form>
    </Card>

    <section className="section-stack">
      <div>
        <span className="eyebrow">{tamil ? 'Request history' : 'Request history'}</span>
        <h2>{tamil ? 'உங்கள் requests' : 'Your requests'}</h2>
      </div>
      {loading ? <Card><p>{tamil ? 'Requests load ஆகிறது…' : 'Loading requests…'}</p></Card> : null}
      {!loading && requests.length === 0 ? <Card><p>{tamil ? 'Privacy requests இன்னும் இல்லை.' : 'You have not submitted any privacy requests yet.'}</p></Card> : null}
      {requests.map((item) => <Card key={item.id}>
        <div className="admin-record-top">
          <div>
            <span className="eyebrow">PR-{item.id.slice(0, 8).toUpperCase()}</span>
            <h3>{typeLabel(item.request_type)}</h3>
          </div>
          <Badge tone={statusTone(item.status)}>{humanStatus(item.status)}</Badge>
        </div>
        <p>{item.details}</p>
        <dl className="account-details">
          <div><dt>{tamil ? 'Submitted' : 'Submitted'}</dt><dd>{new Date(item.created_at).toLocaleString(locale)}</dd></div>
          <div><dt>{tamil ? 'Last update' : 'Last update'}</dt><dd>{new Date(item.updated_at).toLocaleString(locale)}</dd></div>
          {item.resolved_at ? <div><dt>{tamil ? 'Resolved' : 'Resolved'}</dt><dd>{new Date(item.resolved_at).toLocaleString(locale)}</dd></div> : null}
        </dl>
        {item.review_note ? <div className="settings-note"><strong>{tamil ? 'Review note' : 'Review note'}</strong><p>{item.review_note}</p></div> : null}
      </Card>)}
    </section>
  </main>;
}
