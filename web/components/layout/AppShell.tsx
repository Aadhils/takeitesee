'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import BackToTop from './BackToTop';
import { LanguageProvider, useLanguage, type TranslationKey } from '../i18n/LanguageProvider';
import { getSupabaseBrowserUser, isSupabaseConfigured, localDevelopmentAuthAdapter } from '../../services/auth-adapter';
import type { User } from '../../types/auth-domain';

type ShellIconKey = 'home' | 'search' | 'calendar' | 'bell' | 'grid' | 'professional' | 'business' | 'products' | 'account' | 'userPlus';
type ShellLink = { href: string; labelKey: TranslationKey; icon: ShellIconKey };

const primaryLinks: ShellLink[] = [
  { href: '/explore', labelKey: 'nav.explore', icon: 'search' },
  { href: '/bookings', labelKey: 'nav.bookings', icon: 'calendar' },
  { href: '/notifications', labelKey: 'nav.notifications', icon: 'bell' },
  { href: '/categories', labelKey: 'nav.categories', icon: 'grid' },
  { href: '/professionals', labelKey: 'nav.professionals', icon: 'professional' },
  { href: '/businesses', labelKey: 'nav.businesses', icon: 'business' },
];

const mobileLinks: ShellLink[] = [
  { href: '/', labelKey: 'nav.home', icon: 'home' },
  { href: '/explore', labelKey: 'nav.explore', icon: 'search' },
  { href: '/bookings', labelKey: 'nav.bookings', icon: 'calendar' },
  { href: '/account', labelKey: 'nav.account', icon: 'account' },
];

function ShellIcon({ name }: { name: ShellIconKey }) {
  return <svg className="shell-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'home' ? <><path d="m3.5 11 8.5-7 8.5 7" /><path d="M5.5 10v10h13V10" /><path d="M9.5 20v-6h5v6" /></> : null}
    {name === 'search' ? <><circle cx="10.8" cy="10.8" r="6.4" /><path d="m15.6 15.6 4.4 4.4" /></> : null}
    {name === 'calendar' ? <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M8 14h3M13 14h3M8 17h3" /></> : null}
    {name === 'bell' ? <><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5 2 5.5 2 5.5h-15s2-.5 2-5.5" /><path d="M10 19h4" /></> : null}
    {name === 'grid' ? <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></> : null}
    {name === 'professional' ? <><circle cx="10" cy="8" r="3" /><path d="M4.5 20c.8-4 2.7-6 5.5-6s4.7 2 5.5 6" /><path d="M17 8h4M19 6v4" /></> : null}
    {name === 'business' ? <><path d="M5 21V5l7-2v18" /><path d="M12 8h7v13" /><path d="M8 8h1M8 12h1M8 16h1M15 11h1M15 15h1" /></> : null}
    {name === 'products' ? <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="M4 7.5V16l8 5 8-5V7.5M12 12v9" /></> : null}
    {name === 'account' ? <><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20c.8-4.2 3-6.2 6.5-6.2s5.7 2 6.5 6.2" /></> : null}
    {name === 'userPlus' ? <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.7-4 2.6-6 5.5-6 1.9 0 3.4.8 4.4 2.3" /><path d="M17.5 12.5v6M14.5 15.5h6" /></> : null}
  </svg>;
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof localDevelopmentAuthAdapter.getCurrentUser>>();
  const [proposalUnreadCount, setProposalUnreadCount] = useState(0);
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const { locale, setLocale, t } = useLanguage();
  const isTamil = locale === 'ta-IN';
  const productsActive = pathname === '/products' || pathname.startsWith('/products/');
  const proposalBadgeText = proposalUnreadCount > 99 ? '99+' : String(proposalUnreadCount);
  const proposalBadgeLabel = isTamil
    ? `${proposalUnreadCount} புதிய proposals`
    : `${proposalUnreadCount} new ${proposalUnreadCount === 1 ? 'proposal' : 'proposals'}`;
  const accountAttentionHref = proposalUnreadCount > 0 ? '/account#proposal-attention' : '/account';

  useEffect(() => {
    let active = true;
    const syncUser = async () => {
      if (isSupabaseConfigured()) {
        const user = await getSupabaseBrowserUser();
        if (!active) return;
        setCurrentUser(user ? { id: user.id, name: user.user_metadata?.name ?? user.email ?? 'Account', email: user.email ?? '', phone: user.user_metadata?.phone, role: 'customer', createdAt: user.created_at, updatedAt: user.updated_at ?? user.created_at } satisfies User : undefined);
        if (!user) {
          setProposalUnreadCount(0);
          return;
        }
        try {
          const response = await fetch('/api/notifications?mode=proposal-unread-count', { cache: 'no-store' });
          if (!active) return;
          if (!response.ok) {
            setProposalUnreadCount(0);
            return;
          }
          const payload = await response.json() as { unread_count?: number };
          setProposalUnreadCount(Math.max(0, Number(payload.unread_count ?? 0)));
        } catch {
          if (active) setProposalUnreadCount(0);
        }
      } else {
        setCurrentUser(localDevelopmentAuthAdapter.getCurrentUser());
        setProposalUnreadCount(0);
      }
    };
    window.addEventListener('storage', syncUser);
    void syncUser();
    return () => {
      active = false;
      window.removeEventListener('storage', syncUser);
    };
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('nav.skipToContent')}</a>
      <header className="site-header">
        <div className="shell-bar">
          {!isHomepage ? <Link href="/" className="inner-page-brand" aria-label={t('nav.goHome')}><img src="/official-takeitesee-logo.png" alt="" /></Link> : null}
          <nav className="desktop-nav" aria-label={t('nav.main')}>
            {primaryLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}>{t(link.labelKey)}</Link>)}
            <Link href="/products" className={productsActive ? 'nav-active' : ''} aria-current={productsActive ? 'page' : undefined}>{isTamil ? 'பொருட்கள்' : 'Products'}</Link>
          </nav>
          <div className="header-actions">
            <label className="language-switcher">
              <span className="sr-only">{t('language.label')}</span>
              <select aria-label={t('language.label')} value={locale} onChange={(event) => setLocale(event.target.value as 'en-IN' | 'ta-IN')}>
                <option value="en-IN">{t('language.english')}</option>
                <option value="ta-IN">{t('language.tamil')}</option>
              </select>
            </label>
            <Link href="/requirements" className="header-requirement">{t('nav.postRequirement')}</Link>
            <Link href={accountAttentionHref} className="header-login">
              <span className="header-account-icon" aria-hidden="true"><ShellIcon name="account" /></span>
              <span className="header-login-label">{currentUser ? currentUser.name : t('nav.account')}</span>
              {proposalUnreadCount > 0 ? <span className="global-proposal-attention-badge" aria-label={proposalBadgeLabel}>{proposalBadgeText}</span> : null}
            </Link>
            <button className={`menu-trigger${menuOpen ? ' menu-trigger-open' : ''}`} type="button" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={t('nav.toggleMenu')} onClick={() => setMenuOpen((value) => !value)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-menu" className="mobile-menu" aria-label={t('nav.mobile')}>
            {primaryLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined} onClick={() => setMenuOpen(false)}><span className="mobile-menu-icon" aria-hidden="true"><ShellIcon name={link.icon} /></span><span className="mobile-menu-label">{t(link.labelKey)}</span></Link>)}
            <Link href="/products" className={productsActive ? 'nav-active' : ''} aria-current={productsActive ? 'page' : undefined} onClick={() => setMenuOpen(false)}><span className="mobile-menu-icon" aria-hidden="true"><ShellIcon name="products" /></span><span className="mobile-menu-label">{isTamil ? 'பொருட்கள்' : 'Products'}</span></Link>
            <Link href="/register" className="mobile-menu-join" onClick={() => setMenuOpen(false)}><span className="mobile-menu-icon" aria-hidden="true"><ShellIcon name="userPlus" /></span><span className="mobile-menu-label">{t('nav.createAccount')}</span></Link>
          </nav>
        ) : null}
      </header>

      <main id="main-content" className="page-frame" tabIndex={-1}>{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand-column">
            <Link href="/" className="brand brand-footer"><img className="brand-logo" src="/official-takeitesee-logo.png" alt="takeitesee" /></Link>
            <p>{t('footer.tagline')}</p>
          </div>
          <div className="footer-link-column"><strong>{t('footer.forCustomers')}</strong><Link href="/products">{isTamil ? 'பொருட்கள் பார்க்க' : 'Browse products'}</Link><Link href="/help">{t('footer.howItWorks')}</Link><Link href="/help">{t('footer.safety')}</Link><Link href="/help">{t('footer.helpSupport')}</Link></div>
          <div className="footer-link-column"><strong>{t('footer.forProfessionals')}</strong><Link href="/provider/onboarding">{t('footer.joinProfessional')}</Link><Link href="/professionals">{t('footer.professionalResources')}</Link></div>
          <div className="footer-link-column"><strong>{t('footer.forBusinesses')}</strong><Link href="/provider/onboarding">{t('footer.listBusiness')}</Link><Link href="/businesses">{t('footer.businessResources')}</Link></div>
          <div className="footer-link-column footer-connect"><strong>{isTamil ? 'உதவி' : 'Support'}</strong><Link href="/help">{isTamil ? 'உதவி மையம்' : 'Help center'}</Link></div>
          <div className="footer-legal">
            <span>© 2026 takeitesee</span>
            <Link href="/privacy">{t('footer.privacy')}</Link>
            <Link href="/terms">{t('footer.terms')}</Link>
            <Link href="/cookies">{t('footer.cookies')}</Link>
          </div>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label={t('nav.mobilePrimary')}>
        {mobileLinks.map((link) => {
          const activeLink = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const targetHref = link.href === '/account' && proposalUnreadCount > 0 ? accountAttentionHref : link.href;
          return <Link key={link.href} href={targetHref} className={activeLink ? 'nav-active' : ''} aria-current={activeLink ? 'page' : undefined}>
            <span className="mobile-nav-icon" aria-hidden="true"><ShellIcon name={link.icon} /></span>
            <span className="mobile-nav-label">{t(link.labelKey)}</span>
            {link.href === '/account' && proposalUnreadCount > 0 ? <span className="global-proposal-attention-badge global-proposal-attention-badge-mobile" aria-label={proposalBadgeLabel}>{proposalBadgeText}</span> : null}
          </Link>;
        })}
      </nav>
      <BackToTop />

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; }
        img, svg, video, canvas { max-width: 100%; height: auto; }
        .shell-icon { display: block; width: 20px; height: 20px; }
        .skip-link { position: fixed; top: 10px; left: 10px; z-index: 100; border-radius: 8px; background: var(--color-primary-strong); color: #fff; padding: 10px 14px; font-weight: 700; transform: translateY(-160%); transition: transform .15s ease; }
        .skip-link:focus { transform: translateY(0); }
        .page-frame:focus { outline: none; }
        .page-frame, .shell-bar, .footer-inner { min-width: 0; }
        .page-intro h1, .account-page-heading h1, .provider-workspace h1 { overflow-wrap: anywhere; }
        .auth-page, .auth-card, .card, .field, .form-grid, .choice-row { min-width: 0; }
        .field-control, .button { max-width: 100%; }
        .language-switcher select { min-height: 38px; max-width: 105px; border: 1px solid var(--color-border); border-radius: 9px; background: #fff; color: var(--color-ink); padding: 0 28px 0 10px; font: inherit; font-size: .82rem; }
        .header-login { position: relative; display: inline-flex; align-items: center; gap: .35rem; }
        .header-account-icon { display: grid; width: 24px; height: 24px; flex: 0 0 24px; place-items: center; border-radius: 8px; color: var(--color-primary-strong); }
        .header-account-icon .shell-icon { width: 18px; height: 18px; }
        .header-login-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .global-proposal-attention-badge { display: inline-grid; min-width: 18px; height: 18px; place-items: center; border-radius: 999px; background: var(--color-primary-strong); color: #fff; padding: 0 5px; font-size: .62rem; font-weight: 850; line-height: 1; }
        .header-login:focus-visible, .menu-trigger:focus-visible, .mobile-menu a:focus-visible, .mobile-bottom-nav a:focus-visible { outline: 3px solid color-mix(in srgb, var(--color-primary) 32%, transparent); outline-offset: 2px; }
        .provider-onboarding-page { width: min(100%, 760px); }
        .provider-onboarding-form { padding: 0; }
        .provider-onboarding-form > .card { padding: 24px; }
        .provider-onboarding-form .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .account-provider-entry { width: 100%; margin-top: 28px; padding: 32px; overflow: hidden; }
        .account-provider-entry > p { max-width: 72ch; line-height: 1.65; }
        .account-provider-entry .account-actions { align-items: stretch; gap: 12px; }
        .provider-draft-banner { width: 100%; margin-bottom: 28px; min-width: 0; }
        .provider-draft-banner > .card { width: 100%; padding: 30px 32px; overflow: hidden; }
        .provider-draft-banner > .card > p { max-width: 72ch; line-height: 1.6; }
        .provider-draft-banner .account-actions { gap: 12px; align-items: stretch; }
        .provider-draft-banner h2 { margin-top: 8px; overflow-wrap: anywhere; }

        @media (max-width: 1100px) {
          .shell-bar { gap: 16px; }
          .desktop-nav { gap: 14px; font-size: .82rem; }
          .header-actions { gap: 10px; }
          .footer-inner { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .footer-brand-column { grid-column: 1 / -1; }
          .account-provider-entry { padding: 28px; }
          .provider-draft-banner > .card { padding: 28px; }
        }

        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .menu-trigger { display: inline-flex !important; flex-direction: column; justify-content: center; gap: 4px; width: 42px; height: 42px; border: 1px solid var(--color-border); border-radius: 10px; background: #fff; }
          .menu-trigger span { display: block; width: 18px; height: 2px; margin: 0 auto; border-radius: 999px; background: var(--color-ink); transition: transform .18s ease, opacity .18s ease; }
          .menu-trigger-open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
          .menu-trigger-open span:nth-child(2) { opacity: 0; }
          .menu-trigger-open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
          .mobile-menu { display: grid !important; width: min(calc(100% - 32px), 560px); gap: 4px; margin: 0 auto 12px; border: 1px solid var(--color-border); border-radius: 14px; background: #fff; padding: 10px; box-shadow: var(--shadow-md); }
          .mobile-menu a { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 8px 10px; border-radius: 11px; }
          .mobile-menu-icon { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 10px; background: var(--color-surface-muted); color: var(--color-ink-muted); transition: background .18s ease, color .18s ease, transform .18s ease; }
          .mobile-menu-icon .shell-icon { width: 19px; height: 19px; }
          .mobile-menu-label { min-width: 0; font-weight: 720; }
          .mobile-menu a:hover, .mobile-menu a.nav-active { background: var(--color-selected); color: var(--color-primary-strong); }
          .mobile-menu a:hover .mobile-menu-icon, .mobile-menu a.nav-active .mobile-menu-icon { background: color-mix(in srgb, var(--color-primary) 12%, white); color: var(--color-primary-strong); transform: translateY(-1px); }
          .mobile-menu-join { margin-top: 4px; border-top: 1px solid var(--color-border); border-radius: 0 0 11px 11px !important; }
          .header-requirement { display: none; }
          .page-frame { padding-top: 36px; }
          .provider-onboarding-page { width: min(100%, 680px); }
          .account-provider-entry { padding: 24px; }
          .provider-draft-banner > .card { padding: 24px; }
        }

        @media (max-width: 640px) {
          .shell-bar, .page-frame, .footer-inner { width: min(100% - 24px, var(--content-width)); }
          .shell-bar { min-height: 64px; }
          .inner-page-brand, .inner-page-brand img { width: 70px; }
          .language-switcher select { max-width: 84px; min-height: 36px; padding-left: 8px; font-size: .76rem; }
          .header-login { max-width: 120px; overflow: visible; }
          .header-account-icon { width: 30px; height: 30px; border-radius: 10px; background: var(--color-selected); }
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
          .provider-draft-banner { margin-bottom: 22px; }
          .provider-draft-banner > .card { padding: 20px; border-radius: 14px; }
          .provider-draft-banner > .card > p { font-size: .92rem; line-height: 1.6; }
          .provider-draft-banner h2 { font-size: clamp(1.35rem, 6.5vw, 1.8rem); line-height: 1.15; }
          .provider-draft-banner .account-actions { margin-top: 18px; gap: 10px; }
          .alert { align-items: flex-start; overflow-wrap: anywhere; }
          .site-footer { padding-bottom: calc(84px + env(safe-area-inset-bottom)); }
          .footer-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 18px; padding-top: 36px; }
          .footer-brand-column, .footer-legal { grid-column: 1 / -1; }
          .footer-connect { grid-column: 1 / -1; }
          .mobile-bottom-nav { display: grid !important; position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--color-border); background: rgb(255 255 255 / 96%); padding: 7px max(8px, env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); backdrop-filter: blur(10px); }
          .mobile-bottom-nav a { position: relative; display: grid; justify-items: center; gap: 2px; min-width: 0; font-size: .7rem; }
          .mobile-nav-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 10px; color: var(--color-ink-muted); }
          .mobile-nav-icon .shell-icon { width: 19px; height: 19px; }
          .mobile-nav-label { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .mobile-bottom-nav .global-proposal-attention-badge-mobile { position: absolute; top: 1px; left: calc(50% + 8px); min-width: 17px; height: 17px; padding-inline: 4px; font-size: .58rem; }
          .back-to-top { bottom: 78px; right: 14px; }
        }

        @media (max-width: 390px) {
          .shell-bar, .page-frame, .footer-inner { width: min(100% - 18px, var(--content-width)); }
          .language-switcher select { max-width: 74px; }
          .header-login { max-width: 96px; font-size: .8rem; }
          .provider-onboarding-form > .card { padding: 15px; }
          .account-provider-entry { padding: 16px; }
          .provider-draft-banner > .card { padding: 16px; }
          .footer-inner { grid-template-columns: 1fr; }
          .footer-brand-column, .footer-legal, .footer-connect { grid-column: auto; }
        }
      `}</style>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <LanguageProvider><AppShellContent>{children}</AppShellContent></LanguageProvider>;
}
