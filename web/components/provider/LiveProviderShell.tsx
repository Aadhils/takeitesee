'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../ui/primitives';
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

export function LiveProviderShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { t, locale } = useIdentityWorkspaceTranslations();
  const [provider, setProvider] = useState<ProviderContext | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const providerLinks = useMemo(() => {
    const tamil = locale.toLowerCase().startsWith('ta');
    const links = [
      { href: '/provider', label: t('provider.dashboard') },
      { href: '/provider/setup', label: t('provider.setup') },
      { href: '/provider/leads', label: t('provider.leads') },
      { href: '/provider/messages', label: t('provider.messages') },
      { href: '/provider/bookings', label: t('provider.bookings') },
      { href: '/provider/schedule', label: t('provider.schedule') },
      { href: '/provider/services', label: t('provider.services') },
      { href: '/provider/verification', label: t('provider.verification') },
      { href: '/provider/earnings', label: t('provider.earnings') },
      { href: '/provider/reviews', label: t('provider.reviews') },
    ];
    if (provider?.provider_type === 'professional') {
      links.push({ href: '/provider/portfolio', label: tamil ? 'வேலை Portfolio' : 'Portfolio' });
      links.push({ href: '/provider/resume', label: 'Resume & Career' });
      links.push({ href: '/provider/jobs', label: tamil ? 'Jobs & Applications' : 'Jobs & Applications' });
    }
    if (provider?.provider_type === 'business') {
      links.push({ href: '/provider/jobs', label: tamil ? 'Employer Jobs' : 'Employer Jobs' });
    }
    links.push({ href: '/provider/profile', label: t('provider.profile') });
    return links;
  }, [locale, provider?.provider_type, t]);

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

  return <div className="provider-layout">
    <aside className="provider-sidebar">
      <div className="provider-sidebar-heading">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{avatar}</div>
        <div><strong>{displayName}</strong><span>{workspaceState(provider)}</span></div>
      </div>
      <nav aria-label={t('provider.nav')}>
        {providerLinks.map((link) => <Link ref={active === link.href ? activeLinkRef : undefined} href={link.href} className={active === link.href ? 'provider-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>
          {link.label}{link.href === '/provider/bookings' && pending > 0 ? <span className="provider-nav-count">{pending}</span> : null}
        </Link>)}
      </nav>
      <Link href="/" className="provider-exit-link">{t('provider.viewMarketplace')}</Link>
    </aside>
    <main className="provider-content">
      {provider?.trust_status === 'suspended' ? <Alert title={t('provider.suspended')} tone="danger">{t('provider.suspendedBody')} {provider.trust_reason || t('provider.contactSupport')}</Alert> : null}
      {provider?.trust_status === 'reverification_required' ? <Alert title={t('provider.reverify')} tone="warning">{t('provider.reverifyBody')} {provider.trust_reason || ''} <Link href="/provider/verification">{t('provider.openVerification')}</Link></Alert> : null}
      {children}
    </main>
  </div>;
}
