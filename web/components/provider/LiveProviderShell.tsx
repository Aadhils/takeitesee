'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../ui/primitives';
import { WorkspaceSwitcher } from '../account/WorkspaceSwitcher';
import RoleIdentityMediaHeader from '../identity/RoleIdentityMediaHeader';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type TrustStatus = 'normal' | 'reverification_required' | 'suspended';
type ProviderContext = {
  id: string;
  provider_type: 'business' | 'professional';
  display_name: string;
  initials: string;
  verified: boolean;
  location?: string | null;
  pending_booking_count: number;
  trust_status: TrustStatus;
  trust_reason?: string | null;
};
type ProviderNavLink = { href: string; label: string };
type ProviderNavGroup = { id: string; label: string; links: ProviderNavLink[] };

export function LiveProviderShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { t, locale } = useIdentityWorkspaceTranslations();
  const [provider, setProvider] = useState<ProviderContext | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const tamil = locale.toLowerCase().startsWith('ta');

  const providerNavGroups = useMemo<ProviderNavGroup[]>(() => {
    const groups: ProviderNavGroup[] = [
      {
        id: 'customer-work',
        label: tamil ? 'வாடிக்கையாளர் வேலை' : 'Customer work',
        links: [
          { href: '/provider/leads', label: t('provider.leads') },
          { href: '/provider/messages', label: t('provider.messages') },
          { href: '/provider/bookings', label: t('provider.bookings') },
          { href: '/provider/schedule', label: t('provider.schedule') },
        ],
      },
      {
        id: 'services-trust',
        label: tamil ? 'சேவைகள் & நம்பிக்கை' : 'Services & trust',
        links: [
          { href: '/provider/setup', label: t('provider.setup') },
          { href: '/provider/services', label: t('provider.services') },
          { href: '/provider/verification', label: t('provider.verification') },
          { href: '/provider/reviews', label: t('provider.reviews') },
        ],
      },
    ];

    if (provider?.provider_type === 'professional') {
      groups.push({
        id: 'professional-career',
        label: tamil ? 'Profile & Career' : 'Presence & career',
        links: [
          { href: '/provider/public-readiness', label: tamil ? 'Public profile தயார்நிலை' : 'Public profile readiness' },
          { href: '/provider/portfolio', label: tamil ? 'வேலை Portfolio' : 'Portfolio' },
          { href: '/provider/resume', label: 'Resume & Career' },
          { href: '/provider/jobs', label: 'Jobs & Applications' },
          { href: '/provider/profile', label: t('provider.profile') },
        ],
      });
    }

    if (provider?.provider_type === 'business') {
      groups.push({
        id: 'business-hiring',
        label: tamil ? 'Hiring & Business' : 'Hiring & business',
        links: [
          { href: '/provider/jobs', label: 'Employer Jobs' },
          { href: '/provider/profile', label: t('provider.profile') },
        ],
      });
    }

    groups.push({
      id: 'earnings',
      label: tamil ? 'வருவாய்' : 'Earnings',
      links: [{ href: '/provider/earnings', label: t('provider.earnings') }],
    });

    return groups;
  }, [provider?.provider_type, t, tamil]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/provider/context', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) window.location.replace(`/login?returnTo=${encodeURIComponent(active)}`);
          return null;
        }
        const payload = await response.json() as { provider?: ProviderContext };
        if (!response.ok || !payload.provider) throw new Error('Provider context unavailable.');
        return payload.provider;
      })
      .then((value) => { if (!cancelled && value) setProvider(value); })
      .catch(() => { if (!cancelled) setProvider(null); });
    return () => { cancelled = true; };
  }, [active]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('provider-dashboard-active');
    return () => { document.body.classList.remove('provider-dashboard-active'); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches) return;
    const frame = window.requestAnimationFrame(() => {
      activeLinkRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, locale, provider?.provider_type]);

  const workspaceState = (value: ProviderContext | null) => {
    if (!value) return t('provider.workspace');
    if (value.trust_status === 'suspended') return t('provider.suspended');
    if (value.trust_status === 'reverification_required') return t('provider.reverify');
    return value.verified ? t('provider.verifiedWorkspace') : t('provider.verificationRequired');
  };

  const displayName = provider?.display_name ?? t('provider.workspace');
  const avatar = provider?.initials ?? 'P';
  const pending = provider?.pending_booking_count ?? 0;
  const providerKind = provider ? (provider.provider_type === 'business' ? t('profile.business') : t('profile.professional')) : null;
  const workspaceIdentity = providerKind ? `${providerKind} · ${workspaceState(provider)}` : workspaceState(provider);

  const navLink = (link: ProviderNavLink) => <Link
    ref={active === link.href ? activeLinkRef : undefined}
    href={link.href}
    className={active === link.href ? 'provider-nav-active' : ''}
    aria-current={active === link.href ? 'page' : undefined}
    key={link.href}
  >
    {link.label}
    {link.href === '/provider/bookings' && pending > 0 ? <span className="provider-nav-count">{pending}</span> : null}
  </Link>;

  return <div className="provider-layout">
    <aside className="provider-sidebar">
      <div className="provider-sidebar-heading">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{avatar}</div>
        <div><strong>{displayName}</strong><span>{workspaceIdentity}</span></div>
      </div>
      <WorkspaceSwitcher currentWorkspace={provider?.provider_type} compact />
      <nav aria-label={t('provider.nav')}>
        <div className="provider-nav-groups">
          <div className="provider-nav-overview">
            <span className="provider-nav-section-title">{tamil ? 'மேலோட்டம்' : 'Overview'}</span>
            {navLink({ href: '/provider', label: t('provider.dashboard') })}
          </div>
          {providerNavGroups.map((group) => {
            const activeGroup = group.links.some((link) => active === link.href);
            return <details className="provider-nav-group" open={activeGroup || undefined} key={group.id}>
              <summary aria-label={`${group.label} navigation`}>{group.label}</summary>
              <div className="provider-nav-group-links">{group.links.map(navLink)}</div>
            </details>;
          })}
        </div>
      </nav>
      <Link href="/account#workspaces" className="provider-exit-link">{tamil ? 'என் Profiles' : 'My profiles'}</Link>
      <Link href="/" className="provider-exit-link">{t('provider.viewMarketplace')}</Link>
    </aside>
    <main className="provider-content">
      {active === '/provider' && provider ? <RoleIdentityMediaHeader
        context="provider"
        displayName={provider.display_name}
        subtitle={provider.provider_type === 'business'
          ? (tamil ? 'Business · Service business + Employer' : 'Business · Service business + Employer')
          : (tamil ? 'Professional · Independent provider + Job seeker' : 'Professional · Independent provider + Job seeker')}
        meta={provider.location || (tamil ? 'Service area இன்னும் சேர்க்கப்படவில்லை' : 'Service area not set')}
      /> : null}
      {provider?.trust_status === 'suspended' ? <Alert title={t('provider.suspended')} tone="danger">{t('provider.suspendedBody')} {provider.trust_reason || t('provider.contactSupport')}</Alert> : null}
      {provider?.trust_status === 'reverification_required' ? <Alert title={t('provider.reverify')} tone="warning">{t('provider.reverifyBody')} {provider.trust_reason || ''} <Link href="/provider/verification">{t('provider.openVerification')}</Link></Alert> : null}
      {children}
    </main>
    <style jsx global>{`
      .provider-nav-groups { display: grid; gap: 10px; }
      .provider-nav-overview { display: grid; gap: 4px; }
      .provider-nav-section-title { padding: 0 10px; color: var(--color-ink-muted); font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .provider-nav-group { border-top: 1px solid var(--color-border); padding-top: 8px; }
      .provider-nav-group summary { display: flex; min-height: 34px; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; color: var(--color-ink-muted); cursor: pointer; font-size: .72rem; font-weight: 800; letter-spacing: .03em; list-style: none; }
      .provider-nav-group summary::-webkit-details-marker { display: none; }
      .provider-nav-group summary::after { content: '›'; color: var(--color-primary); font-size: 1rem; line-height: 1; transition: transform .18s ease; }
      .provider-nav-group[open] summary::after { transform: rotate(90deg); }
      .provider-nav-group summary:hover { color: var(--color-primary-strong); }
      .provider-nav-group-links { display: grid; gap: 4px; margin-top: 2px; }
      @media (max-width: 980px) {
        .provider-nav-groups, .provider-nav-overview, .provider-nav-group, .provider-nav-group[open] { display: contents; }
        .provider-nav-section-title, .provider-nav-group summary { display: none; }
        .provider-nav-group > .provider-nav-group-links,
        .provider-nav-group:not([open]) > .provider-nav-group-links,
        .provider-nav-group[open] > .provider-nav-group-links { display: contents !important; }
      }
    `}</style>
  </div>;
}
