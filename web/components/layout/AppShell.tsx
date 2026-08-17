'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import BackToTop from './BackToTop';
import { getSupabaseBrowserUser, isSupabaseConfigured, localDevelopmentAuthAdapter } from '../../services/auth-adapter';
import type { User } from '../../types/auth-domain';

const primaryLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/categories', label: 'Categories' },
  { href: '/professionals', label: 'Professionals' },
  { href: '/businesses', label: 'Businesses' },
];

const mobileLinks = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/explore', label: 'Explore', icon: '⌕' },
  { href: '/bookings', label: 'Bookings', icon: '▣' },
  { href: '/account', label: 'Account', icon: '◯' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof localDevelopmentAuthAdapter.getCurrentUser>>();
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  useEffect(() => {
    const syncUser = async () => {
      if (isSupabaseConfigured()) {
        const user = await getSupabaseBrowserUser();
        setCurrentUser(user ? { id: user.id, name: user.user_metadata?.name ?? user.email ?? 'Account', email: user.email ?? '', phone: user.user_metadata?.phone, role: 'customer', createdAt: user.created_at, updatedAt: user.updated_at ?? user.created_at } satisfies User : undefined);
      } else setCurrentUser(localDevelopmentAuthAdapter.getCurrentUser());
    };
    window.addEventListener('storage', syncUser);
    syncUser();
    return () => window.removeEventListener('storage', syncUser);
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="shell-bar">
          {!isHomepage ? <Link href="/" className="inner-page-brand" aria-label="Go to TakeItSee home"><img src="/official-takeitesee-logo.png" alt="" /></Link> : null}
          <nav className="desktop-nav" aria-label="Main navigation">
            {primaryLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}>{link.label}</Link>)}
          </nav>
          <div className="header-actions">
            <Link href="/requirements" className="header-requirement">Post a requirement</Link>
            <Link href="/account" className="header-login"><span aria-hidden="true">◯</span> {currentUser ? currentUser.name : 'Account'}</Link>
            <button
              className="menu-trigger"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label="Toggle navigation menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">
            {primaryLinks.map((link) => (
              <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}</Link>
            ))}
            <Link href="/register" className="mobile-menu-join" onClick={() => setMenuOpen(false)}>Create an account</Link>
          </nav>
        ) : null}
      </header>

      <main className="page-frame">{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand-column">
            <Link href="/" className="brand brand-footer"><img className="brand-logo" src="/official-takeitesee-logo.png" alt="TakeItSee" /></Link>
            <p>TakeItSee connects people,<br />professionals and businesses —<br />simply, safely and quickly.</p>
          </div>
          <div className="footer-link-column"><strong>For customers</strong><Link href="/help">How it works</Link><Link href="/help">Safety</Link><Link href="/help">Help &amp; Support</Link></div>
          <div className="footer-link-column"><strong>For professionals</strong><Link href="/register">Join as a professional</Link><Link href="/professionals">Professional resources</Link><Link href="/professionals">Success stories</Link></div>
          <div className="footer-link-column"><strong>For businesses</strong><Link href="/businesses">List your business</Link><Link href="/businesses">Business resources</Link><Link href="/businesses">Partnerships</Link></div>
          <div className="footer-link-column footer-connect"><strong>Connect with us</strong><Link href="/help">Instagram</Link><Link href="/help">LinkedIn</Link><Link href="/help">Contact us</Link></div>
          <div className="footer-legal"><span>© 2026 TakeItSee</span><Link href="/help">Privacy Policy</Link><Link href="/help">Terms of Service</Link><Link href="/help">Cookie Policy</Link></div>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        {mobileLinks.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}>
            <span aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
      <BackToTop />
    </div>
  );
}
