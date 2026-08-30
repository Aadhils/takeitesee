'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Input, Textarea } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type ProviderProfilePayload = { provider_type: 'professional' | 'business'; id: string; display_name: string; description: string; location: string; verified: boolean; services_total: number; services_active: number; created_at: string; updated_at: string };

export default function ProviderProfileManager() {
  const { locale, t } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<ProviderProfilePayload | null>(null);
  const [form, setForm] = useState({ display_name: '', description: '', location: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const response = await fetch('/api/provider/profile', { cache: 'no-store' });
      const payload = await response.json() as { profile?: ProviderProfilePayload; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? t('profile.loadFallback'));
      setProfile(payload.profile);
      setForm({ display_name: payload.profile.display_name, description: payload.profile.description, location: payload.profile.location });
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('profile.loadFallback')); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('profile.saveFallback'));
      setNotice(t('profile.saved'));
      setEditing(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('profile.saveFallback')); }
    finally { setSaving(false); }
  };

  const complete = Boolean(profile && profile.display_name.trim().length >= 2 && profile.description.trim().length >= 20 && profile.location.trim().length >= 2);

  return <LiveProviderShell active="/provider/profile">
    <ProviderHeading eyebrow={t('profile.eyebrow')} title={profile?.display_name ?? t('profile.titleFallback')} description={t('profile.description')} action={profile && !editing ? <Button type="button" onClick={() => setEditing(true)}>{t('profile.edit')}</Button> : undefined} />
    {error ? <Card><p className="field-error" role="alert">{error}</p></Card> : null}
    {notice ? <Card><p>{notice}</p></Card> : null}
    {loading ? <Card><p>{t('profile.loading')}</p></Card> : null}

    {profile ? <>
      <div className="provider-review-summary">
        <ProviderDashboardSummary label={t('profile.type')} value={profile.provider_type === 'business' ? t('profile.business') : t('profile.professional')} detail={t('profile.liveRole')} tone="info" />
        <ProviderDashboardSummary label={t('profile.readiness')} value={complete ? t('profile.complete') : t('profile.needsWork')} detail={t('profile.readinessDetail')} tone={complete ? 'success' : 'warning'} />
        <ProviderDashboardSummary label={t('profile.verification')} value={profile.verified ? t('profile.verified') : t('profile.pending')} detail={profile.verified ? t('profile.verificationConfirmed') : t('profile.verificationIncomplete')} tone={profile.verified ? 'success' : 'warning'} />
      </div>

      {editing ? <Card className="provider-profile-card"><form onSubmit={save} className="section-stack">
        <div className="section-heading"><div><span className="eyebrow">{t('profile.editor')}</span><h2>{t('profile.publicDetails')}</h2></div><Badge tone={complete ? 'success' : 'warning'}>{complete ? t('profile.launchReady') : t('profile.completeRequired')}</Badge></div>
        <Input label={profile.provider_type === 'business' ? t('profile.businessDisplayName') : t('profile.professionalHeadline')} value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} required maxLength={120} />
        <Textarea label={t('profile.providerDescription')} hint={t('profile.descriptionHint')} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={5} />
        <Input label={t('profile.serviceArea')} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required maxLength={160} />
        <div className="button-row"><Button type="submit" loading={saving}>{t('profile.save')}</Button><Button type="button" variant="secondary" onClick={() => { setEditing(false); setForm({ display_name: profile.display_name, description: profile.description, location: profile.location }); }}>{t('profile.cancel')}</Button></div>
        <p className="summary-note">{t('profile.incompleteWarning')}</p>
      </form></Card> : null}

      {!editing ? <div className="provider-profile-grid">
        <Card className="provider-profile-card"><div className="provider-profile-identity"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{profile.display_name.slice(0, 2).toUpperCase()}</div><div><h2>{profile.display_name}</h2><p>{profile.provider_type === 'business' ? t('profile.businessProvider') : t('profile.professionalProvider')}</p></div></div><Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? t('profile.verified') : t('profile.verificationPending')}</Badge><p>{profile.description || t('profile.noDescription')}</p></Card>
        <Card className="provider-profile-card"><span className="eyebrow">{t('profile.coverage')}</span><h2>{t('profile.details')}</h2><dl className="provider-profile-details"><div><dt>{t('profile.serviceArea')}</dt><dd>{profile.location || t('profile.notSpecified')}</dd></div><div><dt>{t('profile.catalog')}</dt><dd>{profile.services_active} {t('profile.active')} · {profile.services_total} {t('profile.total')}</dd></div><div><dt>{t('profile.memberSince')}</dt><dd>{new Date(profile.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div><div><dt>{t('profile.lastUpdated')}</dt><dd>{new Date(profile.updated_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div></dl></Card>
      </div> : null}

      <Card className="provider-profile-card"><div className="section-heading"><div><span className="eyebrow">{t('profile.launchConnection')}</span><h2>{t('profile.setupStatus')}</h2></div><Badge tone={complete ? 'success' : 'warning'}>{complete ? t('profile.ready') : t('profile.actionRequired')}</Badge></div><p>{t('profile.launchGateHelp')}</p><Link href="/provider/setup" className="text-link">{t('profile.openSetup')}</Link></Card>
    </> : null}
  </LiveProviderShell>;
}
