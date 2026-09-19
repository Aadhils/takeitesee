'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import LocalizedAccountShell from '../../../components/account/LocalizedAccountShell';
import styles from '../../../components/account/CustomerSupportSafetyResponsive.module.css';
import { Badge, Button, Card, Input, Select, Textarea } from '../../../components/ui/primitives';
import { useAccountSupportTranslations } from '../../../components/i18n/AccountSupportTranslations';
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

async function readRequests(fallbackMessage: string): Promise<SupportRequest[]> {
  const response = await fetch('/api/account/support-requests', { cache: 'no-store', headers: { Accept: 'application/json' } });
  const payload = await response.json() as { requests?: SupportRequest[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? fallbackMessage);
  return payload.requests ?? [];
}

function tone(status: SupportRequest['status']): 'neutral' | 'success' | 'warning' | 'info' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'awaiting_information') return 'warning';
  return 'info';
}

export default function AccountSupportPage() {
  const { locale, t } = useAccountSupportTranslations();
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
        if (auth.authenticated) setRequests(await readRequests(t('support.loadFallback')));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t('support.loadFallback'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [t]);

  const typeLabel = (value: SupportRequest['request_type']) => {
    if (value === 'platform_grievance') return t('support.type.platformGrievance');
    if (value === 'account_help') return t('support.type.accountHelp');
    if (value === 'safety') return t('support.type.safety');
    if (value === 'provider_conduct') return t('support.type.providerConduct');
    return t('support.type.other');
  };

  const statusLabel = (value: SupportRequest['status']) => {
    if (value === 'submitted') return t('support.status.submitted');
    if (value === 'in_review') return t('support.status.inReview');
    if (value === 'awaiting_information') return t('support.status.awaitingInformation');
    if (value === 'resolved') return t('support.status.resolved');
    return t('support.status.closed');
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
      if (!response.ok) throw new Error(payload.error ?? t('support.submitFallback'));
      setSubject(''); setDetails('');
      setRequests(await readRequests(t('support.loadFallback')));
      setSuccess(t('support.success.recorded'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('support.submitFallback'));
    } finally { setSubmitting(false); }
  };

  if (authenticated === null && loading) return <div className={styles.supportSafetyJourney}><Card><p>{t('support.checking')}</p></Card></div>;

  if (authenticated === false) return <div className={styles.supportSafetyJourney}><main className="container section-stack"><Card>
    <h1>{t('support.auth.title')}</h1>
    <p>{t('support.auth.body')}</p>
    <div className="button-row"><Link href="/login?returnTo=%2Faccount%2Fsupport" className="button button-primary">{t('support.auth.signIn')}</Link><a href="mailto:uandv.com@gmail.com" className="button button-secondary">{t('support.auth.emailOfficer')}</a></div>
  </Card></main></div>;

  return <div className={styles.supportSafetyJourney}><LocalizedAccountShell active="/account/support">
    <div className="section-stack">
      <section className="page-intro"><span className="eyebrow">{t('support.eyebrow')}</span><h1>{t('support.title')}</h1><p>{t('support.intro')}</p></section>
      <Card>
        <h2>{t('support.new.title')}</h2>
        <p>{t('support.new.boundary')}</p>
        <form className="section-stack" onSubmit={submit}>
          <Select label={t('support.form.type')} value={requestType} onChange={(event) => setRequestType(event.target.value as SupportRequest['request_type'])}>
            <option value="platform_grievance">{typeLabel('platform_grievance')}</option><option value="account_help">{typeLabel('account_help')}</option><option value="safety">{typeLabel('safety')}</option><option value="provider_conduct">{typeLabel('provider_conduct')}</option><option value="other">{typeLabel('other')}</option>
          </Select>
          <Input label={t('support.form.subject')} required minLength={5} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} />
          <Textarea label={t('support.form.details')} required maxLength={4000} value={details} onChange={(event) => setDetails(event.target.value)} hint={t('support.form.hint')} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}{success ? <div className="alert alert-success" role="status"><strong>{success}</strong></div> : null}
          <div className="button-row"><Button type="submit" loading={submitting}>{t('support.form.submit')}</Button><Link href="/account/privacy" className="button button-secondary">{t('support.form.privacy')}</Link></div>
        </form>
      </Card>
      <section className="section-stack"><div><span className="eyebrow">{t('support.history.eyebrow')}</span><h2>{t('support.history.title')}</h2></div>
        {loading ? <Card><p>{t('support.history.loading')}</p></Card> : null}
        {!loading && requests.length === 0 ? <Card><p>{t('support.history.empty')}</p></Card> : null}
        {requests.map((item) => <Card key={item.id}><div className="admin-record-top"><div><span className="eyebrow">SR-{item.id.slice(0, 8).toUpperCase()}</span><h3>{item.subject}</h3></div><Badge tone={tone(item.status)}>{statusLabel(item.status)}</Badge></div><p>{item.details}</p><dl className="account-details"><div><dt>{t('support.meta.type')}</dt><dd>{typeLabel(item.request_type)}</dd></div><div><dt>{t('support.meta.submitted')}</dt><dd>{new Date(item.created_at).toLocaleString(locale)}</dd></div><div><dt>{t('support.meta.lastUpdate')}</dt><dd>{new Date(item.updated_at).toLocaleString(locale)}</dd></div></dl>{item.review_note ? <div className="settings-note"><strong>{t('support.meta.reviewNote')}</strong><p>{item.review_note}</p></div> : null}</Card>)}
      </section>
    </div>
  </LocalizedAccountShell></div>;
}
