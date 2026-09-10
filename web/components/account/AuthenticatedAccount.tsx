'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import RoleIdentityMediaHeader from '../identity/RoleIdentityMediaHeader';
import CustomerAccountProposalSummary from './CustomerAccountProposalSummary';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { getSupabaseBrowserUser, isSupabaseConfigured, localDevelopmentAuthAdapter, signOutWithSupabase } from '../../services/auth-adapter';
import { getBookingsForCustomer, getBookingsThroughConfiguredRepository } from '../../services/booking-repository';
import type { User } from '../../types/auth-domain';
import type { CustomerBooking } from '../../types/booking-domain';

export default function AuthenticatedAccount() {
  const { t, locale } = useIdentityWorkspaceTranslations();
  const tamil = locale === 'ta-IN';
  const [user, setUser] = useState<User>();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [bookingError, setBookingError] = useState('');

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

  const navigationGroups = [
    {
      id: 'activity',
      eyebrow: tamil ? 'என் செயல்பாடு' : 'My activity',
      title: tamil ? 'Bookings, orders & conversations' : 'Bookings, orders & conversations',
      links: [
        { href: '/bookings', label: tamil ? 'என் Bookings' : 'My bookings' },
        { href: '/orders', label: tamil ? 'என் Product Orders' : 'My product orders' },
        { href: '/messages', label: tamil ? 'செய்திகள்' : 'Messages' },
        { href: '/notifications', label: t('account.notifications') },
        { href: '/reviews', label: tamil ? 'மதிப்புரைகள்' : 'Reviews' },
      ],
    },
    {
      id: 'discover',
      eyebrow: tamil ? 'தேடு & திட்டமிடு' : 'Discover & plan',
      title: tamil ? 'சேவைகள், Products & தேவைகள்' : 'Services, Products & requirements',
      links: [
        { href: '/saved-services', label: tamil ? 'சேமித்த சேவைகள்' : 'Saved services' },
        { href: '/saved-products', label: tamil ? 'சேமித்த Products' : 'Saved Products' },
        { href: '/requirements', label: tamil ? 'என் தேவைகள்' : 'My requirements' },
        { href: '/explore', label: tamil ? 'சேவைகள் தேடு' : 'Explore services' },
        { href: '/products', label: tamil ? 'Products தேடு' : 'Browse Products' },
      ],
    },
    {
      id: 'account',
      eyebrow: tamil ? 'கணக்கு & உதவி' : 'Account & help',
      title: tamil ? 'Profile, settings & support' : 'Profile, settings & support',
      links: [
        { href: '/account/profile', label: t('account.profile') },
        { href: '/account/settings', label: t('account.settings') },
        { href: '/account/support', label: tamil ? 'Platform உதவி' : 'Platform support' },
        { href: '/account/reports', label: tamil ? 'Safety reports' : 'Safety reports' },
      ],
    },
  ];

  const mobileQuickLinks = [
    { href: '/bookings', label: tamil ? 'Bookings' : 'Bookings', icon: '▣' },
    { href: '/orders', label: tamil ? 'Orders' : 'Orders', icon: '□' },
    { href: '/messages', label: tamil ? 'செய்திகள்' : 'Messages', icon: '✉' },
    { href: '/account/profile', label: tamil ? 'Profile' : 'Profile', icon: '◯' },
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
          <Link href="/account/settings" className="customer-mobile-quick-settings" aria-label={tamil ? 'Account அமைப்புகள்' : 'Account settings'}>⚙</Link>
        </div>
        <nav className="customer-mobile-quick-nav" aria-label={tamil ? 'Customer முக்கிய வழிசெலுத்தல்' : 'Customer primary navigation'}>
          {mobileQuickLinks.map((link) => <Link href={link.href} key={link.href}>
            <span aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </Link>)}
        </nav>
      </section>

      {isSupabaseConfigured() ? <RoleIdentityMediaHeader context="customer" displayName={user.name} subtitle="Personal customer account" meta={[user.email, user.phone].filter(Boolean).join(' · ')} /> : <Card className="profile-summary"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{user.name.split(' ').map((part) => part[0]).join('')}</div><div><span className="eyebrow">{t('account.signedInCustomer')}</span><h2>{user.name}</h2><p>{user.email}</p>{user.phone ? <span className="card-location">{user.phone}</span> : null}</div></Card>}

      <WorkspaceSwitcher currentWorkspace="customer" />

      <CustomerAccountProposalSummary />

      <section className="dashboard-grid" aria-label={tamil ? 'Customer வழிசெலுத்தல்' : 'Customer navigation'}>
        {navigationGroups.map((group) => (
          <Card key={group.id}>
            <span className="eyebrow">{group.eyebrow}</span>
            <h2>{group.title}</h2>
            <nav className="account-secondary-actions" aria-label={group.eyebrow}>
              {group.links.map((link) => <Link href={link.href} className="account-action-chip" key={link.href}>{link.label}</Link>)}
            </nav>
          </Card>
        ))}
      </section>

      <div className="dashboard-stat-grid">
        <Card><span className="eyebrow">{t('account.upcoming')}</span><h2>{summary.upcoming}</h2><p>{t('account.upcomingDetail')}</p></Card>
        <Card><span className="eyebrow">{t('account.completed')}</span><h2>{summary.completed}</h2><p>{t('account.completedDetail')}</p></Card>
        <Card><span className="eyebrow">{t('account.cancelled')}</span><h2>{summary.cancelled}</h2><p>{t('account.cancelledDetail')}</p></Card>
        <Card><span className="eyebrow">{t('account.total')}</span><h2>{summary.total}</h2><p>{t('account.totalDetail')}</p></Card>
      </div>
      {bookingError ? <p role="alert" style={{ color: '#b42318' }}>{t('account.bookingUnavailable')}: {bookingError}</p> : null}

      <div className="account-actions">
        <Button type="button" variant="quiet" className="account-sign-out" onClick={signOut}>{t('account.signOut')}</Button>
      </div>

      <style jsx>{`
        .customer-mobile-quick-shell { display: none; }

        @media (max-width: 900px) {
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
            width: 34px;
            height: 34px;
            place-items: center;
            border: 1px solid var(--color-border);
            border-radius: 50%;
            background: var(--color-surface);
            color: var(--color-primary-strong);
            font-size: 1rem;
          }
          .customer-mobile-quick-nav {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 4px;
          }
          .customer-mobile-quick-nav a {
            display: grid;
            min-width: 0;
            min-height: 48px;
            place-items: center;
            align-content: center;
            gap: 3px;
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
          .customer-mobile-quick-nav a > span:first-child { font-size: 1.03rem; }
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
