'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import RoleIdentityMediaHeader from '../identity/RoleIdentityMediaHeader';
import CustomerAccountProposalSummary from './CustomerAccountProposalSummary';
import CustomerProductOrderAttention from './CustomerProductOrderAttention';
import CustomerSmartAttention from './CustomerSmartAttention';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { getSupabaseBrowserUser, isSupabaseConfigured, localDevelopmentAuthAdapter, signOutWithSupabase } from '../../services/auth-adapter';
import { getBookingsForCustomer, getBookingsThroughConfiguredRepository } from '../../services/booking-repository';
import type { User } from '../../types/auth-domain';
import type { CustomerBooking } from '../../types/booking-domain';

type CustomerMobileIcon = 'bookings' | 'orders' | 'needs' | 'messages' | 'explore' | 'profile';
type MobileQuickLink = { href: string; label: string; icon: CustomerMobileIcon; badge?: number; badgeLabel?: string };
type DashboardQuickLink = { href: string; label: string; icon: CustomerMobileIcon; badge?: number };

function CustomerMobileNavIcon({ icon }: { icon: CustomerMobileIcon }) {
  const paths: Record<CustomerMobileIcon, React.ReactNode> = {
    bookings: <><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M8 3v5M16 3v5M4 10h16"/><path d="m9 15 2 2 4-4"/></>,
    orders: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="M4 7.5V16l8 5 8-5V7.5M12 12v9"/></>,
    needs: <><path d="M6 4h12a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
    messages: <><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M7.5 10h9M7.5 13.5h6"/></>,
    explore: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  };
  return <svg className="customer-mobile-quick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[icon]}</svg>;
}

function CustomerSettingsIcon() {
  return <svg className="customer-mobile-settings-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5L9 6.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.5 3.1h5l.5-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4L18.9 13c.1-.3.1-.7.1-1Z"/></svg>;
}

export default function AuthenticatedAccount() {
  const { t, locale } = useIdentityWorkspaceTranslations();
  const tamil = locale === 'ta-IN';
  const [user, setUser] = useState<User>();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [bookingError, setBookingError] = useState('');
  const [proposalUnreadCount, setProposalUnreadCount] = useState(0);
  const [productOrderUnreadCount, setProductOrderUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let currentUser: User | undefined;
      if (isSupabaseConfigured()) {
        const current = await getSupabaseBrowserUser();
        if (current) currentUser = { id: current.id, name: current.user_metadata?.name ?? current.email ?? 'Account', email: current.email ?? '', phone: current.user_metadata?.phone, role: 'customer', createdAt: current.created_at, updatedAt: current.updated_at ?? current.created_at };
      } else currentUser = localDevelopmentAuthAdapter.getCurrentUser();
      if (cancelled) return;
      setUser(currentUser);
      if (!currentUser) return;
      try {
        const liveBookings = isSupabaseConfigured() ? await getBookingsThroughConfiguredRepository(currentUser.id) : getBookingsForCustomer(currentUser.id);
        if (!cancelled) setBookings(liveBookings);
      } catch (error) {
        if (!cancelled) setBookingError(error instanceof Error ? error.message : t('account.loadBookingFallback'));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [t]);

  const summary = useMemo(() => ({
    upcoming: bookings.filter((booking) => ['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    total: bookings.length,
  }), [bookings]);

  if (!user) return <div className="account-page-heading"><span className="eyebrow">{t('auth.account')}</span><h1>{t('account.yourAccount')}</h1><p>{t('account.signInIntro')}</p><div className="account-actions"><Link href="/login" className="button button-primary">{t('auth.signIn')}</Link><Link href="/signup" className="button button-secondary">{t('auth.createAccount')}</Link></div></div>;

  const signOut = async () => {
    if (isSupabaseConfigured()) await signOutWithSupabase(); else localDevelopmentAuthAdapter.signOut();
    setUser(undefined);
  };

  const mobileQuickLinks: MobileQuickLink[] = [
    { href: '/bookings', label: tamil ? 'Bookings' : 'Bookings', icon: 'bookings' },
    { href: '/orders', label: tamil ? 'Orders' : 'Orders', icon: 'orders', badge: productOrderUnreadCount, badgeLabel: tamil ? 'புதிய order updates' : 'new order updates' },
    { href: '/requirements', label: tamil ? 'தேவைகள்' : 'Needs', icon: 'needs', badge: proposalUnreadCount, badgeLabel: tamil ? 'புதிய proposals' : 'new proposals' },
    { href: '/messages', label: tamil ? 'செய்திகள்' : 'Messages', icon: 'messages' },
    { href: '/account/profile', label: tamil ? 'Profile' : 'Profile', icon: 'profile' },
  ];

  const dashboardQuickLinks: DashboardQuickLink[] = [
    { href: '/bookings', label: tamil ? 'Bookings' : 'Bookings', icon: 'bookings' },
    { href: '/orders', label: tamil ? 'Orders' : 'Orders', icon: 'orders', badge: productOrderUnreadCount },
    { href: '/requirements', label: tamil ? 'தேவைகள்' : 'Needs', icon: 'needs', badge: proposalUnreadCount },
    { href: '/messages', label: tamil ? 'செய்திகள்' : 'Messages', icon: 'messages' },
    { href: '/explore', label: tamil ? 'Explore' : 'Explore', icon: 'explore' },
    { href: '/account/profile', label: tamil ? 'Profile' : 'Profile', icon: 'profile' },
  ];

  const secondaryLinks = [
    { href: '/notifications', label: t('account.notifications') },
    { href: '/reviews', label: tamil ? 'Reviews' : 'Reviews' },
    { href: '/saved-services', label: tamil ? 'Saved services' : 'Saved services' },
    { href: '/saved-products', label: tamil ? 'Saved Products' : 'Saved Products' },
    { href: '/products', label: tamil ? 'Products' : 'Products' },
    { href: '/account/settings', label: t('account.settings') },
    { href: '/account/support', label: tamil ? 'Platform உதவி' : 'Support' },
    { href: '/account/reports', label: tamil ? 'Safety reports' : 'Safety reports' },
  ];

  return (
    <div className="account-page-heading customer-social-dashboard">
      <span className="eyebrow">{t('auth.account')}</span>
      <h1>{t('account.welcome')}, {user.name.split(' ')[0]}.</h1>
      <p>{isSupabaseConfigured() ? t('account.productionSession') : t('account.localSession')}</p>

      <section className="customer-mobile-quick-shell" aria-label={tamil ? 'Customer விரைவு வழிசெலுத்தல்' : 'Customer quick navigation'}>
        <div className="customer-mobile-quick-identity">
          <div>
            <strong>{user.name}</strong>
            <span>{tamil ? 'Customer workspace' : 'Customer workspace'}</span>
          </div>
          <Link href="/account/settings" className="customer-mobile-quick-settings" aria-label={tamil ? 'Account அமைப்புகள்' : 'Account settings'}><CustomerSettingsIcon /></Link>
        </div>
        <nav className="customer-mobile-quick-nav" aria-label={tamil ? 'Customer முக்கிய வழிசெலுத்தல்' : 'Customer primary navigation'}>
          {mobileQuickLinks.map((link) => <Link href={link.href} key={link.href} aria-label={link.badge ? `${link.label}, ${link.badge} ${link.badgeLabel ?? 'new updates'}` : link.label}>
            <span className="customer-mobile-quick-icon" aria-hidden="true">
              <CustomerMobileNavIcon icon={link.icon} />
              {link.badge ? <span className="customer-mobile-quick-badge">{link.badge > 99 ? '99+' : link.badge}</span> : null}
            </span>
            <span>{link.label}</span>
          </Link>)}
        </nav>
      </section>

      {isSupabaseConfigured() ? <RoleIdentityMediaHeader context="customer" displayName={user.name} subtitle="Personal customer account" meta={[user.email, user.phone].filter(Boolean).join(' · ')} /> : <Card className="profile-summary"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{user.name.split(' ').map((part) => part[0]).join('')}</div><div><span className="eyebrow">{t('account.signedInCustomer')}</span><h2>{user.name}</h2><p>{user.email}</p>{user.phone ? <span className="card-location">{user.phone}</span> : null}</div></Card>}

      <WorkspaceSwitcher currentWorkspace="customer" />

      <CustomerSmartAttention bookings={bookings} />

      <details className="customer-secondary-activity">
        <summary>
          <span>
            <strong>{tamil ? 'மேலும் activity' : 'More activity'}</strong>
            <small>{tamil ? 'Proposals, order updates & history' : 'Proposals, order updates & history'}</small>
          </span>
          <span className="customer-secondary-activity-meta">
            {proposalUnreadCount + productOrderUnreadCount > 0
              ? <span className="customer-secondary-activity-count">{proposalUnreadCount + productOrderUnreadCount > 99 ? '99+' : proposalUnreadCount + productOrderUnreadCount}</span>
              : <span>{tamil ? 'Details' : 'Details'}</span>}
            <span aria-hidden="true" className="customer-secondary-activity-caret">⌄</span>
          </span>
        </summary>
        <div className="customer-secondary-activity-body">
          <CustomerProductOrderAttention onUnreadChange={setProductOrderUnreadCount} />
          <CustomerAccountProposalSummary onUnreadChange={setProposalUnreadCount} />
        </div>
      </details>

      <section className="customer-dashboard-quick-actions" aria-label={tamil ? 'Customer quick actions' : 'Customer quick actions'}>
        <div className="customer-dashboard-section-heading">
          <div>
            <span className="eyebrow">{tamil ? 'Quick actions' : 'Quick actions'}</span>
            <h2>{tamil ? 'அடிக்கடி பயன்படுத்துவது' : 'Go where you need'}</h2>
          </div>
        </div>
        <nav className="customer-dashboard-quick-grid" aria-label={tamil ? 'Customer quick actions' : 'Customer quick actions'}>
          {dashboardQuickLinks.map((link) => <Link href={link.href} className="customer-dashboard-quick-link" key={link.href}>
            <span className="customer-dashboard-quick-icon" aria-hidden="true"><CustomerMobileNavIcon icon={link.icon} /></span>
            <span>{link.label}</span>
            {link.badge ? <span className="customer-dashboard-quick-badge" aria-label={`${link.badge} new updates`}>{link.badge > 99 ? '99+' : link.badge}</span> : null}
          </Link>)}
        </nav>
      </section>

      <details className="customer-dashboard-more-links">
        <summary>
          <span>{tamil ? 'மேலும் shortcuts' : 'More shortcuts'}</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <nav className="customer-dashboard-more-link-row" aria-label={tamil ? 'மேலும் customer shortcuts' : 'More customer shortcuts'}>
          {secondaryLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>
      </details>

      <section className="customer-activity-strip" aria-label={tamil ? 'Booking activity summary' : 'Booking activity summary'}>
        <Link href="/bookings" className="customer-activity-strip-item"><span>{t('account.upcoming')}</span><strong>{summary.upcoming}</strong></Link>
        <Link href="/bookings" className="customer-activity-strip-item"><span>{t('account.completed')}</span><strong>{summary.completed}</strong></Link>
        <Link href="/bookings" className="customer-activity-strip-item"><span>{t('account.cancelled')}</span><strong>{summary.cancelled}</strong></Link>
        <Link href="/bookings" className="customer-activity-strip-item"><span>{t('account.total')}</span><strong>{summary.total}</strong></Link>
      </section>
      {bookingError ? <p role="alert" style={{ color: '#b42318' }}>{t('account.bookingUnavailable')}: {bookingError}</p> : null}

      <div className="account-actions">
        <Button type="button" variant="quiet" className="account-sign-out" onClick={signOut}>{t('account.signOut')}</Button>
      </div>

      <style jsx>{`
        .customer-mobile-quick-shell { display: none; }
        .customer-account-action-with-badge { display: inline-flex; align-items: center; gap: .42rem; }
        .customer-account-action-badge { display: inline-grid; min-width: 18px; height: 18px; place-items: center; padding: 0 4px; border-radius: 999px; background: var(--color-primary-strong); color: white; font-size: .58rem; font-weight: 850; line-height: 1; }
        .customer-dashboard-quick-actions { display: grid; gap: 9px; margin-top: 14px; }
        .customer-dashboard-section-heading h2 { margin: .15rem 0 0; font-size: 1rem; }
        .customer-dashboard-quick-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
        .customer-dashboard-quick-link {
          position: relative;
          display: grid;
          min-width: 0;
          min-height: 74px;
          place-items: center;
          align-content: center;
          gap: 6px;
          padding: 9px 6px;
          border: 1px solid var(--color-border);
          border-radius: 14px;
          background: var(--color-surface);
          color: var(--color-ink);
          font-size: .76rem;
          font-weight: 780;
          text-align: center;
          box-shadow: var(--shadow-sm);
        }
        .customer-dashboard-quick-link:hover,
        .customer-dashboard-quick-link:focus-visible { border-color: var(--color-primary); background: var(--color-selected); color: var(--color-primary-strong); }
        .customer-dashboard-quick-icon { display: grid; width: 24px; height: 24px; place-items: center; color: var(--color-primary-strong); }
        .customer-dashboard-quick-icon .customer-mobile-quick-svg { width: 23px; height: 23px; }
        .customer-dashboard-quick-link > span:nth-child(2) { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .customer-dashboard-quick-badge {
          position: absolute;
          top: 7px;
          right: 8px;
          display: grid;
          min-width: 19px;
          height: 19px;
          place-items: center;
          padding: 0 4px;
          border-radius: 999px;
          background: var(--color-primary-strong);
          color: white;
          font-size: .55rem;
          font-weight: 850;
        }
        .customer-dashboard-more-links {
          margin-top: 9px;
          border-bottom: 1px solid var(--color-border);
        }
        .customer-dashboard-more-links > summary {
          display: flex;
          min-height: 42px;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 4px 2px;
          cursor: pointer;
          list-style: none;
          color: var(--color-ink-muted);
          font-size: .76rem;
          font-weight: 760;
        }
        .customer-dashboard-more-links > summary::-webkit-details-marker { display: none; }
        .customer-dashboard-more-link-row { display: flex; gap: 7px; flex-wrap: wrap; padding: 2px 0 11px; }
        .customer-dashboard-more-link-row a {
          display: inline-flex;
          min-height: 36px;
          align-items: center;
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: 999px;
          background: var(--color-surface);
          color: var(--color-ink-muted);
          font-size: .72rem;
          font-weight: 720;
        }
        .customer-activity-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          margin-top: 12px;
          overflow: hidden;
          border: 1px solid var(--color-border);
          border-radius: 14px;
          background: var(--color-border);
        }
        .customer-activity-strip-item {
          display: flex;
          min-width: 0;
          min-height: 58px;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 12px;
          background: var(--color-surface);
          color: var(--color-ink);
        }
        .customer-activity-strip-item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-ink-muted); font-size: .7rem; font-weight: 720; }
        .customer-activity-strip-item strong { flex: 0 0 auto; font-size: 1rem; }
        .customer-secondary-activity {
          margin-top: 12px;
          border: 1px solid var(--color-border);
          border-radius: 16px;
          background: var(--color-surface);
          box-shadow: var(--shadow-sm);
        }
        .customer-secondary-activity > summary {
          display: flex;
          min-height: 58px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          cursor: pointer;
          list-style: none;
        }
        .customer-secondary-activity > summary::-webkit-details-marker { display: none; }
        .customer-secondary-activity > summary > span:first-child { min-width: 0; display: grid; gap: 2px; }
        .customer-secondary-activity > summary strong { color: var(--color-ink); font-size: .88rem; }
        .customer-secondary-activity > summary small { color: var(--color-ink-muted); font-size: .72rem; line-height: 1.35; }
        .customer-secondary-activity-meta {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 8px;
          color: var(--color-ink-muted);
          font-size: .72rem;
          font-weight: 750;
        }
        .customer-secondary-activity-count {
          display: grid;
          min-width: 22px;
          height: 22px;
          place-items: center;
          padding: 0 5px;
          border-radius: 999px;
          background: var(--color-primary-strong);
          color: white;
          font-size: .62rem;
          font-weight: 850;
        }
        .customer-secondary-activity-caret { font-size: 1rem; transition: transform .16s ease; }
        .customer-secondary-activity[open] .customer-secondary-activity-caret { transform: rotate(180deg); }
        .customer-secondary-activity-body {
          display: grid;
          gap: 12px;
          border-top: 1px solid var(--color-border);
          padding: 12px;
        }
        .customer-secondary-activity-body .customer-product-order-attention-card,
        .customer-secondary-activity-body .customer-account-proposal-summary {
          box-shadow: none;
        }

        @media (max-width: 900px) {
          .customer-dashboard-quick-actions { display: none; }
          .customer-dashboard-more-links { margin-top: 8px; }
          .customer-dashboard-more-links > summary { min-height: 44px; }
          .customer-dashboard-more-link-row { gap: 6px; }
          .customer-dashboard-more-link-row a { min-height: 38px; }
          .customer-activity-strip { grid-template-columns: repeat(4, minmax(92px, 1fr)); overflow-x: auto; scrollbar-width: none; }
          .customer-activity-strip::-webkit-scrollbar { display: none; }
          .customer-activity-strip-item { min-height: 54px; padding: 8px 10px; }
          .customer-secondary-activity { margin-top: 10px; border-radius: 14px; }
          .customer-secondary-activity > summary { min-height: 54px; padding: 9px 11px; }
          .customer-secondary-activity > summary small { max-width: 62vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .customer-secondary-activity-body { padding: 10px; }
          .customer-mobile-quick-shell {
            position: sticky;
            top: 70px;
            z-index: 18;
            display: grid;
            gap: 7px;
            margin: 6px 0 14px;
            padding: 8px;
            border: 1px solid var(--color-border);
            border-radius: 18px;
            background: rgb(255 255 255 / 95%);
            box-shadow: 0 10px 30px rgb(29 28 54 / 9%);
            backdrop-filter: blur(14px);
          }
          .customer-mobile-quick-identity {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 1px 4px 0;
          }
          .customer-mobile-quick-identity > div {
            min-width: 0;
            display: grid;
            gap: 1px;
          }
          .customer-mobile-quick-identity strong,
          .customer-mobile-quick-identity span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .customer-mobile-quick-identity strong { color: var(--color-ink); font-size: .82rem; }
          .customer-mobile-quick-identity span { color: var(--color-ink-muted); font-size: .68rem; }
          .customer-mobile-quick-settings {
            flex: 0 0 auto;
            display: grid;
            width: 40px;
            height: 40px;
            place-items: center;
            border: 1px solid var(--color-border);
            border-radius: 50%;
            background: var(--color-surface);
            color: var(--color-primary-strong);
          }
          .customer-mobile-settings-svg { width: 19px; height: 19px; }
          .customer-mobile-quick-nav {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 4px;
          }
          .customer-mobile-quick-nav a {
            display: grid;
            min-width: 0;
            min-height: 54px;
            place-items: center;
            align-content: center;
            gap: 4px;
            padding: 5px 2px;
            border-radius: 12px;
            color: var(--color-ink-muted);
            font-size: .62rem;
            font-weight: 750;
            line-height: 1.05;
            text-align: center;
          }
          .customer-mobile-quick-nav a:hover,
          .customer-mobile-quick-nav a:focus-visible {
            background: var(--color-selected);
            color: var(--color-primary-strong);
          }
          .customer-mobile-quick-nav .customer-mobile-quick-icon {
            position: relative;
            display: grid;
            width: 22px;
            height: 22px;
            place-items: center;
            overflow: visible;
          }
          .customer-mobile-quick-svg { width: 21px; height: 21px; }
          .customer-mobile-quick-badge {
            position: absolute;
            top: -8px;
            right: -13px;
            display: grid;
            min-width: 17px;
            height: 17px;
            place-items: center;
            padding: 0 4px;
            border: 2px solid white;
            border-radius: 999px;
            background: var(--color-primary-strong);
            color: white;
            font-size: .52rem;
            font-weight: 850;
            line-height: 1;
          }
          .customer-mobile-quick-nav a > span:last-child {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
}
