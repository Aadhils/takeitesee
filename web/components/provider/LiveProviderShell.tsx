'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const providerLinks = [
  { href: '/provider', label: 'Dashboard' },
  { href: '/provider/bookings', label: 'Bookings' },
  { href: '/provider/schedule', label: 'Schedule' },
  { href: '/provider/services', label: 'Services' },
  { href: '/provider/verification', label: 'Verification' },
  { href: '/provider/earnings', label: 'Earnings' },
  { href: '/provider/reviews', label: 'Reviews' },
  { href: '/provider/profile', label: 'Profile' },
];

type ProviderContext = {
  id: string;
  provider_type: 'business' | 'professional';
  display_name: string;
  initials: string;
  verified: boolean;
  location?: string | null;
  pending_booking_count: number;
};

export function LiveProviderShell({ children, active }: { children: React.ReactNode; active: string }) {
  const [provider, setProvider] = useState<ProviderContext | null>(null);

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

  const displayName = provider?.display_name ?? 'Provider workspace';
  const avatar = provider?.initials ?? 'P';
  const pending = provider?.pending_booking_count ?? 0;

  return <div className="provider-layout">
    <aside className="provider-sidebar">
      <div className="provider-sidebar-heading">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{avatar}</div>
        <div><strong>{displayName}</strong><span>{provider?.verified ? 'Verified provider workspace' : 'Verification required to publish'}</span></div>
      </div>
      <nav aria-label="Provider workspace navigation">
        {providerLinks.map((link) => <Link href={link.href} className={active === link.href ? 'provider-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>
          {link.label}{link.href === '/provider/bookings' && pending > 0 ? <span className="provider-nav-count">{pending}</span> : null}
        </Link>)}
      </nav>
      <Link href="/" className="provider-exit-link">View marketplace</Link>
    </aside>
    <main className="provider-content">{children}</main>
  </div>;
}
