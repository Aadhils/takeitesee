'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../ui/primitives';

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
      if (!response.ok) throw new Error(body.error ?? 'Unable to load provider onboarding.');
      setPayload(body);
    } catch (cause) {
      setPayload(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load provider onboarding.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (!response.ok || !body.application) throw new Error(body.error ?? 'Provider application could not be submitted.');
      setForm({ provider_type: 'professional', display_name: '', description: '', location: '' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Provider application could not be submitted.');
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
      if (!response.ok || !body.application) throw new Error(body.error ?? 'Application could not be withdrawn.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Application could not be withdrawn.');
    } finally {
      setBusy(false);
    }
  };

  const latest = payload?.applications[0] ?? null;
  const pending = payload?.applications.find((application) => application.status === 'pending') ?? null;

  if (loading) return <div className="auth-page provider-onboarding-page"><section className="page-intro"><span className="eyebrow">Provider onboarding</span><h1>Loading your provider status…</h1></section></div>;

  if (!payload && error) {
    const authError = /authentication required/i.test(error);
    return <div className="auth-page provider-onboarding-page">
      <section className="page-intro"><span className="eyebrow">Provider onboarding</span><h1>Start providing services on takeitesee.</h1><p>Provider applications are connected to your customer account and reviewed before provider access is activated.</p></section>
      <Alert title={authError ? 'Sign in required' : 'Onboarding unavailable'} tone={authError ? 'info' : 'warning'}>{error}</Alert>
      {authError ? <Card><Link href="/login?returnTo=%2Fprovider%2Fonboarding" className="button button-primary">Sign in to apply</Link></Card> : <Card><Button type="button" variant="secondary" onClick={() => void load()}>Try again</Button></Card>}
    </div>;
  }

  if (payload?.provider) {
    const provider = payload.provider;
    return <div className="auth-page provider-onboarding-page">
      <section className="page-intro"><span className="eyebrow">Provider onboarding</span><h1>{provider.display_name}</h1><p>Your {provider.provider_type === 'business' ? 'business' : 'professional'} provider ownership is active.</p></section>
      <Card>
        <div className="section-heading"><div><span className="eyebrow">Provider account</span><h2>Workspace access active</h2></div><Badge tone={provider.verified ? 'success' : 'warning'}>{provider.verified ? 'Verified' : 'Verification pending'}</Badge></div>
        <p>{provider.location || 'Service location not set'}</p>
        <p className="summary-note">Provider onboarding approval activates the workspace. Verification is a separate platform review and does not happen automatically.</p>
        <div className="button-row"><Link href="/provider" className="button button-primary">Open provider workspace</Link><Link href="/provider/profile" className="button button-secondary">Review provider profile</Link></div>
      </Card>
    </div>;
  }

  return <div className="auth-page provider-onboarding-page">
    <section className="page-intro"><span className="eyebrow">Provider onboarding</span><h1>Apply to become a provider.</h1><p>Choose how you provide services. Approval creates the provider ownership record; verification remains a separate platform step.</p></section>

    {error ? <Alert title="Action needs attention" tone="warning">{error}</Alert> : null}

    {pending ? <Card>
      <div className="section-heading"><div><span className="eyebrow">Application status</span><h2>{pending.display_name}</h2></div><Badge tone="warning">Pending review</Badge></div>
      <p>{pending.provider_type === 'business' ? 'Business provider' : 'Professional provider'} · {pending.location}</p>
      {pending.description ? <p>{pending.description}</p> : null}
      <p className="summary-note">Your provider role has not been activated yet. Platform review must finish before the provider workspace is enabled.</p>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void withdraw(pending.id)}>{busy ? 'Updating…' : 'Withdraw application'}</Button>
    </Card> : <>
      {latest ? <Card>
        <div className="section-heading"><div><span className="eyebrow">Previous application</span><h2>{latest.display_name}</h2></div><Badge tone={statusTone(latest.status)}>{latest.status}</Badge></div>
        {latest.review_note ? <p><strong>Platform note:</strong> {latest.review_note}</p> : null}
        <p className="summary-note">{latest.status === 'rejected' ? 'You can submit a new application after correcting the information.' : 'You can start a new provider application.'}</p>
      </Card> : null}

      <Card className="auth-card">
        <h2>Provider application</h2>
        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
          <label className="field"><span className="field-label">Provider type</span><select className="field-control" value={form.provider_type} onChange={(event) => setForm({ ...form, provider_type: event.target.value as 'professional' | 'business' })}><option value="professional">Professional / individual</option><option value="business">Business / company</option></select></label>
          <Input label={form.provider_type === 'business' ? 'Business name' : 'Professional display name'} required maxLength={120} value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
          <Input label={form.provider_type === 'business' ? 'Business location / service area' : 'Primary service area'} required maxLength={160} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          <label className="field"><span className="field-label">About your services (optional)</span><textarea className="field-control" rows={5} maxLength={1200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the services you plan to offer" /></label>
          <Alert title="Approval required" tone="info">Submitting this form does not grant provider access. A platform reviewer must approve the application first.</Alert>
          <Button type="submit" loading={busy}>Submit provider application</Button>
        </form>
      </Card>
    </>}

    <Card><p>Want to keep booking as a customer? Your customer account remains active throughout provider onboarding.</p><Link href="/account" className="text-link">Back to account</Link></Card>
  </div>;
}
