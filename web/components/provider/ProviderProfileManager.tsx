'use client';

import { useEffect, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading, ProviderShell } from './ProviderPresentation';

type ProviderProfilePayload = {
  provider_type: 'professional' | 'business';
  id: string;
  display_name: string;
  description: string;
  location: string;
  verified: boolean;
  services_total: number;
  services_active: number;
  created_at: string;
  updated_at: string;
};

export default function ProviderProfileManager() {
  const [profile, setProfile] = useState<ProviderProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/provider/profile', { cache: 'no-store' });
        const payload = await response.json() as { profile?: ProviderProfilePayload; error?: string };
        if (!response.ok || !payload.profile) throw new Error(payload.error ?? 'Unable to load provider profile.');
        setProfile(payload.profile);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load provider profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return <ProviderShell active="/provider/profile">
    <ProviderHeading eyebrow="Provider profile" title={profile?.display_name ?? 'Profile'} description="Live provider identity, verification, service coverage, and catalog summary from your account." />

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {loading ? <Card><p>Loading provider profile…</p></Card> : null}

    {profile ? <>
      <div className="provider-review-summary">
        <ProviderDashboardSummary label="Provider type" value={profile.provider_type === 'business' ? 'Business' : 'Professional'} detail="Live account role" tone="info" />
        <ProviderDashboardSummary label="Verification" value={profile.verified ? 'Verified' : 'Pending'} detail={profile.verified ? 'Provider verification confirmed' : 'Verification not completed'} tone={profile.verified ? 'success' : 'warning'} />
        <ProviderDashboardSummary label="Active services" value={String(profile.services_active)} detail={`${profile.services_total} service${profile.services_total === 1 ? '' : 's'} total`} tone="success" />
      </div>

      <div className="provider-profile-grid">
        <Card className="provider-profile-card">
          <div className="provider-profile-identity">
            <div className="provider-avatar provider-avatar-large" aria-hidden="true">{profile.display_name.slice(0, 2).toUpperCase()}</div>
            <div><h2>{profile.display_name}</h2><p>{profile.provider_type === 'business' ? 'Business provider' : 'Professional provider'}</p></div>
          </div>
          <Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? 'Verified' : 'Verification pending'}</Badge>
          <p>{profile.description || 'No provider description has been added yet.'}</p>
        </Card>

        <Card className="provider-profile-card">
          <span className="eyebrow">Service coverage</span>
          <h2>Provider details</h2>
          <dl className="provider-profile-details">
            <div><dt>Service area</dt><dd>{profile.location || 'Not specified'}</dd></div>
            <div><dt>Catalog</dt><dd>{profile.services_active} active · {profile.services_total} total</dd></div>
            <div><dt>Member since</dt><dd>{new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
            <div><dt>Last updated</dt><dd>{new Date(profile.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
          </dl>
        </Card>
      </div>

      <Card className="provider-profile-card">
        <div className="section-heading"><div><span className="eyebrow">Live profile state</span><h2>Provider account connection</h2></div><Badge tone="success">Supabase connected</Badge></div>
        <p>This page now reads the signed-in provider profile and service counts from the production database. Fixture profile values are no longer used here.</p>
      </Card>
    </> : null}
  </ProviderShell>;
}
