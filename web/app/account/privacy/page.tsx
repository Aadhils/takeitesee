'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import styles from '../../../components/account/CustomerSecurityPrivacyResponsive.module.css';
import { Badge, Button, Card, Select, Textarea } from '../../../components/ui/primitives';
import { useAccountPrivacyTranslations } from '../../../components/i18n/AccountPrivacyTranslations';
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

async function readRequests(loadFallback: string): Promise<PrivacyRequest[]> {
  const response = await fetch('/api/account/privacy-requests', { cache: 'no-store', headers: { Accept: 'application/json' } });
  const payload = await response.json() as { requests?: PrivacyRequest[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? loadFallback);
  return payload.requests ?? [];
}

function statusTone(status: PrivacyRequest['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'declined') return 'danger';
  if (status === 'awaiting_information') return 'warning';
  return 'info';
}

export default function AccountPrivacyPage() {
  const { locale, t } = useAccountPrivacyTranslations();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [requestType, setRequestType] = useState<PrivacyRequest['request_type']>('access');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const loadFallback = t('privacy.loadFallback');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const auth = await getCurrentCustomerAsync();
        if (!active) return;
        setAuthenticated(auth.authenticated);
        if (!auth.authenticated) return;
        const current = await readRequests(loadFallback);
        if (active) setRequests(current);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : loadFallback);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadFallback]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const normalizedDetails = details.trim();
    if (normalizedDetails.length < 10) {
      setError(t('privacy.validation.minDetails'));
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
      if (!response.ok) throw new Error(payload.error ?? t('privacy.submitFallback'));
      setDetails('');
      setRequests(await readRequests(loadFallback));
      setSuccess(t('privacy.success.recorded'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('privacy.submitFallback'));
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = (type: PrivacyRequest['request_type']) => {
    if (type === 'access') return t('privacy.type.access');
    if (type === 'correction') return t('privacy.type.correction');
    return t('privacy.type.deletion');
  };

  const statusLabel = (status: PrivacyRequest['status']) => {
    if (status === 'submitted') return t('privacy.status.submitted');
    if (status === 'in_review') return t('privacy.status.inReview');
    if (status === 'awaiting_information') return t('privacy.status.awaitingInformation');
    if (status === 'completed') return t('privacy.status.completed');
    return t('privacy.status.declined');
  };

  if (authenticated === null && loading) {
    return <div className={styles.securityPrivacyJourney}><Card><p>{t('privacy.checking')}</p></Card></div>;
  }

  if (authenticated === false) {
    return <div className={styles.securityPrivacyJourney}><main className="container section-stack">
      <Card>
        <h1>{t('privacy.auth.title')}</h1>
        <p>{t('privacy.auth.body')}</p>
        <div className="button-row">
          <Link className="button button-primary" href="/login?returnTo=%2Faccount%2Fprivacy">{t('privacy.auth.signIn')}</Link>
          <Link className="button button-secondary" href="/privacy">{t('privacy.auth.viewPolicy')}</Link>
        </div>
      </Card>
    </main></div>;
  }

  return <div className={styles.securityPrivacyJourney}><main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">{t('privacy.eyebrow')}</span>
      <h1>{t('privacy.title')}</h1>
      <p>{t('privacy.intro')}</p>
    </section>

    <Card>
      <h2>{t('privacy.new.title')}</h2>
      <p>{t('privacy.new.deletionNotice')}</p>
      <form onSubmit={submit} className="section-stack">
        <Select label={t('privacy.form.type')} value={requestType} onChange={(event) => setRequestType(event.target.value as PrivacyRequest['request_type'])}>
          <option value="access">{typeLabel('access')}</option>
          <option value="correction">{typeLabel('correction')}</option>
          <option value="deletion">{typeLabel('deletion')}</option>
        </Select>
        <Textarea label={t('privacy.form.details')} required maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} hint={t('privacy.form.hint')} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {success ? <div className="alert alert-success" role="status"><strong>{success}</strong></div> : null}
        <div className="button-row">
          <Button type="submit" loading={submitting}>{t('privacy.form.submit')}</Button>
          <Link className="button button-secondary" href="/privacy">{t('privacy.form.policy')}</Link>
        </div>
      </form>
    </Card>

    <section className="section-stack">
      <div>
        <span className="eyebrow">{t('privacy.history.eyebrow')}</span>
        <h2>{t('privacy.history.title')}</h2>
      </div>
      {loading ? <Card><p>{t('privacy.history.loading')}</p></Card> : null}
      {!loading && requests.length === 0 ? <Card><p>{t('privacy.history.empty')}</p></Card> : null}
      {requests.map((item) => <Card key={item.id}>
        <div className="admin-record-top">
          <div>
            <span className="eyebrow">PR-{item.id.slice(0, 8).toUpperCase()}</span>
            <h3>{typeLabel(item.request_type)}</h3>
          </div>
          <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
        </div>
        <p>{item.details}</p>
        <dl className="account-details">
          <div><dt>{t('privacy.meta.submitted')}</dt><dd>{new Date(item.created_at).toLocaleString(locale)}</dd></div>
          <div><dt>{t('privacy.meta.lastUpdate')}</dt><dd>{new Date(item.updated_at).toLocaleString(locale)}</dd></div>
          {item.resolved_at ? <div><dt>{t('privacy.meta.resolved')}</dt><dd>{new Date(item.resolved_at).toLocaleString(locale)}</dd></div> : null}
        </dl>
        {item.review_note ? <div className="settings-note"><strong>{t('privacy.meta.reviewNote')}</strong><p>{item.review_note}</p></div> : null}
      </Card>)}
    </section>
  </main></div>;
}
