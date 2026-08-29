'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Input, Textarea } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type ProviderProfilePayload = { provider_type: 'professional' | 'business'; id: string; display_name: string; description: string; location: string; verified: boolean; services_total: number; services_active: number; created_at: string; updated_at: string };

export default function ProviderProfileManager() {
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
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? 'Unable to load provider profile.');
      setProfile(payload.profile);
      setForm({ display_name: payload.profile.display_name, description: payload.profile.description, location: payload.profile.location });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load provider profile.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to save provider profile.');
      setNotice('Provider profile saved. Launch readiness has been recalculated.');
      setEditing(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save provider profile.'); }
    finally { setSaving(false); }
  };

  const complete = Boolean(profile && profile.display_name.trim().length >= 2 && profile.description.trim().length >= 20 && profile.location.trim().length >= 2);

  return <LiveProviderShell active="/provider/profile">
    <ProviderHeading eyebrow="Provider profile" title={profile?.display_name ?? 'Profile'} description="Manage the public provider identity used by launch-readiness checks and marketplace presentation." action={profile && !editing ? <Button type="button" onClick={() => setEditing(true)}>Edit profile</Button> : undefined} />
    {error ? <Card><p className="field-error" role="alert">{error}</p></Card> : null}
    {notice ? <Card><p>{notice}</p></Card> : null}
    {loading ? <Card><p>Loading provider profile…</p></Card> : null}

    {profile ? <>
      <div className="provider-review-summary">
        <ProviderDashboardSummary label="Provider type" value={profile.provider_type === 'business' ? 'Business' : 'Professional'} detail="Live account role" tone="info" />
        <ProviderDashboardSummary label="Profile readiness" value={complete ? 'Complete' : 'Needs work'} detail="Name, 20+ character description, and service area" tone={complete ? 'success' : 'warning'} />
        <ProviderDashboardSummary label="Verification" value={profile.verified ? 'Verified' : 'Pending'} detail={profile.verified ? 'Provider verification confirmed' : 'Verification not completed'} tone={profile.verified ? 'success' : 'warning'} />
      </div>

      {editing ? <Card className="provider-profile-card"><form onSubmit={save} className="section-stack">
        <div className="section-heading"><div><span className="eyebrow">Profile editor</span><h2>Public provider details</h2></div><Badge tone={complete ? 'success' : 'warning'}>{complete ? 'Launch-ready profile' : 'Complete required'}</Badge></div>
        <Input label={profile.provider_type === 'business' ? 'Business display name' : 'Professional headline'} value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} required maxLength={120} />
        <Textarea label="Provider description" hint="At least 20 characters are required for marketplace launch readiness." value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={5} />
        <Input label="Service area" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required maxLength={160} />
        <div className="button-row"><Button type="submit" loading={saving}>Save profile</Button><Button type="button" variant="secondary" onClick={() => { setEditing(false); setForm({ display_name: profile.display_name, description: profile.description, location: profile.location }); }}>Cancel</Button></div>
        <p className="summary-note">If a profile becomes incomplete, active services are automatically paused until launch readiness is restored.</p>
      </form></Card> : null}

      {!editing ? <div className="provider-profile-grid">
        <Card className="provider-profile-card"><div className="provider-profile-identity"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{profile.display_name.slice(0, 2).toUpperCase()}</div><div><h2>{profile.display_name}</h2><p>{profile.provider_type === 'business' ? 'Business provider' : 'Professional provider'}</p></div></div><Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? 'Verified' : 'Verification pending'}</Badge><p>{profile.description || 'No provider description has been added yet.'}</p></Card>
        <Card className="provider-profile-card"><span className="eyebrow">Service coverage</span><h2>Provider details</h2><dl className="provider-profile-details"><div><dt>Service area</dt><dd>{profile.location || 'Not specified'}</dd></div><div><dt>Catalog</dt><dd>{profile.services_active} active · {profile.services_total} total</dd></div><div><dt>Member since</dt><dd>{new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div><div><dt>Last updated</dt><dd>{new Date(profile.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div></dl></Card>
      </div> : null}

      <Card className="provider-profile-card"><div className="section-heading"><div><span className="eyebrow">Launch connection</span><h2>Provider setup status</h2></div><Badge tone={complete ? 'success' : 'warning'}>{complete ? 'Profile ready' : 'Action required'}</Badge></div><p>Profile completion is one of the controlled service-launch gates. Category/location approval and verification are checked separately.</p><Link href="/provider/setup" className="text-link">Open provider setup →</Link></Card>
    </> : null}
  </LiveProviderShell>;
}
