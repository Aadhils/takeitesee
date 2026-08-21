'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
import { ProviderDashboard } from './ProviderPresentation';
import { providerOnboardingStorageKey, type OnboardingDraft } from './ProviderOnboarding';

export default function ProviderDashboardEntry() {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(providerOnboardingStorageKey);
    if (!raw) return;
    try {
      setDraft(JSON.parse(raw) as OnboardingDraft);
    } catch {
      window.localStorage.removeItem(providerOnboardingStorageKey);
    }
  }, []);

  return (
    <>
      {draft ? (
        <div className="provider-draft-banner">
          <Card>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Onboarding draft</span>
                <h2>{draft.displayName || 'Provider profile draft'}</h2>
              </div>
              <Badge tone="warning">Local draft</Badge>
            </div>
            <p>{draft.headline || 'Complete your provider headline to describe what you offer.'}</p>
            <div className="provider-profile-services">
              <div><strong>Provider type</strong><span>{draft.providerType === 'business' ? 'Business' : 'Professional'}</span></div>
              <div><strong>Service area</strong><span>{draft.city || 'Not added'}</span></div>
              <div><strong>Primary category</strong><span>{draft.category || 'Not selected'}</span></div>
            </div>
            <div className="account-actions">
              <Link href={`/provider/onboarding?type=${draft.providerType}`} className="button button-secondary">Edit onboarding draft</Link>
              <Link href="/provider/profile" className="button button-quiet">Preview provider profile</Link>
            </div>
            <p className="provider-fixture-note">This draft exists only in this browser. No live provider role, verification, or payment setup has been created.</p>
          </Card>
        </div>
      ) : (
        <div className="provider-draft-banner">
          <Card>
            <span className="eyebrow">Provider onboarding</span>
            <h2>Set up your provider identity.</h2>
            <p>Choose Professional or Business and save a development draft before connecting live provider roles.</p>
            <div className="account-actions">
              <Link href="/provider/onboarding?type=professional" className="button button-primary">Become a Professional</Link>
              <Link href="/provider/onboarding?type=business" className="button button-secondary">Register a Business</Link>
            </div>
          </Card>
        </div>
      )}
      <ProviderDashboard />
    </>
  );
}
