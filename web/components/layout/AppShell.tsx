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
          {!isHomepage ? <Link href="/" className="inner-page-brand" aria-label="Go to takeitesee home"><img src="/official-takeitesee-logo.png" alt="" /></Link> : null}
          <nav className="desktop-nav" aria-label="Main navigation">
            {primaryLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}>{link.label}</Link>)}
          </nav>
          <div className="header-actions">
            <Link href="/requirements" className="header-requirement">Post a requirement</Link>
            <Link href="/account" className="header-login"><span aria-hidden="true">◯</span> {currentUser ? currentUser.name : 'Account'}</Link>
            <button className="menu-trigger" type="button" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label="Toggle navigation menu" onClick={() => setMenuOpen((value) => !value)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">
            {primaryLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}
            <Link href="/register" className="mobile-menu-join" onClick={() => setMenuOpen(false)}>Create an account</Link>
          </nav>
        ) : null}
      </header>

      <main className="page-frame">{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand-column">
            <Link href="/" className="brand brand-footer"><img className="brand-logo" src="/official-takeitesee-logo.png" alt="takeitesee" /></Link>
            <p>takeitesee connects people,<br />professionals and businesses —<br />simply, safely and quickly.</p>
          </div>
          <div className="footer-link-column"><strong>For customers</strong><Link href="/help">How it works</Link><Link href="/help">Safety</Link><Link href="/help">Help &amp; Support</Link></div>
          <div className="footer-link-column"><strong>For professionals</strong><Link href="/register">Join as a professional</Link><Link href="/professionals">Professional resources</Link><Link href="/professionals">Success stories</Link></div>
          <div className="footer-link-column"><strong>For businesses</strong><Link href="/businesses">List your business</Link><Link href="/businesses">Business resources</Link><Link href="/businesses">Partnerships</Link></div>
          <div className="footer-link-column footer-connect"><strong>Connect with us</strong><Link href="/help">Instagram</Link><Link href="/help">LinkedIn</Link><Link href="/help">Contact us</Link></div>
          <div className="footer-legal"><span>© 2026 takeitesee</span><Link href="/help">Privacy Policy</Link><Link href="/help">Terms of Service</Link><Link href="/help">Cookie Policy</Link></div>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        {mobileLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}><span aria-hidden="true">{link.icon}</span><span>{link.label}</span></Link>)}
      </nav>
      <BackToTop />

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; }
        img, svg, video, canvas { max-width: 100%; height: auto; }
        .page-frame, .shell-bar, .footer-inner { min-width: 0; }
        .page-intro h1, .account-page-heading h1, .provider-workspace h1 { overflow-wrap: anywhere; }
        .auth-page, .auth-card, .card, .field, .form-grid, .choice-row { min-width: 0; }
        .field-control, .button { max-width: 100%; }
        .provider-onboarding-page { width: min(100%, 760px); }
        .provider-onboarding-form { padding: 0; }
        .provider-onboarding-form > .card { padding: 24px; }
        .provider-onboarding-form .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .account-provider-entry { width: 100%; margin-top: 28px; padding: 32px; overflow: hidden; }
        .account-provider-entry > p { max-width: 72ch; line-height: 1.65; }
        .account-provider-entry .account-actions { align-items: stretch; gap: 12px; }

        @media (max-width: 1100px) {
          .shell-bar { gap: 16px; }
          .desktop-nav { gap: 14px; font-size: .82rem; }
          .header-actions { gap: 10px; }
          .footer-inner { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .footer-brand-column { grid-column: 1 / -1; }
          .account-provider-entry { padding: 28px; }
        }

        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .menu-trigger { display: inline-flex !important; flex-direction: column; justify-content: center; gap: 4px; width: 42px; height: 42px; border: 1px solid var(--color-border); border-radius: 10px; background: #fff; }
          .menu-trigger span { display: block; width: 18px; height: 2px; margin: 0 auto; background: var(--color-ink); }
          .mobile-menu { display: grid !important; width: min(calc(100% - 32px), 560px); gap: 4px; margin: 0 auto 12px; border: 1px solid var(--color-border); border-radius: 14px; background: #fff; padding: 10px; box-shadow: var(--shadow-md); }
          .mobile-menu a { padding: 12px 14px; border-radius: 9px; }
          .header-requirement { display: none; }
          .page-frame { padding-top: 36px; }
          .provider-onboarding-page { width: min(100%, 680px); }
          .account-provider-entry { padding: 24px; }
        }

        @media (max-width: 640px) {
          .shell-bar, .page-frame, .footer-inner { width: min(100% - 24px, var(--content-width)); }
          .shell-bar { min-height: 64px; }
          .inner-page-brand, .inner-page-brand img { width: 70px; }
          .header-login { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .page-frame { padding: 28px 0 88px; }
          .page-intro h1, .account-page-heading h1, .provider-workspace h1 { font-size: clamp(2.1rem, 11vw, 3.2rem) !important; line-height: .98 !important; }
          .page-intro p { font-size: .95rem; line-height: 1.55; }
          .provider-onboarding-form > .card { padding: 18px; }
          .provider-onboarding-form .form-grid { grid-template-columns: 1fr; }
          .choice-row { align-items: flex-start; }
          .choice-description { line-height: 1.45; }
          .button-row, .account-actions { display: grid !important; grid-template-columns: 1fr; width: 100%; }
          .button-row .button, .account-actions .button { width: 100%; }
          .account-provider-entry { margin-top: 24px; padding: 20px; border-radius: 14px; }
          .account-provider-entry .account-actions { margin-top: 18px; gap: 10px; }
          .account-provider-entry h2 { font-size: clamp(1.45rem, 7vw, 1.9rem); line-height: 1.12; }
          .account-provider-entry > p { font-size: .92rem; line-height: 1.6; }
          .alert { align-items: flex-start; overflow-wrap: anywhere; }
          .footer-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 18px; padding-top: 36px; }
          .footer-brand-column, .footer-legal { grid-column: 1 / -1; }
          .footer-connect { grid-column: 1 / -1; }
          .mobile-bottom-nav { display: grid !important; position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--color-border); background: rgb(255 255 255 / 96%); padding: 7px max(8px, env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); backdrop-filter: blur(10px); }
          .mobile-bottom-nav a { display: grid; justify-items: center; gap: 2px; min-width: 0; font-size: .7rem; }
          .back-to-top { bottom: 78px; right: 14px; }
        }

        @media (max-width: 390px) {
          .shell-bar, .page-frame, .footer-inner { width: min(100% - 18px, var(--content-width)); }
          .header-login { max-width: 92px; font-size: .8rem; }
          .provider-onboarding-form > .card { padding: 15px; }
          .account-provider-entry { padding: 16px; }
          .footer-inner { grid-template-columns: 1fr; }
          .footer-brand-column, .footer-legal, .footer-connect { grid-column: auto; }
        }
      `}</style>
    </div>
  );
}
