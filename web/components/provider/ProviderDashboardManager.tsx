'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import styles from './ProviderDashboardManager.module.css';

type Profile = {
  display_name: string;
  provider_type: 'professional' | 'business';
  verified: boolean;
  marketplace_disclosure_complete: boolean;
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
type MetricTone = 'neutral' | 'success' | 'warning' | 'info';

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

function ActionGrid({ links }: { links: DashboardLink[] }) {
  return <div className={styles.actionGrid}>
    {links.map((link) => <Link href={link.href} className={styles.actionCard} key={link.href}>
      <div className={styles.actionCardTop}>
        <span className={styles.actionIcon}><DashboardIcon name={link.icon} /></span>
        <span className={styles.actionArrow} aria-hidden="true">↗</span>
      </div>
      <strong>{link.label}</strong>
      <p>{link.detail}</p>
    </Link>)}
  </div>;
}

function MetricCard({ href, label, value, detail, tone, icon }: { href: string; label: string; value: string; detail: string; tone: MetricTone; icon: DashboardIconKey }) {
  const toneClass = tone === 'warning' ? styles.metricWarning : tone === 'success' ? styles.metricSuccess : tone === 'info' ? styles.metricInfo : '';
  return <Link href={href} className={`${styles.metricCard} ${toneClass}`}>
    <div className={styles.metricTop}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricIcon}><DashboardIcon name={icon} /></span>
    </div>
    <strong className={styles.metricValue}>{value}</strong>
    <span className={styles.metricDetail}>{detail}</span>
    <span className={styles.metricLinkHint}>Open details →</span>
  </Link>;
}

export default function ProviderDashboardManager() {
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
      else {
        setProfile(null);
        setProfileError(payload.error ?? 'Unable to load provider profile.');
      }
    } else {
      setProfile(null);
      setProfileError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Unable to load provider profile.');
    }

    if (bookingsResult.status === 'fulfilled') {
      const { response, payload } = bookingsResult.value;
      if (response.ok) {
        setBookings(Array.isArray(payload.bookings) ? payload.bookings : Array.isArray(payload) ? payload : []);
      } else {
        setBookings([]);
        setBookingsError(payload.error ?? 'Unable to load booking activity.');
      }
    } else {
      setBookings([]);
      setBookingsError(bookingsResult.reason instanceof Error ? bookingsResult.reason.message : 'Unable to load booking activity.');
    }

    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
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
    const needsAction = bookings.filter((booking) => !terminalCloseout(booking) && (
      booking.status === 'pending'
      || booking.status === 'rescheduled'
      || (booking.status === 'confirmed'
        && (booking.attendance_outcome ?? 'pending') === 'pending'
        && bookingEndEpoch(booking) <= now)
    ));
    const upcoming = bookings
      .filter((booking) => !terminalCloseout(booking)
        && booking.status === 'confirmed'
        && (booking.attendance_outcome ?? 'pending') === 'pending'
        && bookingEndEpoch(booking) > now)
      .sort((left, right) => bookingEndEpoch(left) - bookingEndEpoch(right))
      .slice(0, 4);
    const completed = bookings.filter((booking) => booking.status === 'completed');
    return { needsAction, upcoming, completed };
  }, [bookings, now]);

  const roleLabel = profile?.provider_type === 'business'
    ? 'Business · Service business + Employer'
    : 'Professional · Independent provider + Job seeker';

  const profileReadiness = profile
    ? profile.verified && profile.marketplace_disclosure_complete
      ? { value: 'Ready', detail: 'Verified and public details complete', tone: 'success' as const }
      : profile.verified
        ? { value: 'Finish setup', detail: 'Complete public marketplace details', tone: 'warning' as const }
        : { value: 'Verify', detail: 'Verification is still required', tone: 'warning' as const }
    : { value: '—', detail: 'Provider profile is loading', tone: 'neutral' as const };

  const nextSteps = useMemo<DashboardLink[]>(() => {
    if (!profile) return [];
    const items: DashboardLink[] = [];

    if (!profile.verified) {
      items.push({ href: '/provider/verification', label: 'Complete verification', detail: 'Unlock trusted marketplace participation.', icon: 'alert' });
    }
    if (!profile.marketplace_disclosure_complete) {
      items.push({
        href: profile.provider_type === 'professional' ? '/provider/public-readiness' : '/provider/setup',
        label: 'Finish public profile',
        detail: 'Complete the details customers need before choosing you.',
        icon: 'profile',
      });
    }
    if (profile.services_total === 0) {
      items.push({ href: '/provider/services', label: 'Add your first service', detail: 'Create the service customers can discover and book.', icon: 'service' });
    } else if (profile.services_active === 0) {
      items.push({ href: '/provider/services', label: 'Publish an active service', detail: 'Your services exist but none are currently active.', icon: 'service' });
    }
    if (operations.needsAction.length > 0) {
      items.push({ href: '/provider/bookings', label: `Handle ${operations.needsAction.length} booking action${operations.needsAction.length === 1 ? '' : 's'}`, detail: 'Review requests, reschedules or completion tasks.', icon: 'booking' });
    } else if (operations.upcoming.length > 0) {
      items.push({ href: '/provider/schedule', label: 'Review your upcoming schedule', detail: `${operations.upcoming.length} confirmed booking${operations.upcoming.length === 1 ? '' : 's'} coming up.`, icon: 'schedule' });
    }

    if (profile.provider_type === 'professional') {
      items.push({ href: '/provider/jobs/applications', label: 'Check your career journey', detail: 'Applications, interviews and job progress in one place.', icon: 'job' });
    } else {
      items.push({ href: '/provider/jobs', label: 'Check your hiring pipeline', detail: 'Jobs, applicants, interviews and offers in one place.', icon: 'people' });
    }

    return items.slice(0, 3);
  }, [operations.needsAction.length, operations.upcoming.length, profile]);

  const customerActions: DashboardLink[] = [
    { href: '/provider/leads', label: 'Leads', detail: 'Review new customer opportunities.', icon: 'lead' },
    { href: '/provider/messages', label: 'Messages', detail: 'Continue active customer conversations.', icon: 'message' },
    { href: '/provider/bookings', label: 'Bookings', detail: 'Manage requests and service delivery.', icon: 'booking' },
    { href: '/provider/schedule', label: 'Schedule', detail: 'Plan availability and upcoming work.', icon: 'schedule' },
  ];

  const roleActions: DashboardLink[] = profile?.provider_type === 'business'
    ? [
        { href: '/provider/jobs', label: 'Employer jobs', detail: 'Post jobs and manage the hiring journey.', icon: 'job' },
        { href: '/provider/jobs/applicants', label: 'Applicant finder', detail: 'Review Professionals across your job posts.', icon: 'people' },
        { href: '/provider/services', label: 'Business services', detail: 'Manage services customers can book.', icon: 'service' },
        { href: '/provider/profile', label: 'Business profile', detail: 'Review your public business identity.', icon: 'profile' },
      ]
    : [
        { href: '/jobs', label: 'Find jobs', detail: 'Browse jobs published by verified Businesses.', icon: 'job' },
        { href: '/provider/jobs/applications', label: 'My applications', detail: 'Track applications and interviews.', icon: 'booking' },
        { href: '/provider/resume', label: 'Resume & Career', detail: 'Keep your career profile ready to apply.', icon: 'resume' },
        { href: '/provider/portfolio', label: 'Portfolio', detail: 'Show customers your previous work.', icon: 'portfolio' },
      ];

  const dashboardTitle = profile?.provider_type === 'business' ? 'Business dashboard' : profile?.provider_type === 'professional' ? 'Professional dashboard' : 'Provider dashboard';
  const dashboardDescription = profile?.provider_type === 'business'
    ? 'Your business command center for services, customer work and hiring.'
    : profile?.provider_type === 'professional'
      ? 'Your command center for services, customer work and career opportunities.'
      : 'Your provider workspace at a glance.';

  const priorityAction = nextSteps[0] ?? null;
  const followUpActions = nextSteps.slice(1);

  return <LiveProviderShell active="/provider">
    <div className={styles.dashboardStack}>
      <ProviderHeading
        eyebrow={profile ? roleLabel : 'Provider workspace'}
        title={dashboardTitle}
        description={dashboardDescription}
        action={profile ? <Link href={profile.provider_type === 'professional' ? '/provider/public-readiness' : '/provider/profile'} className="button button-secondary">View public profile</Link> : undefined}
      />

      {loading ? <Card className={styles.supportCard}><p>Preparing your workspace overview…</p></Card> : null}
      {profileError ? <Card className={styles.supportCard}><p role="alert" style={{ color: 'var(--color-danger)' }}>{profileError}</p><Link href="/provider/setup" className="text-link">Open provider setup</Link></Card> : null}

      {profile ? <>
        <section className={`${styles.roleStrip} ${profile.provider_type === 'business' ? styles.businessRole : styles.professionalRole}`} aria-label="Active provider identity">
          <div className={styles.roleIdentity}>
            <span className={styles.roleMark}><DashboardIcon name={profile.provider_type === 'business' ? 'people' : 'profile'} /></span>
            <div className={styles.roleCopy}>
              <strong>{profile.provider_type === 'business' ? 'Business workspace' : 'Professional workspace'}</strong>
              <span>{profile.provider_type === 'business' ? 'Service business + Employer' : 'Independent provider + Job seeker'}</span>
            </div>
          </div>
          <div className={styles.roleMeta}>
            <span className={styles.roleLocation}>{profile.location || 'Service area not set'}</span>
            <Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? 'Verified' : 'Verification required'}</Badge>
          </div>
        </section>

        <section className={styles.metricsGrid} aria-label="Workspace summary">
          <MetricCard
            href="/provider/bookings"
            label="Needs action"
            value={bookingsError ? '—' : String(operations.needsAction.length)}
            detail={bookingsError ? 'Booking activity temporarily unavailable' : 'Requests, reschedules or completion tasks'}
            tone={bookingsError ? 'warning' : operations.needsAction.length ? 'warning' : 'success'}
            icon="alert"
          />
          <MetricCard
            href="/provider/schedule"
            label="Upcoming work"
            value={bookingsError ? '—' : String(operations.upcoming.length)}
            detail={bookingsError ? 'Open Bookings to retry' : 'Future confirmed bookings'}
            tone={bookingsError ? 'warning' : 'info'}
            icon="schedule"
          />
          <MetricCard
            href="/provider/services"
            label="Active services"
            value={`${profile.services_active}/${profile.services_total}`}
            detail={profile.services_active ? 'Visible service catalog' : 'Add or publish a service'}
            tone={profile.services_active ? 'success' : 'warning'}
            icon="service"
          />
          <MetricCard
            href={profile.provider_type === 'professional' ? '/provider/public-readiness' : '/provider/setup'}
            label="Profile readiness"
            value={profileReadiness.value}
            detail={profileReadiness.detail}
            tone={profileReadiness.tone}
            icon="profile"
          />
        </section>

        <Card className={`${styles.priorityPanel} ${priorityAction ? styles.priorityAttention : styles.priorityClear}`}>
          {priorityAction ? <>
            <div className={styles.priorityHeader}>
              <div className={styles.priorityMain}>
                <span className={styles.priorityIcon}><DashboardIcon name={priorityAction.icon} /></span>
                <div className={styles.priorityCopy}>
                  <span className="eyebrow">Priority now</span>
                  <h2>{priorityAction.label}</h2>
                  <p>{priorityAction.detail}</p>
                </div>
              </div>
              <Badge tone="warning">Next best action</Badge>
            </div>
            <div className={styles.priorityActions}>
              <Link href={priorityAction.href} className="button button-primary">Continue now</Link>
            </div>
            {followUpActions.length ? <div className={styles.followUps} aria-label="Follow-up actions">
              {followUpActions.map((item) => <Link href={item.href} className={styles.followUpLink} key={item.href}>
                <div><strong>{item.label}</strong><span>{item.detail}</span></div>
                <span className={styles.followUpArrow} aria-hidden="true">→</span>
              </Link>)}
            </div> : null}
          </> : <div className={styles.priorityMain}>
            <span className={styles.priorityIcon}><DashboardIcon name="profile" /></span>
            <div className={styles.priorityCopy}>
              <span className="eyebrow">Priority now</span>
              <h2>You are all caught up</h2>
              <p>There is no urgent workspace action right now. New priorities will appear here automatically.</p>
            </div>
          </div>}
        </Card>

        <section className={styles.primaryGrid} aria-label="Quick workspace actions">
          <Card className={styles.commandCard}>
            <div className="section-heading"><div><span className="eyebrow">Customer work</span><h2>Run your day</h2></div><Badge tone="info">Quick access</Badge></div>
            <ActionGrid links={customerActions} />
          </Card>
          <Card className={styles.commandCard}>
            <div className="section-heading">
              <div><span className="eyebrow">{profile.provider_type === 'business' ? 'Hiring & business' : 'Career & presence'}</span><h2>{profile.provider_type === 'business' ? 'Grow your team' : 'Grow your opportunities'}</h2></div>
              <Badge tone="info">{profile.provider_type === 'business' ? 'Employer' : 'Professional'}</Badge>
            </div>
            <ActionGrid links={roleActions} />
          </Card>
        </section>

        <section className={styles.supportGrid} aria-label="Provider details">
          <Card className={styles.supportCard}>
            <div className="section-heading">
              <div><span className="eyebrow">Your identity</span><h2>{profile.display_name}</h2></div>
              <Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? 'Verified' : 'Verification required'}</Badge>
            </div>
            <p>{roleLabel}</p>
            <div className={styles.identityFacts}>
              <div className={styles.identityFact}><strong>Services</strong><span>{profile.services_active} active of {profile.services_total} total</span></div>
              <div className={styles.identityFact}><strong>Completed work</strong><span>{bookingsError ? 'Booking activity unavailable' : `${operations.completed.length} completed booking${operations.completed.length === 1 ? '' : 's'}`}</span></div>
              <div className={styles.identityFact}><strong>Public details</strong><span>{profile.marketplace_disclosure_complete ? 'Complete' : 'Needs attention'}</span></div>
            </div>
            <Link href="/provider/profile" className="text-link">Open profile</Link>
          </Card>

          <Card className={styles.supportCard}>
            <div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Next bookings</h2></div><Badge tone={bookingsError ? 'warning' : 'success'}>{bookingsError ? 'Retry needed' : 'Live'}</Badge></div>
            {bookingsError
              ? <div><p>Booking activity could not load.</p><Link href="/provider/bookings" className="text-link">Open Bookings to retry</Link></div>
              : operations.upcoming.length
                ? <div className={styles.bookingList}>{operations.upcoming.map((booking) => <div className={styles.bookingItem} key={booking.id}>
                    <div className={styles.bookingItemCopy}><strong>{booking.service_name || booking.booking_reference}</strong><span>{booking.booking_date || 'Date pending'}{booking.start_time ? ` · ${booking.start_time}` : ''} · confirmed</span></div>
                    <Link href={`/provider/bookings/${booking.id}`} className={styles.bookingOpen}>View</Link>
                  </div>)}</div>
                : <div><p>No upcoming bookings yet.</p><span className={styles.metricDetail}>Future confirmed work will appear here.</span></div>}
          </Card>
        </section>
      </> : null}
    </div>
  </LiveProviderShell>;
}
