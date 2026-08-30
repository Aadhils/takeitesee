'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProviderSummary = {
  id: string;
  provider_type: 'professional' | 'business';
  display_name: string;
  location: string;
  verified: boolean;
};

type ProviderApplication = {
  id: string;
  provider_type: 'professional' | 'business';
  display_name: string;
  description?: string | null;
  location: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  review_note?: string | null;
  reviewed_at?: string | null;
  result_provider_id?: string | null;
  created_at: string;
  updated_at: string;
};

type OnboardingPayload = { provider: ProviderSummary | null; applications: ProviderApplication[]; error?: string };

function statusTone(status: ProviderApplication['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'neutral' as const;
}

export function ProviderOnboarding() {
  const { t } = useIdentityWorkspaceTranslations();
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [form, setForm] = useState({ provider_type: 'professional' as 'professional' | 'business', display_name: '', description: '', location: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/onboarding', { cache: 'no-store' });
      const body = await response.json() as OnboardingPayload;
      if (!response.ok) throw new Error(body.error ?? t('onboarding.loadFallback'));
      setPayload(body);
    } catch (cause) {
      setPayload(null);
      setError(cause instanceof Error ? cause.message : t('onboarding.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/provider/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json() as { application?: ProviderApplication; error?: string };
      if (!response.ok || !body.application) throw new Error(body.error ?? t('onboarding.submitFallback'));
      setForm({ provider_type: 'professional', display_name: '', description: '', location: '' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('onboarding.submitFallback'));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (applicationId: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/provider/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId, action: 'withdraw' }),
      });
      const body = await response.json() as { application?: ProviderApplication; error?: string };
      if (!response.ok || !body.application) throw new Error(body.error ?? t('onboarding.withdrawFallback'));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('onboarding.withdrawFallback'));
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: ProviderApplication['status']) => {
    if (status === 'approved') return t('status.approved');
    if (status === 'rejected') return t('status.rejected');
    if (status === 'withdrawn') return t('status.withdrawn');
    return t('status.pending');
  };

  const latest = payload?.applications[0] ?? null;
  const pending = payload?.applications.find((application) => application.status === 'pending') ?? null;

  if (loading) return <div className="auth-page provider-onboarding-page"><section className="page-intro"><span className="eyebrow">{t('onboarding.title')}</span><h1>{t('onboarding.loading')}</h1></section></div>;

  if (!payload && error) {
    const authError = /authentication required/i.test(error);
    return <div className="auth-page provider-onboarding-page">
      <section className="page-intro"><span className="eyebrow">{t('onboarding.title')}</span><h1>{t('onboarding.startProviding')}</h1><p>{t('onboarding.startIntro')}</p></section>
      <Alert title={authError ? t('onboarding.signInRequired') : t('onboarding.unavailable')} tone={authError ? 'info' : 'warning'}>{error}</Alert>
      {authError ? <Card><Link href="/login?returnTo=%2Fprovider%2Fonboarding" className="button button-primary">{t('onboarding.signInApply')}</Link></Card> : <Card><Button type="button" variant="secondary" onClick={() => void load()}>{t('onboarding.tryAgain')}</Button></Card>}
    </div>;
  }

  if (payload?.provider) {
    const provider = payload.provider;
    return <div className="auth-page provider-onboarding-page">
      <section className="page-intro"><span className="eyebrow">{t('onboarding.title')}</span><h1>{provider.display_name}</h1><p>{provider.provider_type === 'business' ? t('onboarding.ownershipBusiness') : t('onboarding.ownershipProfessional')}</p></section>
      <Card>
        <div className="section-heading"><div><span className="eyebrow">{t('onboarding.providerAccount')}</span><h2>{t('onboarding.workspaceActive')}</h2></div><Badge tone={provider.verified ? 'success' : 'warning'}>{provider.verified ? t('onboarding.verified') : t('onboarding.verificationPending')}</Badge></div>
        <p>{provider.location || t('onboarding.locationUnset')}</p>
        <p className="summary-note">{t('onboarding.approvalHelp')}</p>
        <div className="button-row"><Link href="/provider" className="button button-primary">{t('onboarding.openWorkspace')}</Link><Link href="/provider/profile" className="button button-secondary">{t('onboarding.reviewProfile')}</Link></div>
      </Card>
    </div>;
  }

  return <div className="auth-page provider-onboarding-page">
    <section className="page-intro"><span className="eyebrow">{t('onboarding.title')}</span><h1>{t('onboarding.applyTitle')}</h1><p>{t('onboarding.applyIntro')}</p></section>

    {error ? <Alert title={t('onboarding.attention')} tone="warning">{error}</Alert> : null}

    {pending ? <Card>
      <div className="section-heading"><div><span className="eyebrow">{t('onboarding.applicationStatus')}</span><h2>{pending.display_name}</h2></div><Badge tone="warning">{t('onboarding.pendingReview')}</Badge></div>
      <p>{pending.provider_type === 'business' ? t('onboarding.businessProvider') : t('onboarding.professionalProvider')} · {pending.location}</p>
      {pending.description ? <p>{pending.description}</p> : null}
      <p className="summary-note">{t('onboarding.pendingHelp')}</p>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void withdraw(pending.id)}>{busy ? t('onboarding.updating') : t('onboarding.withdraw')}</Button>
    </Card> : <>
      {latest ? <Card>
        <div className="section-heading"><div><span className="eyebrow">{t('onboarding.previous')}</span><h2>{latest.display_name}</h2></div><Badge tone={statusTone(latest.status)}>{statusLabel(latest.status)}</Badge></div>
        {latest.review_note ? <p><strong>{t('onboarding.platformNote')}:</strong> {latest.review_note}</p> : null}
        <p className="summary-note">{latest.status === 'rejected' ? t('onboarding.rejectedHelp') : t('onboarding.newHelp')}</p>
      </Card> : null}

      <Card className="auth-card">
        <h2>{t('onboarding.application')}</h2>
        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
          <label className="field"><span className="field-label">{t('onboarding.providerType')}</span><select className="field-control" value={form.provider_type} onChange={(event) => setForm({ ...form, provider_type: event.target.value as 'professional' | 'business' })}><option value="professional">{t('onboarding.professionalIndividual')}</option><option value="business">{t('onboarding.businessCompany')}</option></select></label>
          <Input label={form.provider_type === 'business' ? t('onboarding.businessName') : t('onboarding.professionalName')} required maxLength={120} value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
          <Input label={form.provider_type === 'business' ? t('onboarding.businessArea') : t('onboarding.primaryArea')} required maxLength={160} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          <label className="field"><span className="field-label">{t('onboarding.aboutOptional')}</span><textarea className="field-control" rows={5} maxLength={1200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t('onboarding.aboutPlaceholder')} /></label>
          <Alert title={t('onboarding.approvalRequired')} tone="info">{t('onboarding.approvalWarning')}</Alert>
          <Button type="submit" loading={busy}>{t('onboarding.submit')}</Button>
        </form>
      </Card>
    </>}

    <Card><p>{t('onboarding.customerStillActive')}</p><Link href="/account" className="text-link">{t('onboarding.backAccount')}</Link></Card>
  </div>;
}
