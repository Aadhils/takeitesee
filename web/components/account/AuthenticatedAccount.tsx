'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import RoleIdentityMediaHeader from '../identity/RoleIdentityMediaHeader';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ProviderReadinessSummary } from './ProviderReadinessSummary';
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
        if (current) {
          currentUser = {
            id: current.id,
            name: current.user_metadata?.name ?? current.email ?? 'Account',
            email: current.email ?? '',
            phone: current.user_metadata?.phone,
            role: 'customer',
            createdAt: current.created_at,
            updatedAt: current.updated_at ?? current.created_at,
          };
        }
      } else {
        currentUser = localDevelopmentAuthAdapter.getCurrentUser();
      }
      if (cancelled) return;
      setUser(currentUser);
      if (!currentUser) return;
      try {
        const liveBookings = isSupabaseConfigured()
          ? await getBookingsThroughConfiguredRepository(currentUser.id)
          : getBookingsForCustomer(currentUser.id);
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

  if (!user) {
    return (
      <div className="account-page-heading">
        <span className="eyebrow">{t('auth.account')}</span>
        <h1>{t('account.yourAccount')}</h1>
        <p>{t('account.signInIntro')}</p>
        <div className="account-actions">
          <Link href="/login" className="button button-primary">{t('auth.signIn')}</Link>
          <Link href="/signup" className="button button-secondary">{t('auth.createAccount')}</Link>
        </div>
      </div>
    );
  }

  const signOut = async () => {
    if (isSupabaseConfigured()) await signOutWithSupabase();
    else localDevelopmentAuthAdapter.signOut();
    setUser(undefined);
  };

  return (
    <div className="account-page-heading">
      <span className="eyebrow">{t('auth.account')}</span>
      <h1>{t('account.welcome')}, {user.name.split(' ')[0]}.</h1>
      <p>{isSupabaseConfigured() ? t('account.productionSession') : t('account.localSession')}</p>

      {isSupabaseConfigured() ? <RoleIdentityMediaHeader
        context="customer"
        displayName={user.name}
        subtitle={tamil ? 'Personal customer account' : 'Personal customer account'}
        meta={[user.email, user.phone].filter(Boolean).join(' · ')}
      /> : <Card className="profile-summary">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{user.name.split(' ').map((part) => part[0]).join('')}</div>
        <div><span className="eyebrow">{t('account.signedInCustomer')}</span><h2>{user.name}</h2><p>{user.email}</p>{user.phone ? <span className="card-location">{user.phone}</span> : null}</div>
      </Card>}

      <WorkspaceSwitcher currentWorkspace="customer" />
      <ProviderReadinessSummary />

      <nav className="account-primary-nav" aria-label="Account shortcuts">
        <Link href="/bookings" className="button button-primary">{t('account.myBookings')}</Link>
        <Link href="/notifications" className="button button-secondary">{t('account.notifications')}</Link>
        <Link href="/saved-services" className="button button-secondary">{tamil ? 'சேமித்த சேவைகள்' : 'Saved services'}</Link>
        <Link href="/requirements" className="button button-secondary">{tamil ? 'தேவைகள்' : 'Requirements'}</Link>
        <Link href="/messages" className="button button-secondary">{tamil ? 'செய்திகள்' : 'Messages'}</Link>
        <Link href="/reviews" className="button button-secondary">{tamil ? 'மதிப்புரைகள்' : 'Reviews'}</Link>
        <Link href="/account/support" className="button button-secondary">{tamil ? 'Platform உதவி' : 'Platform support'}</Link>
        <Link href="/account/reports" className="button button-secondary">{tamil ? 'Safety reports' : 'Safety reports'}</Link>
        <Link href="/account/profile" className="button button-secondary">{t('account.profile')}</Link>
        <Link href="/account/settings" className="button button-secondary">{t('account.settings')}</Link>
        <Button type="button" variant="quiet" className="account-sign-out" onClick={signOut}>{t('account.signOut')}</Button>
      </nav>

      <div className="dashboard-stat-grid">
        <Card><span className="eyebrow">{t('account.upcoming')}</span><h2>{summary.upcoming}</h2><p>{t('account.upcomingDetail')}</p></Card>
        <Card><span className="eyebrow">{t('account.completed')}</span><h2>{summary.completed}</h2><p>{t('account.completedDetail')}</p></Card>
        <Card><span className="eyebrow">{t('account.cancelled')}</span><h2>{summary.cancelled}</h2><p>{t('account.cancelledDetail')}</p></Card>
        <Card><span className="eyebrow">{t('account.total')}</span><h2>{summary.total}</h2><p>{t('account.totalDetail')}</p></Card>
      </div>
      {bookingError ? <p role="alert" style={{ color: '#b42318' }}>{t('account.bookingUnavailable')}: {bookingError}</p> : null}
    </div>
  );
}
