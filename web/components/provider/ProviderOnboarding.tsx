'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Card, Input, Radio, Select, Textarea } from '../ui/primitives';

type ProviderType = 'professional' | 'business';

export type OnboardingDraft = {
  providerType: ProviderType;
  displayName: string;
  headline: string;
  city: string;
  category: string;
  experienceYears: string;
  summary: string;
};

export const providerOnboardingStorageKey = 'takeitesee.providerOnboardingDraft';

const emptyDraft: OnboardingDraft = {
  providerType: 'professional',
  displayName: '',
  headline: '',
  city: '',
  category: '',
  experienceYears: '',
  summary: '',
};

const categories = [
  'Home services',
  'Business services',
  'Technology',
  'Education',
  'Health & wellness',
  'Travel & events',
  'Other',
];

export function ProviderOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedType = searchParams.get('type');
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(providerOnboardingStorageKey);
    let nextDraft = { ...emptyDraft };
    if (savedDraft) {
      try {
        nextDraft = { ...nextDraft, ...(JSON.parse(savedDraft) as Partial<OnboardingDraft>) };
      } catch {
        window.localStorage.removeItem(providerOnboardingStorageKey);
      }
    }
    if (requestedType === 'professional' || requestedType === 'business') nextDraft.providerType = requestedType;
    setDraft(nextDraft);
  }, [requestedType]);

  const providerLabel = useMemo(
    () => (draft.providerType === 'professional' ? 'Professional' : 'Business'),
    [draft.providerType],
  );

  const update = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    window.localStorage.setItem(providerOnboardingStorageKey, JSON.stringify(draft));
    setSaved(true);
    setSubmitting(false);
    router.push('/provider');
  };

  return (
    <div className="auth-page provider-onboarding-page">
      <section className="page-intro">
        <span className="eyebrow">Provider onboarding</span>
        <h1>Start offering services on takeitesee.</h1>
        <p>
          Choose how you want to operate, add the basics, and continue to the provider workspace. This development step saves a local onboarding draft only.
        </p>
      </section>

      <Alert title="Safe development mode" tone="info">
        This screen does not create a Supabase role, professional profile, business record, payment account, or verification record yet.
      </Alert>

      <form onSubmit={submit} className="auth-card provider-onboarding-form">
        <Card>
          <span className="badge badge-info">Step 1 of 2</span>
          <h2>How will you provide services?</h2>
          <div className="choice-stack">
            <Radio name="providerType" value="professional" checked={draft.providerType === 'professional'} onChange={() => update('providerType', 'professional')} label="Professional" description="For an individual specialist, freelancer, technician, consultant, or independent service provider." />
            <Radio name="providerType" value="business" checked={draft.providerType === 'business'} onChange={() => update('providerType', 'business')} label="Business" description="For a company, shop, agency, team, clinic, hotel, or other organization offering services." />
          </div>
        </Card>

        <Card>
          <span className="badge badge-info">Step 2 of 2</span>
          <h2>{providerLabel} profile basics</h2>
          <Input label={draft.providerType === 'professional' ? 'Professional name' : 'Business name'} required value={draft.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder={draft.providerType === 'professional' ? 'Your public professional name' : 'Your business name'} />
          <Input label="Headline" required value={draft.headline} onChange={(event) => update('headline', event.target.value)} placeholder="Example: Website developer for small businesses" />
          <div className="form-grid">
            <Input label="City / service area" required value={draft.city} onChange={(event) => update('city', event.target.value)} placeholder="Example: Chennai" />
            <Select label="Primary category" required value={draft.category} onChange={(event) => update('category', event.target.value)}>
              <option value="">Select a category</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </div>
          {draft.providerType === 'professional' ? <Input label="Experience (years)" type="number" min="0" max="80" value={draft.experienceYears} onChange={(event) => update('experienceYears', event.target.value)} placeholder="0" /> : null}
          <Textarea label="About your services" required rows={5} value={draft.summary} onChange={(event) => update('summary', event.target.value)} placeholder="Describe what you offer, who you serve, and the area you cover." />
        </Card>

        {saved ? <Alert tone="success">Onboarding draft saved on this device.</Alert> : null}

        <div className="button-row">
          <Button type="submit" loading={submitting}>Continue to provider workspace</Button>
          <Button type="button" variant="quiet" onClick={() => router.push('/account')}>Back to account</Button>
        </div>
      </form>
    </div>
  );
}
