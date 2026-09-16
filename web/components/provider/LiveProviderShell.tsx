'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../ui/primitives';
import { WorkspaceSwitcher } from '../account/WorkspaceSwitcher';
import RoleIdentityMediaHeader from '../identity/RoleIdentityMediaHeader';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import ProviderOfferingDiscoverabilityStatus from './ProviderOfferingDiscoverabilityStatus';

type TrustStatus = 'normal' | 'reverification_required' | 'suspended';
type ProviderContext = {
  id: string;
  provider_type: 'business' | 'professional';
  display_name: string;
  initials: string;
  verified: boolean;
  public_profile_ready: boolean;
  location?: string | null;
  pending_booking_count: number;
  unread_lead_count: number;
  requested_product_order_count: number;
  trust_status: TrustStatus;
  trust_reason?: string | null;
};
type ProviderNavLink = { href: string; label: string };
type ProviderNavGroup = { id: string; label: string; links: ProviderNavLink[] };
type MobileNavIcon = 'home' | 'leads' | 'bookings' | 'messages' | 'profile';

function ProviderMobileNavIcon({ icon }: { icon: MobileNavIcon }) {
  const paths: Record<MobileNavIcon, React.ReactNode> = {
    home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></>,
    leads: <><path d="M12 3 4.5 7.2 12 11.5l7.5-4.3L12 3Z"/><path d="M4.5 12.2 12 16.5l7.5-4.3"/><path d="M4.5 17.2 12 21l7.5-3.8"/></>,
    bookings: <><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M8 3v5M16 3v5M4 10h16"/><path d="m9 15 2 2 4-4"/></>,
    messages: <><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M7.5 10h9M7.5 13.5h6"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  };
  return <svg className="provider-mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[icon]}</svg>;
}

function ProviderSettingsIcon() {
  return <svg className="provider-mobile-settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5L9 6.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.5 3.1h5l.5-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4L18.9 13c.1-.3.1-.7.1-1Z"/></svg>;
}

export function LiveProviderShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { t, locale } = useIdentityWorkspaceTranslations();
  const [provider, setProvider] = useState<ProviderContext | null>(null);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
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
          { href: '/notifications', label: tamil ? 'அறிவிப்புகள்' : 'Notifications' },
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
          { href: '/provider/public-readiness', label: tamil ? 'Public profile தயார்நிலை' : 'Public profile readiness' },
          { href: '/provider/handle', label: 'Public @handle' },
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
          { href: '/provider/products', label: tamil ? 'Products' : 'Products' },
          { href: '/provider/orders', label: tamil ? 'Product orders' : 'Product orders' },
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
    let cancelled = false;
    const refresh = async () => {
      try {
        const [messageResponse, notificationResponse] = await Promise.all([
          fetch('/api/messages?mode=unread-count', { cache: 'no-store' }),
          fetch('/api/notifications?mode=unread-count', { cache: 'no-store' }),
        ]);
        if (cancelled) return;
        if (messageResponse.ok) {
          const payload = await messageResponse.json() as { unread_count?: number };
          if (Number.isFinite(payload.unread_count)) setMessageUnreadCount(Math.max(0, Number(payload.unread_count)));
        }
        if (notificationResponse.ok) {
          const payload = await notificationResponse.json() as { unread_count?: number };
          if (Number.isFinite(payload.unread_count)) setNotificationUnreadCount(Math.max(0, Number(payload.unread_count)));
        }
      } catch {
        // Provider attention badges are progressive enhancement.
      }
    };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('marketplace-messages-attention-refresh', refresh);
    window.addEventListener('notifications-attention-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('marketplace-messages-attention-refresh', refresh);
      window.removeEventListener('notifications-attention-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, []);

  useEffect(() => {
    if (provider?.provider_type !== 'business') return;
    let cancelled = false;
    const refresh = () => {
      void fetch('/api/provider/context', { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() as Promise<{ provider?: ProviderContext }> : null)
        .then((payload) => {
          if (!cancelled && payload?.provider?.provider_type === 'business') setProvider(payload.provider);
        })
        .catch(() => {});
    };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('provider-product-orders-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('provider-product-orders-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, [provider?.provider_type]);

  useEffect(() => {
    const markSeen = () => setProvider((current) => current ? { ...current, unread_lead_count: 0 } : current);
    window.addEventListener('provider-leads-seen', markSeen);
    return () => { window.removeEventListener('provider-leads-seen', markSeen); };
  }, []);

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
  const unreadLeads = provider?.unread_lead_count ?? 0;
  const requestedProductOrders = provider?.requested_product_order_count ?? 0;
  const countLabel = (value: number) => value > 99 ? '99+' : String(value);
  const providerKind = provider ? (provider.provider_type === 'business' ? t('profile.business') : t('profile.professional')) : null;
  const workspaceIdentity = providerKind ? `${providerKind} · ${workspaceState(provider)}` : workspaceState(provider);
  const publicProfileHref = provider?.public_profile_ready && provider.trust_status === 'normal'
    ? provider.provider_type === 'business'
      ? `/businesses/${encodeURIComponent(provider.id)}`
      : `/professionals/${encodeURIComponent(provider.id)}`
    : null;
  const publicProfileLabel = provider?.provider_type === 'business'
    ? (tamil ? 'Public storefront பார்க்க' : 'View public storefront')
    : (tamil ? 'Public profile பார்க்க' : 'View public profile');
  const publicProfileSetupLabel = provider?.provider_type === 'business'
    ? (tamil ? 'Public storefront முடிக்க' : 'Finish public storefront')
    : (tamil ? 'Public profile முடிக்க' : 'Finish public profile');
  const showPublicReadinessLink = Boolean(provider && provider.trust_status === 'normal' && !provider.public_profile_ready);

  const navLink = (link: ProviderNavLink) => <Link
    ref={active === link.href ? activeLinkRef : undefined}
    href={link.href}
    className={active === link.href ? 'provider-nav-active' : ''}
    aria-current={active === link.href ? 'page' : undefined}
    key={link.href}
  >
    {link.label}
    {link.href === '/provider/leads' && unreadLeads > 0 ? <span className="provider-nav-count">{countLabel(unreadLeads)}</span> : null}
    {link.href === '/provider/messages' && messageUnreadCount > 0 ? <span className="provider-nav-count">{countLabel(messageUnreadCount)}</span> : null}
    {link.href === '/notifications' && notificationUnreadCount > 0 ? <span className="provider-nav-count">{countLabel(notificationUnreadCount)}</span> : null}
    {link.href === '/provider/bookings' && pending > 0 ? <span className="provider-nav-count">{countLabel(pending)}</span> : null}
    {link.href === '/provider/orders' && requestedProductOrders > 0 ? <span className="provider-nav-count">{countLabel(requestedProductOrders)}</span> : null}
  </Link>;

  const mobilePrimaryLinks: Array<{ href: string; label: string; icon: MobileNavIcon }> = [
    { href: '/provider', label: t('provider.dashboard'), icon: 'home' },
    { href: '/provider/leads', label: t('provider.leads'), icon: 'leads' },
    { href: '/provider/bookings', label: t('provider.bookings'), icon: 'bookings' },
    { href: '/provider/messages', label: t('provider.messages'), icon: 'messages' },
    { href: '/provider/profile', label: t('provider.profile'), icon: 'profile' },
  ];

  const mobilePrimaryHrefs = new Set(mobilePrimaryLinks.map((link) => link.href));
  const mobileMoreLinks = providerNavGroups.flatMap((group) => group.links).filter((link, index, links) =>
    !mobilePrimaryHrefs.has(link.href) && links.findIndex((candidate) => candidate.href === link.href) === index
  );

  return <div className="provider-layout provider-social-layout">
    <aside className="provider-sidebar provider-desktop-sidebar">
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
      {publicProfileHref ? <Link href={publicProfileHref} target="_blank" rel="noreferrer" className="provider-exit-link">{publicProfileLabel} ↗</Link> : null}
      {showPublicReadinessLink ? <Link href="/provider/public-readiness" className="provider-exit-link">{publicProfileSetupLabel}</Link> : null}
      <Link href="/" className="provider-exit-link">{t('provider.viewMarketplace')}</Link>
    </aside>
    <main className="provider-content">
      {active === '/provider' && provider ? <RoleIdentityMediaHeader
        context="provider"
        displayName={provider.display_name}
        subtitle={provider.provider_type === 'business'
          ? 'Business · Service business + Employer'
          : 'Professional · Independent provider + Job seeker'}
        meta={provider.location || (tamil ? 'Service area இன்னும் சேர்க்கப்படவில்லை' : 'Service area not set')}
      /> : null}

      <section className="provider-mobile-social-shell" aria-label={tamil ? 'Provider விரைவு வழிசெலுத்தல்' : 'Provider quick navigation'}>
        <div className="provider-mobile-identity-line">
          <div className="provider-mobile-identity-copy">
            <strong>{displayName}</strong>
            <span>{workspaceIdentity}</span>
          </div>
          <Link href="/account/settings" className="provider-mobile-settings-link" aria-label={tamil ? 'Account அமைப்புகள்' : 'Account settings'}><ProviderSettingsIcon /></Link>
        </div>
        <nav className="provider-mobile-primary-nav" aria-label={tamil ? 'Provider முக்கிய வழிசெலுத்தல்' : 'Provider primary navigation'}>
          {mobilePrimaryLinks.map((link) => <Link
            href={link.href}
            className={active === link.href ? 'provider-mobile-nav-active' : ''}
            aria-current={active === link.href ? 'page' : undefined}
            key={link.href}
          >
            <ProviderMobileNavIcon icon={link.icon} />
            <span>{link.label}</span>
            {link.href === '/provider/leads' && unreadLeads > 0 ? <em>{countLabel(unreadLeads)}</em> : null}
            {link.href === '/provider/bookings' && pending > 0 ? <em>{countLabel(pending)}</em> : null}
            {link.href === '/provider/messages' && messageUnreadCount > 0 ? <em>{countLabel(messageUnreadCount)}</em> : null}
          </Link>)}
        </nav>
        <details className="provider-mobile-more-tools">
          <summary>{tamil ? 'மேலும் கருவிகள்' : 'More tools'}</summary>
          <div className="provider-mobile-more-grid">
            {mobileMoreLinks.map((link) => <Link href={link.href} className={active === link.href ? 'provider-mobile-more-active' : ''} key={link.href}>
              {link.label}
              {link.href === '/provider/orders' && requestedProductOrders > 0 ? <span className="provider-nav-count">{countLabel(requestedProductOrders)}</span> : null}
              {link.href === '/notifications' && notificationUnreadCount > 0 ? <span className="provider-nav-count">{countLabel(notificationUnreadCount)}</span> : null}
            </Link>)}
            <Link href="/account#workspaces">{tamil ? 'என் Profiles' : 'My profiles'}</Link>
            {publicProfileHref ? <Link href={publicProfileHref} target="_blank" rel="noreferrer">{publicProfileLabel} ↗</Link> : null}
            {showPublicReadinessLink ? <Link href="/provider/public-readiness">{publicProfileSetupLabel}</Link> : null}
            <Link href="/">{t('provider.viewMarketplace')}</Link>
            <Link href="/account/settings">{tamil ? 'Account அமைப்புகள்' : 'Account settings'}</Link>
          </div>
        </details>
      </section>

      {provider?.trust_status === 'suspended' ? <Alert title={t('provider.suspended')} tone="danger">{t('provider.suspendedBody')} {provider.trust_reason || t('provider.contactSupport')}</Alert> : null}
      {provider?.trust_status === 'reverification_required' ? <Alert title={t('provider.reverify')} tone="warning">{t('provider.reverifyBody')} {provider.trust_reason || ''} <Link href="/provider/verification">{t('provider.openVerification')}</Link></Alert> : null}
      {active === '/provider/services' ? <ProviderOfferingDiscoverabilityStatus mode="services" /> : null}
      {active === '/provider/products' ? <ProviderOfferingDiscoverabilityStatus mode="products" /> : null}
      {children}
    </main>
    <style jsx global>{`
      .provider-mobile-social-shell { display: none; }
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

      @media (max-width: 900px) {
        .provider-social-layout { display: block; }
        .provider-desktop-sidebar { display: none !important; }
        .provider-content { width: 100%; }
        .provider-content > .identity-media-header:first-child { margin-top: 0; }
        .provider-mobile-social-shell { position: sticky; top: 70px; z-index: 18; display: grid; gap: 8px; margin: 10px 0 20px; padding: 8px; border: 1px solid var(--color-border); border-radius: 18px; background: rgb(255 255 255 / 95%); box-shadow: 0 10px 30px rgb(29 28 54 / 9%); backdrop-filter: blur(14px); }
        .provider-mobile-identity-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 2px 5px 0; }
        .provider-mobile-identity-copy { min-width: 0; display: grid; gap: 1px; }
        .provider-mobile-identity-copy strong, .provider-mobile-identity-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .provider-mobile-identity-copy strong { color: var(--color-ink); font-size: .82rem; }
        .provider-mobile-identity-copy span { color: var(--color-ink-muted); font-size: .68rem; }
        .provider-mobile-settings-link { flex: 0 0 auto; display: grid; width: 40px; height: 40px; place-items: center; border: 1px solid var(--color-border); border-radius: 50%; background: var(--color-surface); color: var(--color-primary-strong); }
        .provider-mobile-settings-icon { width: 19px; height: 19px; }
        .provider-mobile-primary-nav { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
        .provider-mobile-primary-nav a { position: relative; display: grid; min-width: 0; min-height: 54px; place-items: center; align-content: center; gap: 4px; padding: 5px 2px; border-radius: 12px; color: var(--color-ink-muted); font-size: .61rem; font-weight: 750; line-height: 1.05; text-align: center; }
        .provider-mobile-nav-icon { width: 21px; height: 21px; }
        .provider-mobile-primary-nav a > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .provider-mobile-primary-nav a.provider-mobile-nav-active { background: var(--color-selected); color: var(--color-primary-strong); }
        .provider-mobile-primary-nav em { position: absolute; top: 3px; right: 7px; display: grid; min-width: 16px; height: 16px; place-items: center; padding: 0 3px; border-radius: 999px; background: var(--color-primary); color: #fff; font-size: .58rem; font-style: normal; }
        .provider-mobile-more-tools { border-top: 1px solid var(--color-border); }
        .provider-mobile-more-tools summary { min-height: 32px; padding: 8px 6px 3px; color: var(--color-primary-strong); cursor: pointer; font-size: .72rem; font-weight: 800; list-style: none; }
        .provider-mobile-more-tools summary::-webkit-details-marker { display: none; }
        .provider-mobile-more-tools summary::after { content: ' +'; }
        .provider-mobile-more-tools[open] summary::after { content: ' −'; }
        .provider-mobile-more-grid { display: flex; gap: 6px; overflow-x: auto; padding: 6px 2px 2px; scrollbar-width: none; }
        .provider-mobile-more-grid::-webkit-scrollbar { display: none; }
        .provider-mobile-more-grid a { flex: 0 0 auto; min-height: 34px; display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-ink-muted); font-size: .7rem; font-weight: 700; white-space: nowrap; }
        .provider-mobile-more-grid a.provider-mobile-more-active { border-color: #d8d2ff; background: var(--color-selected); color: var(--color-primary-strong); }
        .provider-mobile-more-grid .provider-nav-count { display: inline-grid; min-width: 17px; height: 17px; place-items: center; padding: 0 4px; border-radius: 999px; background: var(--color-primary); color: #fff; font-size: .58rem; font-weight: 800; line-height: 1; }
      }

      @media (max-width: 390px) {
        .provider-mobile-social-shell { margin-inline: -2px; padding: 7px; border-radius: 16px; }
        .provider-mobile-primary-nav a { min-height: 52px; font-size: .58rem; }
        .provider-mobile-nav-icon { width: 20px; height: 20px; }
      }
    `}</style>
  </div>;
}
