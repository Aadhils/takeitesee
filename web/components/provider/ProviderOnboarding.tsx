'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProviderType = 'professional' | 'business';
type ProviderSummary = { id: string; provider_type: ProviderType; display_name: string; location: string; verified: boolean };
type ProviderApplication = {
  id: string; provider_type: ProviderType; display_name: string; description?: string | null; location: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; review_note?: string | null; reviewed_at?: string | null;
  result_provider_id?: string | null; created_at: string; updated_at: string;
};
type OnboardingPayload = { provider?: ProviderSummary | null; providers?: ProviderSummary[]; available_provider_types?: ProviderType[]; applications: ProviderApplication[]; error?: string };

function statusTone(status: ProviderApplication['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'neutral' as const;
}

export function ProviderOnboarding() {
  const { t, locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [form, setForm] = useState({ provider_type: 'professional' as ProviderType, display_name: '', description: '', location: '' });
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/provider/onboarding', { cache: 'no-store' });
      const body = await response.json() as OnboardingPayload;
      if (!response.ok) throw new Error(body.error ?? t('onboarding.loadFallback'));
      setPayload(body);
      const available = body.available_provider_types ?? [];
      if (available.length) {
        const requested = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('type') : null;
        const preferred = (requested === 'professional' || requested === 'business') && available.includes(requested) ? requested : available[0];
        setForm((current) => ({ ...current, provider_type: preferred }));
      }
    } catch (cause) { setPayload(null); setError(cause instanceof Error ? cause.message : t('onboarding.loadFallback')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !acknowledged) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/provider/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { application?: ProviderApplication; error?: string };
      if (!response.ok || !body.application) throw new Error(body.error ?? t('onboarding.submitFallback'));
      setForm((current) => ({ provider_type: current.provider_type, display_name: '', description: '', location: '' }));
      setAcknowledged(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('onboarding.submitFallback')); }
    finally { setBusy(false); }
  };

  const withdraw = async (applicationId: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/provider/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_id: applicationId, action: 'withdraw' }) });
      const body = await response.json() as { application?: ProviderApplication; error?: string };
      if (!response.ok || !body.application) throw new Error(body.error ?? t('onboarding.withdrawFallback'));
      setAcknowledged(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('onboarding.withdrawFallback')); }
    finally { setBusy(false); }
  };

  const statusLabel = (status: ProviderApplication['status']) => status === 'approved' ? t('status.approved') : status === 'rejected' ? t('status.rejected') : status === 'withdrawn' ? t('status.withdrawn') : t('status.pending');

  if (loading) return <div className="auth-page provider-onboarding-page"><section className="page-intro"><span className="eyebrow">{t('onboarding.title')}</span><h1>{t('onboarding.loading')}</h1></section></div>;
  if (!payload && error) {
    const authError = /authentication required/i.test(error);
    return <div className="auth-page provider-onboarding-page">
      <section className="page-intro"><span className="eyebrow">{t('onboarding.title')}</span><h1>{t('onboarding.startProviding')}</h1><p>{t('onboarding.startIntro')}</p></section>
      <Alert title={authError ? t('onboarding.signInRequired') : t('onboarding.unavailable')} tone={authError ? 'info' : 'warning'}>{error}</Alert>
      {authError ? <Card><Link href="/login?returnTo=%2Fprovider%2Fonboarding" className="button button-primary">{t('onboarding.signInApply')}</Link></Card> : <Card><Button type="button" variant="secondary" onClick={() => void load()}>{t('onboarding.tryAgain')}</Button></Card>}
    </div>;
  }

  const providers = payload?.providers ?? (payload?.provider ? [payload.provider] : []);
  const provider = providers[0] ?? null;
  const availableTypes = payload?.available_provider_types ?? [];
  const latest = payload?.applications[0] ?? null;
  const pending = payload?.applications.find((application) => application.status === 'pending') ?? null;
  const previous = latest && latest.status !== 'approved' && latest.status !== 'pending' ? latest : null;
  const canApply = !provider && !pending && availableTypes.length > 0;
  const opposite = provider?.provider_type === 'professional' ? 'Business' : 'Professional';

  return <div className="auth-page provider-onboarding-page">
    <section className="page-intro">
      <span className="eyebrow">{t('onboarding.title')}</span>
      <h1>{provider ? (tamil ? `உங்கள் ${provider.provider_type === 'professional' ? 'Professional' : 'Business'} provider identity.` : `Your ${provider.provider_type === 'professional' ? 'Professional' : 'Business'} provider identity.`) : pending ? (tamil ? 'Provider application review-ல் உள்ளது.' : 'Provider application under review.') : (tamil ? 'உங்கள் Provider identity-ஐ தேர்வு செய்யுங்கள்.' : 'Choose your Provider identity.')}</h1>
      <p>{provider
        ? (tamil ? `இந்த account ${provider.provider_type === 'professional' ? 'Professional' : 'Business'} provider-ஆக பதிவு செய்யப்பட்டுள்ளது. ${opposite} identity-க்கு தனி TakeItEsee account தேவை.` : `This account is registered as a ${provider.provider_type === 'professional' ? 'Professional' : 'Business'} provider. A separate TakeItEsee account is required for a ${opposite} identity.`)
        : pending
          ? (tamil ? 'நீங்கள் ஒரு provider type தேர்வு செய்து விட்டீர்கள். Approval முன் மாற்ற வேண்டுமெனில் இந்த application-ஐ withdraw செய்யலாம்.' : 'You have selected one provider type. Withdraw this application before approval if you need to change that choice.')
          : (tamil ? 'Professional அல்லது Business — இந்த account-க்கு ஒரு Provider identity மட்டும் தேர்வு செய்யலாம்.' : 'Choose either Professional or Business. This account can register only one Provider identity.')}</p>
    </section>

    {error ? <Alert title={t('onboarding.attention')} tone="warning">{error}</Alert> : null}

    {provider ? <div className="section-stack">
      <Card>
        <div className="section-heading"><div><span className="eyebrow">{provider.provider_type === 'business' ? t('onboarding.businessProvider') : t('onboarding.professionalProvider')}</span><h2>{provider.display_name}</h2></div><Badge tone={provider.verified ? 'success' : 'warning'}>{provider.verified ? t('onboarding.verified') : t('onboarding.verificationPending')}</Badge></div>
        <p>{provider.location || t('onboarding.locationUnset')}</p>
        <Alert title={tamil ? 'ஒரு account · ஒரு Provider identity' : 'One account · one Provider identity'} tone="info">{tamil ? `இந்த provider identity active ஆன பிறகு ${opposite} profile-ஐ இதே account-ல் சேர்க்க முடியாது. ${opposite} provider ஆக செயல்பட தனி account பயன்படுத்தவும்.` : `After this Provider identity is active, the same account cannot add a ${opposite} profile. Use a separate account to operate as a ${opposite} provider.`}</Alert>
      </Card>
      <Card><div className="button-row"><Link href="/account#workspaces" className="button button-secondary">{tamil ? 'Profiles & workspaces' : 'Profiles & workspaces'}</Link><Link href="/provider" className="button button-primary">{t('onboarding.openWorkspace')}</Link></div></Card>
    </div> : null}

    {pending && !provider ? <Card>
      <div className="section-heading"><div><span className="eyebrow">{t('onboarding.applicationStatus')}</span><h2>{pending.display_name}</h2></div><Badge tone="warning">{t('onboarding.pendingReview')}</Badge></div>
      <p>{pending.provider_type === 'business' ? t('onboarding.businessProvider') : t('onboarding.professionalProvider')} · {pending.location}</p>
      {pending.description ? <p>{pending.description}</p> : null}
      <p className="summary-note">{tamil ? `இந்த ${pending.provider_type === 'professional' ? 'Professional' : 'Business'} தேர்வு review pending நிலையில் உள்ளது; மற்ற provider type தற்போது lock செய்யப்பட்டுள்ளது.` : `Your ${pending.provider_type === 'professional' ? 'Professional' : 'Business'} choice is pending review; the other provider type is currently locked.`}</p>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void withdraw(pending.id)}>{busy ? t('onboarding.updating') : t('onboarding.withdraw')}</Button>
    </Card> : null}

    {canApply ? <>
      {previous ? <Card><div className="section-heading"><div><span className="eyebrow">{t('onboarding.previous')}</span><h2>{previous.display_name}</h2></div><Badge tone={statusTone(previous.status)}>{statusLabel(previous.status)}</Badge></div>{previous.review_note ? <p><strong>{t('onboarding.platformNote')}:</strong> {previous.review_note}</p> : null}<p className="summary-note">{previous.status === 'rejected' ? t('onboarding.rejectedHelp') : t('onboarding.newHelp')}</p></Card> : null}

      <Card className="auth-card">
        <h2>{tamil ? 'Provider identity application' : 'Provider identity application'}</h2>
        <Alert title={tamil ? 'தேர்வை கவனமாக செய்யுங்கள்' : 'Choose carefully'} tone="warning">{tamil ? 'Approval கிடைத்த பிறகு இந்த account தேர்வு செய்த Provider identity-க்கு lock ஆகும். மற்ற Provider type-க்கு தனி TakeItEsee account தேவை.' : 'After approval, this account is locked to the selected Provider identity. The other Provider type requires a separate TakeItEsee account.'}</Alert>
        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
          <label className="field"><span className="field-label">{t('onboarding.providerType')}</span><select className="field-control" value={form.provider_type} onChange={(event) => { setForm({ ...form, provider_type: event.target.value as ProviderType }); setAcknowledged(false); }}>{availableTypes.map((providerType) => <option value={providerType} key={providerType}>{providerType === 'professional' ? t('onboarding.professionalIndividual') : t('onboarding.businessCompany')}</option>)}</select></label>
          <Input label={form.provider_type === 'business' ? t('onboarding.businessName') : t('onboarding.professionalName')} required maxLength={120} value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
          <Input label={form.provider_type === 'business' ? t('onboarding.businessArea') : t('onboarding.primaryArea')} required maxLength={160} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          <label className="field"><span className="field-label">{t('onboarding.aboutOptional')}</span><textarea className="field-control" rows={5} maxLength={1200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t('onboarding.aboutPlaceholder')} /></label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '.65rem', lineHeight: 1.5 }}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} style={{ marginTop: '.25rem' }} /><span>{tamil ? `இந்த account-ல் ${form.provider_type === 'professional' ? 'Professional' : 'Business'} Provider identity மட்டும் register செய்யப்படும்; மற்ற type-க்கு தனி account தேவை என்பதை புரிந்துகொண்டேன்.` : `I understand this account will register only the ${form.provider_type === 'professional' ? 'Professional' : 'Business'} Provider identity and the other type requires a separate account.`}</span></label>
          <Button type="submit" loading={busy} disabled={!acknowledged || busy}>{t('onboarding.submit')}</Button>
        </form>
      </Card>
    </> : null}

    <Card><p>{t('onboarding.customerStillActive')}</p><Link href="/account" className="text-link">{t('onboarding.backAccount')}</Link></Card>
  </div>;
}
