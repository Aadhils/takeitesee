'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import BackToTop from './BackToTop';
import { LanguageProvider, useLanguage, type TranslationKey } from '../i18n/LanguageProvider';
import { getSupabaseBrowserUser, isSupabaseConfigured, localDevelopmentAuthAdapter } from '../../services/auth-adapter';
import type { User } from '../../types/auth-domain';

const primaryLinks: { href: string; labelKey: TranslationKey }[] = [
  { href: '/explore', labelKey: 'nav.explore' },
  { href: '/bookings', labelKey: 'nav.bookings' },
  { href: '/notifications', labelKey: 'nav.notifications' },
  { href: '/categories', labelKey: 'nav.categories' },
  { href: '/professionals', labelKey: 'nav.professionals' },
  { href: '/businesses', labelKey: 'nav.businesses' },
];

const mobileLinks: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/', labelKey: 'nav.home', icon: '⌂' },
  { href: '/explore', labelKey: 'nav.explore', icon: '⌕' },
  { href: '/bookings', labelKey: 'nav.bookings', icon: '▣' },
  { href: '/account', labelKey: 'nav.account', icon: '◯' },
];

function AppShellContent({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof localDevelopmentAuthAdapter.getCurrentUser>>();
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const { locale, setLocale, t } = useLanguage();

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
          {!isHomepage ? <Link href="/" className="inner-page-brand" aria-label={t('nav.goHome')}><img src="/official-takeitesee-logo.png" alt="" /></Link> : null}
          <nav className="desktop-nav" aria-label={t('nav.main')}>
            {primaryLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}>{t(link.labelKey)}</Link>)}
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
            <Link href="/account" className="header-login"><span aria-hidden="true">◯</span> {currentUser ? currentUser.name : t('nav.account')}</Link>
            <button className="menu-trigger" type="button" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={t('nav.toggleMenu')} onClick={() => setMenuOpen((value) => !value)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-menu" className="mobile-menu" aria-label={t('nav.mobile')}>
            {primaryLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{t(link.labelKey)}</Link>)}
            <Link href="/register" className="mobile-menu-join" onClick={() => setMenuOpen(false)}>{t('nav.createAccount')}</Link>
          </nav>
        ) : null}
      </header>

      <main className="page-frame">{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand-column">
            <Link href="/" className="brand brand-footer"><img className="brand-logo" src="/official-takeitesee-logo.png" alt="takeitesee" /></Link>
            <p>{t('footer.tagline')}</p>
          </div>
          <div className="footer-link-column"><strong>{t('footer.forCustomers')}</strong><Link href="/help">{t('footer.howItWorks')}</Link><Link href="/help">{t('footer.safety')}</Link><Link href="/help">{t('footer.helpSupport')}</Link></div>
          <div className="footer-link-column"><strong>{t('footer.forProfessionals')}</strong><Link href="/register">{t('footer.joinProfessional')}</Link><Link href="/professionals">{t('footer.professionalResources')}</Link><Link href="/professionals">{t('footer.successStories')}</Link></div>
          <div className="footer-link-column"><strong>{t('footer.forBusinesses')}</strong><Link href="/businesses">{t('footer.listBusiness')}</Link><Link href="/businesses">{t('footer.businessResources')}</Link><Link href="/businesses">{t('footer.partnerships')}</Link></div>
          <div className="footer-link-column footer-connect"><strong>{t('footer.connect')}</strong><Link href="/help">Instagram</Link><Link href="/help">LinkedIn</Link><Link href="/help">{t('footer.contact')}</Link></div>
          <div className="footer-legal"><span>© 2026 takeitesee</span><Link href="/help">{t('footer.privacy')}</Link><Link href="/help">{t('footer.terms')}</Link><Link href="/help">{t('footer.cookies')}</Link></div>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label={t('nav.mobilePrimary')}>
        {mobileLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'nav-active' : ''} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined}><span aria-hidden="true">{link.icon}</span><span>{t(link.labelKey)}</span></Link>)}
      </nav>
      <BackToTop />

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; }
        img, svg, video, canvas { max-width: 100%; height: auto; }
        .page-frame, .shell-bar, .footer-inner { min-width: 0; }
        .page-intro h1, .account-page-heading h1, .provider-workspace h1 { overflow-wrap: anywhere; }
        .auth-page, .auth-card, .card, .field, .form-grid, .choice-row { min-width: 0; }
        .field-control, .button { max-width: 100%; }
        .language-switcher select { min-height: 38px; max-width: 105px; border: 1px solid var(--color-border); border-radius: 9px; background: #fff; color: var(--color-ink); padding: 0 28px 0 10px; font: inherit; font-size: .82rem; }
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
          .menu-trigger span { display: block; width: 18px; height: 2px; margin: 0 auto; background: var(--color-ink); }
          .mobile-menu { display: grid !important; width: min(calc(100% - 32px), 560px); gap: 4px; margin: 0 auto 12px; border: 1px solid var(--color-border); border-radius: 14px; background: #fff; padding: 10px; box-shadow: var(--shadow-md); }
          .mobile-menu a { padding: 12px 14px; border-radius: 9px; }
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
          .header-login { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
          .footer-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 18px; padding-top: 36px; }
          .footer-brand-column, .footer-legal { grid-column: 1 / -1; }
          .footer-connect { grid-column: 1 / -1; }
          .mobile-bottom-nav { display: grid !important; position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--color-border); background: rgb(255 255 255 / 96%); padding: 7px max(8px, env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); backdrop-filter: blur(10px); }
          .mobile-bottom-nav a { display: grid; justify-items: center; gap: 2px; min-width: 0; font-size: .7rem; }
          .back-to-top { bottom: 78px; right: 14px; }
        }

        @media (max-width: 390px) {
          .shell-bar, .page-frame, .footer-inner { width: min(100% - 18px, var(--content-width)); }
          .language-switcher select { max-width: 74px; }
          .header-login { max-width: 78px; font-size: .8rem; }
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
