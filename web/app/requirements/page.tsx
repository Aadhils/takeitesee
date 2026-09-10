'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LocalizedAccountShell from '../../components/account/LocalizedAccountShell';
import CustomerRequirementsManager, { type RequirementPrefill } from '../../components/requirements/CustomerRequirementsManager';
import { parseMarketplaceSearchIntent } from '../../components/discovery/marketplaceSearchIntent';
import { Card, EmptyState } from '../../components/ui/primitives';
import { useOperationalTranslations } from '../../components/i18n/OperationalTranslations';
import { getCurrentCustomerAsync } from '../../services/auth-adapter';

type SearchTaxonomyCategory = { code: string; name: string; aliases?: string[] };

function tidy(value: string, maxLength: number) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalized(value: string) {
  return tidy(value, 180).toLocaleLowerCase();
}

async function readRequirementPrefill(): Promise<RequirementPrefill> {
  const current = new URL(window.location.href);
  let sourceExplore = current.searchParams.get('source') === 'explore';
  let rawSearch = tidy(current.searchParams.get('search') || current.searchParams.get('q') || '', 180);
  let explicitService = tidy(current.searchParams.get('service') || '', 120);
  let explicitLocation = tidy(current.searchParams.get('location') || '', 120);

  if (!sourceExplore && !rawSearch && !explicitService && !explicitLocation && document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin && referrer.pathname === '/explore') {
        sourceExplore = true;
        rawSearch = tidy(referrer.searchParams.get('q') || '', 180);
        explicitLocation = tidy(referrer.searchParams.get('location') || '', 120);
      }
    } catch {
      // Referrer recovery is optional. A normal requirement post remains available.
    }
  }

  if (!sourceExplore && !rawSearch && !explicitService && !explicitLocation) return {};

  const intent = parseMarketplaceSearchIntent(rawSearch);
  const serviceQuery = tidy(explicitService || intent.serviceQuery || rawSearch, 120);
  const location = tidy(explicitLocation || intent.locationQuery, 120);
  let service = serviceQuery;

  if (serviceQuery) {
    try {
      const response = await fetch('/api/marketplace/search-taxonomy', { cache: 'no-store' });
      const payload = await response.json() as { categories?: SearchTaxonomyCategory[] };
      if (response.ok && Array.isArray(payload.categories)) {
        const needle = normalized(serviceQuery);
        const match = payload.categories.find((category) => {
          if (normalized(category.name) === needle || normalized(category.code) === needle) return true;
          return (category.aliases ?? []).some((alias) => normalized(alias) === needle);
        });
        if (match?.name) service = tidy(match.name, 120);
      }
    } catch {
      // Canonical taxonomy enrichment is optional; the editable draft can still use the raw service intent.
    }
  }

  return {
    source: sourceExplore ? 'explore' : undefined,
    search: rawSearch || undefined,
    service: service || undefined,
    location: location || undefined,
  };
}

function requirementReturnTo(prefill: RequirementPrefill) {
  const params = new URLSearchParams();
  if (prefill.source === 'explore') params.set('source', 'explore');
  if (prefill.search) params.set('search', prefill.search);
  if (prefill.service) params.set('service', prefill.service);
  if (prefill.location) params.set('location', prefill.location);
  const query = params.toString();
  return query ? `/requirements?${query}` : '/requirements';
}

export default function RequirementsPage() {
  const { locale } = useOperationalTranslations();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [prefill, setPrefill] = useState<RequirementPrefill>({});
  const [prefillReady, setPrefillReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getCurrentCustomerAsync()
      .then((auth) => { if (active) setAuthenticated(auth.authenticated); })
      .catch(() => { if (active) setAuthenticated(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void readRequirementPrefill()
      .then((value) => { if (active) setPrefill(value); })
      .finally(() => { if (active) setPrefillReady(true); });
    return () => { active = false; };
  }, []);

  if (authenticated === null || !prefillReady) {
    return <Card><p>{locale === 'ta-IN' ? 'உங்கள் account-ஐ சரிபார்க்கிறது…' : 'Checking your account…'}</p></Card>;
  }

  if (!authenticated) {
    const copy = locale === 'ta-IN' ? {
      title: 'தேவையை பதிவிட sign in செய்யவும்',
      help: 'உங்களுக்கு தேவையான சேவையை பதிவிட்டு verified providers-இடமிருந்து proposals பெற உங்கள் account-ல் sign in செய்யவும்.',
      signIn: 'Sign in',
      createAccount: 'Account உருவாக்கவும்',
    } : {
      title: 'Sign in to post a requirement',
      help: 'Sign in to post the service you need and receive proposals from matching verified providers.',
      signIn: 'Sign in',
      createAccount: 'Create account',
    };
    const returnTo = requirementReturnTo(prefill);

    return <div style={{ display: 'grid', gap: '1.25rem' }}>
      <section>
        <span className="eyebrow">{locale === 'ta-IN' ? 'தேவை சந்தை' : 'Requirement marketplace'}</span>
        <h1>{copy.title}</h1>
        <p className="detail-copy">{copy.help}</p>
      </section>
      <Card>
        <EmptyState title={copy.title}>{copy.help}</EmptyState>
        <div className="button-row">
          <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="button button-primary">{copy.signIn}</Link>
          <Link href="/signup" className="button button-secondary">{copy.createAccount}</Link>
        </div>
      </Card>
    </div>;
  }

  return <LocalizedAccountShell active="/requirements">
    <CustomerRequirementsManager prefill={prefill} />
  </LocalizedAccountShell>;
}
