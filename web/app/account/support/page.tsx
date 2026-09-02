'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Badge, Button, Card, Input, Select, Textarea } from '../../../components/ui/primitives';
import { useOperationalTranslations } from '../../../components/i18n/OperationalTranslations';
import { getCurrentCustomerAsync } from '../../../services/auth-adapter';

type SupportRequest = {
  id: string;
  request_type: 'platform_grievance' | 'account_help' | 'safety' | 'provider_conduct' | 'other';
  subject: string;
  details: string;
  status: 'submitted' | 'in_review' | 'awaiting_information' | 'resolved' | 'closed';
  review_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

async function readRequests(): Promise<SupportRequest[]> {
  const response = await fetch('/api/account/support-requests', { cache: 'no-store', headers: { Accept: 'application/json' } });
  const payload = await response.json() as { requests?: SupportRequest[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Unable to load support requests.');
  return payload.requests ?? [];
}

function tone(status: SupportRequest['status']): 'neutral' | 'success' | 'warning' | 'info' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'awaiting_information') return 'warning';
  return 'info';
}

export default function AccountSupportPage() {
  const { locale } = useOperationalTranslations();
  const tamil = locale === 'ta-IN';
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [requestType, setRequestType] = useState<SupportRequest['request_type']>('platform_grievance');
  const [subject, setSubject] = useState('');
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
        if (auth.authenticated) setRequests(await readRequests());
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load support requests.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const typeLabel = (value: SupportRequest['request_type']) => {
    if (value === 'platform_grievance') return tamil ? 'Platform grievance' : 'Platform grievance';
    if (value === 'account_help') return tamil ? 'Account உதவி' : 'Account help';
    if (value === 'safety') return tamil ? 'Safety concern' : 'Safety concern';
    if (value === 'provider_conduct') return tamil ? 'Provider conduct' : 'Provider conduct';
    return tamil ? 'மற்ற உதவி' : 'Other support';
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true); setError(''); setSuccess('');
      const response = await fetch('/api/account/support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request_type: requestType, subject: subject.trim(), details: details.trim() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to submit support request.');
      setSubject(''); setDetails('');
      setRequests(await readRequests());
      setSuccess(tamil ? 'உங்கள் support request பதிவு செய்யப்பட்டது.' : 'Your support request has been recorded.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit support request.');
    } finally { setSubmitting(false); }
  };

  if (authenticated === null && loading) return <Card><p>{tamil ? 'உங்கள் account-ஐ சரிபார்க்கிறது…' : 'Checking your account…'}</p></Card>;

  if (authenticated === false) return <main className="container section-stack"><Card>
    <h1>{tamil ? 'Platform support-க்கு sign in செய்யவும்' : 'Sign in for platform support'}</h1>
    <p>{tamil ? 'In-app support request submit செய்து status track செய்ய sign in செய்யவும். Sign in செய்ய முடியாவிட்டால் Grievance Officer email fallback பயன்படுத்தலாம்.' : 'Sign in to submit and track an in-app support request. If you cannot sign in, you can still use the Grievance Officer email fallback.'}</p>
    <div className="button-row"><Link href="/login?returnTo=%2Faccount%2Fsupport" className="button button-primary">Sign in</Link><a href="mailto:uandv.com@gmail.com" className="button button-secondary">{tamil ? 'Grievance Officer-க்கு email' : 'Email Grievance Officer'}</a></div>
  </Card></main>;

  return <main className="container section-stack">
    <section className="page-intro"><span className="eyebrow">{tamil ? 'Platform support' : 'Platform support'}</span><h1>{tamil ? 'Support & grievance requests' : 'Support & grievance requests'}</h1><p>{tamil ? 'Booking-க்கு அப்பாற்பட்ட TakeItEsee platform issue, account help, safety concern அல்லது provider conduct concern-ஐ submit செய்து status track செய்யவும்.' : 'Submit and track TakeItEsee platform issues, account help, safety concerns, or provider-conduct concerns that are not booking-specific.'}</p></section>
    <Card>
      <h2>{tamil ? 'புதிய support request' : 'New support request'}</h2>
      <p>{tamil ? 'Booking-specific issue என்றால் அந்த booking detail-ல் உள்ள Get help flow-ஐ பயன்படுத்தவும். Privacy access/correction/deletion review request என்றால் Account privacy workflow-ஐ பயன்படுத்தவும்.' : 'For booking-specific issues, use Get help from that booking. For privacy access, correction, or deletion review, use the Account privacy workflow.'}</p>
      <form className="section-stack" onSubmit={submit}>
        <Select label={tamil ? 'Request வகை' : 'Request type'} value={requestType} onChange={(event) => setRequestType(event.target.value as SupportRequest['request_type'])}>
          <option value="platform_grievance">{typeLabel('platform_grievance')}</option><option value="account_help">{typeLabel('account_help')}</option><option value="safety">{typeLabel('safety')}</option><option value="provider_conduct">{typeLabel('provider_conduct')}</option><option value="other">{typeLabel('other')}</option>
        </Select>
        <Input label={tamil ? 'Subject' : 'Subject'} required minLength={5} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} />
        <Textarea label={tamil ? 'விவரம்' : 'Details'} required maxLength={4000} value={details} onChange={(event) => setDetails(event.target.value)} hint={tamil ? '10–4000 characters. Sensitive payment details அல்லது passwords பகிர வேண்டாம்.' : '10–4000 characters. Do not include passwords or sensitive payment details.'} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}{success ? <div className="alert alert-success" role="status"><strong>{success}</strong></div> : null}
        <div className="button-row"><Button type="submit" loading={submitting}>{tamil ? 'Request submit செய்' : 'Submit request'}</Button><Link href="/account/privacy" className="button button-secondary">{tamil ? 'Privacy requests' : 'Privacy requests'}</Link></div>
      </form>
    </Card>
    <section className="section-stack"><div><span className="eyebrow">{tamil ? 'Request history' : 'Request history'}</span><h2>{tamil ? 'உங்கள் support requests' : 'Your support requests'}</h2></div>
      {loading ? <Card><p>{tamil ? 'Requests load ஆகிறது…' : 'Loading requests…'}</p></Card> : null}
      {!loading && requests.length === 0 ? <Card><p>{tamil ? 'Support requests இன்னும் இல்லை.' : 'You have not submitted any platform support requests yet.'}</p></Card> : null}
      {requests.map((item) => <Card key={item.id}><div className="admin-record-top"><div><span className="eyebrow">SR-{item.id.slice(0, 8).toUpperCase()}</span><h3>{item.subject}</h3></div><Badge tone={tone(item.status)}>{item.status.replaceAll('_', ' ')}</Badge></div><p>{item.details}</p><dl className="account-details"><div><dt>{tamil ? 'Type' : 'Type'}</dt><dd>{typeLabel(item.request_type)}</dd></div><div><dt>{tamil ? 'Submitted' : 'Submitted'}</dt><dd>{new Date(item.created_at).toLocaleString(locale)}</dd></div><div><dt>{tamil ? 'Last update' : 'Last update'}</dt><dd>{new Date(item.updated_at).toLocaleString(locale)}</dd></div></dl>{item.review_note ? <div className="settings-note"><strong>{tamil ? 'Review note' : 'Review note'}</strong><p>{item.review_note}</p></div> : null}</Card>)}
    </section>
  </main>;
}
