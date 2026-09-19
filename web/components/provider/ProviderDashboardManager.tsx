'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { LiveProviderShell } from './LiveProviderShell';
import ProviderDashboardIdentityCenter from './ProviderDashboardIdentityCenter';
import styles from './ProviderDashboardManager.module.css';

type Profile = {
  display_name: string;
  provider_type: 'professional' | 'business';
  verified: boolean;
  profile_complete: boolean;
  marketplace_disclosure_complete: boolean;
  trust_status: 'normal' | 'reverification_required' | 'suspended';
  services_active: number;
  services_total: number;
  location: string;
};

type Booking = {
  id: string;
  booking_reference: string;
  service_name?: string;
  status: string;
  payment_status?: string;
  booking_date?: string | null;
  start_time?: string | null;
  timezone?: string | null;
  duration_minutes?: number | null;
  quoted_price?: number | null;
  currency?: string | null;
  attendance_outcome?: 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
  closeout_state?: 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed';
};

type DashboardIconKey = 'alert' | 'profile' | 'service' | 'schedule' | 'lead' | 'message' | 'booking' | 'job' | 'people' | 'resume' | 'portfolio';
type DashboardLink = { href: string; label: string; detail: string; icon: DashboardIconKey };
type DashboardJumpLink = { href: string; label: string; route?: boolean };

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  try {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = targetUtc;
    for (let index = 0; index < 3; index += 1) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const representedUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second),
      );
      guess += targetUtc - representedUtc;
    }
    return guess;
  } catch {
    return new Date(`${date}T${time.slice(0, 8)}Z`).getTime();
  }
}

function bookingEndEpoch(booking: Booking) {
  if (!booking.booking_date || !booking.start_time) return Number.POSITIVE_INFINITY;
  const start = zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata');
  return start + Number(booking.duration_minutes || 0) * 60_000;
}

function terminalCloseout(booking: Booking) {
  return booking.attendance_outcome === 'customer_no_show'
    || booking.attendance_outcome === 'provider_no_show'
    || booking.closeout_state === 'eligible_to_close'
    || booking.closeout_state === 'closed';
}

function DashboardIcon({ name }: { name: DashboardIconKey }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'alert' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 17h.01" /></> : null}
    {name === 'profile' ? <><circle cx="12" cy="8" r="3" /><path d="M6 20c.8-4 3-6 6-6s5.2 2 6 6" /></> : null}
    {name === 'service' ? <><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.3 2.3-3-3 2.3-2.3Z" /></> : null}
    {name === 'schedule' ? <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M8 14h3" /></> : null}
    {name === 'lead' ? <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><path d="m5.6 5.6 2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /></> : null}
    {name === 'message' ? <><path d="M5 5h14v10H9l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></> : null}
    {name === 'booking' ? <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></> : null}
    {name === 'job' ? <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2" /></> : null}
    {name === 'people' ? <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2" /><path d="M4 20c.7-4 2.5-6 5-6s4.3 2 5 6M14 15c2.8 0 4.7 1.7 5.5 5" /></> : null}
    {name === 'resume' ? <><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v5h4M10 12h5M10 16h5" /></> : null}
    {name === 'portfolio' ? <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M9 5V3h6v2M4 10h16" /></> : null}
  </svg>;
}

export default function ProviderDashboardManager({ children, workspaceVersion = 0 }: { children?: ReactNode; workspaceVersion?: number }) {
  const { t } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [bookingsError, setBookingsError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setProfileError('');
    setBookingsError('');

    const [profileResult, bookingsResult] = await Promise.allSettled([
      fetch('/api/provider/profile', { cache: 'no-store' }).then(async (response) => ({ response, payload: await response.json() })),
      fetch('/api/provider/bookings', { cache: 'no-store' }).then(async (response) => ({ response, payload: await response.json() })),
    ]);

    if (profileResult.status === 'fulfilled') {
      const { response, payload } = profileResult.value;
      if (response.ok && payload.profile) setProfile(payload.profile as Profile);
      else { setProfile(null); setProfileError(payload.error ?? t('provider.dashboard.profileLoadFallback')); }
    } else { setProfile(null); setProfileError(profileResult.reason instanceof Error ? profileResult.reason.message : t('provider.dashboard.profileLoadFallback')); }

    if (bookingsResult.status === 'fulfilled') {
      const { response, payload } = bookingsResult.value;
      if (response.ok) setBookings(Array.isArray(payload.bookings) ? payload.bookings : Array.isArray(payload) ? payload : []);
      else { setBookings([]); setBookingsError(payload.error ?? t('provider.dashboard.bookingsLoadFallback')); }
    } else { setBookings([]); setBookingsError(bookingsResult.reason instanceof Error ? bookingsResult.reason.message : t('provider.dashboard.bookingsLoadFallback')); }

    setLoading(false);
  }, [t]);

  useEffect(() => { void load(); }, [load, workspaceVersion]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('booking:provider-list-refresh', refresh);
    return () => window.removeEventListener('booking:provider-list-refresh', refresh);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const operations = useMemo(() => {
    const needsAction = bookings
      .filter((booking) => !terminalCloseout(booking) && (
        booking.status === 'pending'
        || booking.status === 'rescheduled'
        || (booking.status === 'confirmed' && (booking.attendance_outcome ?? 'pending') === 'pending' && bookingEndEpoch(booking) <= now)
      ))
      .sort((left, right) => {
        const rank = (booking: Booking) => booking.status === 'pending' ? 0 : booking.status === 'rescheduled' ? 1 : 2;
        const rankDiff = rank(left) - rank(right);
        if (rankDiff) return rankDiff;
        return bookingEndEpoch(left) - bookingEndEpoch(right);
      });
    const upcoming = bookings
      .filter((booking) => !terminalCloseout(booking) && booking.status === 'confirmed' && (booking.attendance_outcome ?? 'pending') === 'pending' && bookingEndEpoch(booking) > now)
      .sort((left, right) => bookingEndEpoch(left) - bookingEndEpoch(right));
    const completed = bookings.filter((booking) => booking.status === 'completed');
    return { needsAction, upcoming, completed };
  }, [bookings, now]);

  const providerRoleLabel = profile?.provider_type === 'business' ? t('profile.business') : t('profile.professional');
  const providerStatusLabel = profile
    ? profile.trust_status === 'suspended'
      ? t('provider.suspended')
      : profile.trust_status === 'reverification_required'
        ? t('provider.reverify')
        : profile.verified
          ? t('profile.verified')
          : t('profile.verificationPending')
    : t('provider.workspace');

  const nextSteps = useMemo<DashboardLink[]>(() => {
    if (!profile) return [];
    const items: DashboardLink[] = [];
    if (profile.trust_status === 'suspended') items.push({
      href: '/provider/setup',
      label: t('provider.dashboard.marketplaceSuspended'),
      detail: t('provider.dashboard.marketplaceSuspendedBody'),
      icon: 'alert',
    });
    else if (profile.trust_status === 'reverification_required') items.push({
      href: '/provider/verification',
      label: t('provider.dashboard.completeReverification'),
      detail: t('provider.dashboard.completeReverificationBody'),
      icon: 'alert',
    });
    else if (!profile.verified) items.push({
      href: '/provider/verification',
      label: t('provider.dashboard.completeVerification'),
      detail: t('provider.dashboard.completeVerificationBody'),
      icon: 'alert',
    });

    if (!profile.profile_complete) items.push({
      href: '/provider#provider-profile',
      label: profile.provider_type === 'business'
        ? t('provider.dashboard.finishBusinessProfile')
        : t('provider.dashboard.finishProfessionalProfile'),
      detail: t('provider.dashboard.finishProfileBody'),
      icon: 'profile',
    });
    else if (!profile.marketplace_disclosure_complete) items.push({
      href: '/provider/public-readiness',
      label: profile.provider_type === 'business'
        ? t('provider.dashboard.finishStorefrontReadiness')
        : t('provider.dashboard.finishPublicReadiness'),
      detail: t('provider.dashboard.finishReadinessBody'),
      icon: 'profile',
    });

    if (profile.services_total === 0) items.push({
      href: '/provider/services',
      label: t('provider.dashboard.addFirstService'),
      detail: t('provider.dashboard.addFirstServiceBody'),
      icon: 'service',
    });
    else if (profile.services_active === 0) items.push({
      href: '/provider/services',
      label: t('provider.dashboard.publishActiveService'),
      detail: t('provider.dashboard.publishActiveServiceBody'),
      icon: 'service',
    });

    if (operations.needsAction.length > 0) {
      const booking = operations.needsAction[0];
      const serviceLabel = booking.service_name || booking.booking_reference;
      const remaining = operations.needsAction.length - 1;
      const bookingCopy = booking.status === 'pending'
        ? { label: `${t('provider.dashboard.confirmPrefix')} ${serviceLabel}`, detail: t('provider.dashboard.customerWaiting') }
        : booking.status === 'rescheduled'
          ? { label: `${t('provider.dashboard.reviewNewTimePrefix')} ${serviceLabel}`, detail: t('provider.dashboard.scheduleChange') }
          : {
              label: `${t('provider.dashboard.finishServicePrefix')} ${serviceLabel} ${t('provider.dashboard.finishServiceSuffix')}`,
              detail: t('provider.dashboard.serviceWindowEnded'),
            };
      const remainingCopy = remaining === 1
        ? t('provider.dashboard.moreActionOne')
        : remaining > 1
          ? `${remaining} ${t('provider.dashboard.moreActionsSuffix')}`
          : '';
      items.push({
        href: `/provider/bookings/${encodeURIComponent(booking.id)}`,
        label: bookingCopy.label,
        detail: remainingCopy ? `${bookingCopy.detail} ${remainingCopy}` : bookingCopy.detail,
        icon: 'booking',
      });
    } else if (operations.upcoming.length > 0) items.push({
      href: `/provider/bookings/${encodeURIComponent(operations.upcoming[0].id)}`,
      label: t('provider.dashboard.nextServiceReady'),
      detail: `${operations.upcoming[0].service_name || operations.upcoming[0].booking_reference} · ${operations.upcoming[0].booking_date || t('provider.dashboard.datePending')}${operations.upcoming[0].start_time ? ` · ${operations.upcoming[0].start_time}` : ''}.`,
      icon: 'schedule',
    });

    if (profile.provider_type === 'professional') items.push({
      href: '/provider/jobs/applications',
      label: t('provider.dashboard.checkCareerJourney'),
      detail: t('provider.dashboard.checkCareerJourneyBody'),
      icon: 'job',
    });
    else items.push({
      href: '/provider/jobs',
      label: t('provider.dashboard.checkHiringPipeline'),
      detail: t('provider.dashboard.checkHiringPipelineBody'),
      icon: 'people',
    });
    return items.slice(0, 3);
  }, [operations.needsAction, operations.upcoming, profile, t]);

  const providerQuickActions: DashboardLink[] = profile?.provider_type === 'business'
    ? [
        { href: '/provider/leads', label: t('provider.leads'), detail: t('provider.dashboard.customerOpportunities'), icon: 'lead' },
        { href: '/provider/messages', label: t('provider.messages'), detail: t('provider.dashboard.customerConversations'), icon: 'message' },
        { href: '/provider/bookings', label: t('provider.bookings'), detail: t('provider.dashboard.serviceDelivery'), icon: 'booking' },
        { href: '/provider/schedule', label: t('provider.schedule'), detail: t('provider.dashboard.availabilityWork'), icon: 'schedule' },
        { href: '/provider/jobs', label: t('provider.dashboard.employerJobs'), detail: t('provider.dashboard.hiringPipeline'), icon: 'job' },
        { href: '/provider/jobs/applicants', label: t('provider.dashboard.applicants'), detail: t('provider.dashboard.candidateReview'), icon: 'people' },
        { href: '/provider/services', label: t('provider.services'), detail: t('provider.dashboard.serviceCatalog'), icon: 'service' },
        { href: '/provider/products', label: t('provider.dashboard.products'), detail: t('provider.dashboard.storefrontCatalog'), icon: 'portfolio' },
      ]
    : [
        { href: '/provider/leads', label: t('provider.leads'), detail: t('provider.dashboard.customerOpportunities'), icon: 'lead' },
        { href: '/provider/messages', label: t('provider.messages'), detail: t('provider.dashboard.customerConversations'), icon: 'message' },
        { href: '/provider/bookings', label: t('provider.bookings'), detail: t('provider.dashboard.serviceDelivery'), icon: 'booking' },
        { href: '/provider/schedule', label: t('provider.schedule'), detail: t('provider.dashboard.availabilityWork'), icon: 'schedule' },
        { href: '/jobs', label: t('provider.dashboard.findJobs'), detail: t('provider.dashboard.businessOpportunities'), icon: 'job' },
        { href: '/provider/jobs/applications', label: t('provider.dashboard.applications'), detail: t('provider.dashboard.careerJourney'), icon: 'booking' },
        { href: '/provider/resume', label: t('provider.dashboard.resume'), detail: t('provider.dashboard.careerProfile'), icon: 'resume' },
        { href: '/provider/portfolio', label: t('provider.dashboard.portfolio'), detail: t('provider.dashboard.previousWork'), icon: 'portfolio' },
      ];

  const providerPrimaryQuickActions = providerQuickActions.slice(0, 4);
  const providerRoleQuickActions = providerQuickActions.slice(4);

  const dashboardJumpLinks: DashboardJumpLink[] = profile
    ? [
        { href: '#provider-dashboard-overview', label: t('provider.dashboard.overview') },
        { href: '#provider-profile', label: profile.provider_type === 'business' ? t('provider.dashboard.businessProfile') : t('provider.dashboard.professionalProfile') },
        { href: '#provider-marketplace-launch', label: t('provider.dashboard.marketplace') },
        { href: '#provider-booking-availability', label: t('provider.dashboard.availability') },
        { href: '#provider-service-reach', label: t('provider.dashboard.reach') },
        { href: '#provider-booking-inbox', label: t('provider.bookings') },
        profile.provider_type === 'business'
          ? { href: '/provider/products', label: t('provider.dashboard.products'), route: true }
          : { href: '/provider/jobs/applications', label: t('provider.dashboard.career'), route: true },
      ]
    : [];

  const priorityAction = nextSteps[0] ?? null;
  const followUpActions = nextSteps.slice(1);
  const nextUpcoming = operations.upcoming[0] ?? null;
  const nextUpcomingHref = nextUpcoming ? `/provider/bookings/${encodeURIComponent(nextUpcoming.id)}` : null;
  const priorityShowsNextService = Boolean(nextUpcomingHref && priorityAction?.href === nextUpcomingHref);
  const providerActivitySignals = profile
    ? [
        ...(!bookingsError && operations.needsAction.length > 0
          ? [{ href: '/provider/bookings', label: t('provider.dashboard.needsAction'), value: String(operations.needsAction.length) }]
          : []),
        ...(!bookingsError && operations.upcoming.length > 0
          ? [{ href: '/provider/schedule', label: t('provider.dashboard.upcoming'), value: String(operations.upcoming.length) }]
          : []),
        ...(profile.services_active > 0
          ? [{ href: '/provider/services', label: t('provider.dashboard.activeServices'), value: `${profile.services_active}/${profile.services_total}` }]
          : []),
      ]
    : [];
  const providerActivityEmpty = profile && providerActivitySignals.length === 0
    ? {
        href: '/provider/services',
        label: profile.services_total === 0 ? t('provider.dashboard.activityStarts') : t('provider.dashboard.noLiveActivity'),
        detail: profile.services_total === 0 ? t('provider.dashboard.activityStartsBody') : t('provider.dashboard.noLiveActivityBody'),
      }
    : null;

  return <LiveProviderShell active="/provider">
    <div id="provider-dashboard-overview" className={styles.dashboardStack}>
      {profile ? <nav className={styles.workspaceToolbar} aria-label={t('provider.dashboard.workspaceToolbar')}>
        <div className={styles.workspaceIdentity}>
          <span className={styles.workspaceRole}>{providerRoleLabel}</span>
          <Badge tone={profile.trust_status === 'normal' && profile.verified ? 'success' : profile.trust_status === 'suspended' ? 'danger' : 'warning'}>{providerStatusLabel}</Badge>
        </div>
        <div className={styles.workspaceRail}>
          {dashboardJumpLinks.map((item) => item.route
            ? <Link href={item.href} className={`${styles.workspaceLink} ${styles.workspaceRoute}`} key={item.href}>{item.label}<span aria-hidden="true">↗</span></Link>
            : <a href={item.href} className={styles.workspaceLink} key={item.href}>{item.label}</a>)}
        </div>
        <Link href="/provider#provider-profile" className={styles.workspaceEdit}>{t('provider.dashboard.editProfile')}</Link>
      </nav> : null}

      {loading ? <Card className={styles.supportCard}><p>{t('provider.dashboard.preparing')}</p></Card> : null}
      {profileError ? <Card className={styles.supportCard}><p role="alert" style={{ color: 'var(--color-danger)' }}>{profileError}</p><Link href="/provider/setup" className="text-link">{t('provider.dashboard.openSetup')}</Link></Card> : null}

      {profile ? <>
        <Card className={`${styles.priorityPanel} ${priorityAction ? styles.priorityAttention : styles.priorityClear}`}>
          {priorityAction ? <>
            <div className={styles.priorityHeader}>
              <div className={styles.priorityMain}><span className={styles.priorityIcon}><DashboardIcon name={priorityAction.icon} /></span><div className={styles.priorityCopy}><span className="eyebrow">{t('provider.dashboard.priorityNow')}</span><h2>{priorityAction.label}</h2><p>{priorityAction.detail}</p></div></div>
              <Badge tone="warning">{t('provider.dashboard.nextBestAction')}</Badge>
            </div>
            <div className={styles.priorityActions}><Link href={priorityAction.href} className="button button-primary">{t('provider.dashboard.continueNow')}</Link></div>
            {followUpActions.length ? <div className={styles.followUpQueue} aria-label={t('provider.dashboard.followUps')}>
              <span className={styles.followUpQueueLabel}>{t('provider.dashboard.also')}</span>
              <div className={styles.followUpRail}>
                {followUpActions.map((item) => <Link
                  href={item.href}
                  className={styles.followUpChip}
                  key={item.href}
                  aria-label={`${item.label}. ${item.detail}`}
                  title={item.detail}
                >
                  <span className={styles.followUpChipIcon}><DashboardIcon name={item.icon} /></span>
                  <span>{item.label}</span>
                </Link>)}
              </div>
            </div> : null}
          </> : <div className={styles.priorityMain}><span className={styles.priorityIcon}><DashboardIcon name="profile" /></span><div className={styles.priorityCopy}><span className="eyebrow">{t('provider.dashboard.priorityNow')}</span><h2>{t('provider.dashboard.allCaughtUp')}</h2><p>{t('provider.dashboard.allCaughtUpBody')}</p></div></div>}
        </Card>

        <section className={styles.providerActivityStrip} aria-label={t('provider.dashboard.workspaceSummary')}>
          {providerActivitySignals.map((item) => <Link href={item.href} className={styles.providerActivityItem} key={item.href}>
            <span>{item.label}</span><strong>{item.value}</strong>
          </Link>)}
          {providerActivityEmpty ? <Link href={providerActivityEmpty.href} className={styles.providerActivityEmpty}>
            <span>{providerActivityEmpty.label}</span>
            <small>{providerActivityEmpty.detail}</small>
          </Link> : null}
        </section>

        <section className={styles.providerQuickActions} aria-label={t('provider.dashboard.quickActions')}>
          <div className={styles.providerQuickHeading}>
            <div><span className="eyebrow">{t('provider.dashboard.quickActions')}</span><h2>{t('provider.dashboard.goWhereNeeded')}</h2></div>
            <Badge tone="info">{profile.provider_type === 'business' ? t('profile.business') : t('profile.professional')}</Badge>
          </div>

          <nav className={styles.providerQuickPrimaryGrid} aria-label={t('provider.dashboard.primaryQuickActions')}>
            {providerPrimaryQuickActions.map((link) => <Link href={link.href} className={styles.providerQuickLink} key={link.href}>
              <span className={styles.providerQuickIcon}><DashboardIcon name={link.icon} /></span>
              <span className={styles.providerQuickLabel}>{link.label}</span>
              <small>{link.detail}</small>
            </Link>)}
          </nav>

          <details className={styles.providerQuickMore}>
            <summary>
              <span>{profile.provider_type === 'business' ? t('provider.dashboard.moreBusinessTools') : t('provider.dashboard.moreCareerTools')}</span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <nav className={styles.providerQuickMoreGrid} aria-label={profile.provider_type === 'business' ? t('provider.dashboard.moreBusinessTools') : t('provider.dashboard.moreCareerTools')}>
              {providerRoleQuickActions.map((link) => <Link href={link.href} className={styles.providerQuickLink} key={link.href}>
                <span className={styles.providerQuickIcon}><DashboardIcon name={link.icon} /></span>
                <span className={styles.providerQuickLabel}>{link.label}</span>
                <small>{link.detail}</small>
              </Link>)}
            </nav>
          </details>

          <nav className={styles.providerQuickMobileRoleGrid} aria-label={profile.provider_type === 'business' ? t('provider.dashboard.businessTools') : t('provider.dashboard.careerTools')}>
            {providerRoleQuickActions.map((link) => <Link href={link.href} className={styles.providerQuickLink} key={link.href}>
              <span className={styles.providerQuickIcon}><DashboardIcon name={link.icon} /></span>
              <span className={styles.providerQuickLabel}>{link.label}</span>
              <small>{link.detail}</small>
            </Link>)}
          </nav>
        </section>

        <ProviderDashboardIdentityCenter onProfileUpdated={load} />

        {bookingsError ? <section className={`${styles.nextServiceCompact} ${styles.nextServiceError}`} aria-label={t('provider.dashboard.bookingStatus')}>
          <div className={styles.nextServiceCopy}>
            <span className="eyebrow">{t('provider.bookings')}</span>
            <strong>{t('provider.dashboard.bookingRefresh')}</strong>
            <small>{t('provider.dashboard.bookingRefreshBody')}</small>
          </div>
          <Link href="/provider/bookings" className={styles.nextServiceAction}>{t('provider.dashboard.openBookings')}</Link>
        </section> : nextUpcoming && !priorityShowsNextService ? <section className={styles.nextServiceCompact} aria-label={t('provider.dashboard.nextService')}>
          <span className={styles.nextServiceIcon}><DashboardIcon name="schedule" /></span>
          <div className={styles.nextServiceCopy}>
            <span className="eyebrow">{t('provider.dashboard.nextService')}</span>
            <strong>{nextUpcoming.service_name || nextUpcoming.booking_reference}</strong>
            <small>{nextUpcoming.booking_date || t('provider.dashboard.datePending')}{nextUpcoming.start_time ? ` · ${nextUpcoming.start_time}` : ''}{operations.upcoming.length > 1 ? ` · ${operations.upcoming.length - 1} ${t('provider.dashboard.moreUpcomingSuffix')}` : ''}</small>
          </div>
          <Link href={nextUpcomingHref || '/provider/bookings'} className={styles.nextServiceAction}>{t('provider.dashboard.viewService')}</Link>
        </section> : null}
      </> : null}

      {children}
    </div>
  </LiveProviderShell>;
}
