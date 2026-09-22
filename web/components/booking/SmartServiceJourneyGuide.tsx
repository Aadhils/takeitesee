'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button } from '../ui/primitives';
import { interpolateSmartServiceJourney, useSmartServiceJourneyTranslations } from '../i18n/SmartServiceJourneyTranslations';
import BookingReasonDialog from './BookingReasonDialog';

type Viewer = 'customer' | 'provider';
type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';

type BookingSnapshot = {
  booking_reference?: string;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  status: BookingStatus;
  attendance_outcome?: AttendanceOutcome;
};

type CloseoutSnapshot = {
  customer_completion_confirmed_at?: string | null;
  can_confirm_completion?: boolean;
  review?: { id: string; rating: number } | null;
  active_issue?: { id: string; status: string; category: string } | null;
  review_window_open?: boolean;
};

const declineReasons = ['Schedule conflict', 'Service unavailable', 'Outside service area', 'Unable to fulfil request', 'Other'];
const rescheduleDeclineReasons = ['New time unavailable', 'Schedule conflict', 'Unable to fulfil at requested time', 'Service unavailable', 'Other'];

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
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
}

function formatMoment(epoch: number, locale: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(epoch));
  } catch {
    return new Date(epoch).toLocaleString();
  }
}

export default function SmartServiceJourneyGuide({
  bookingId,
  viewer,
  chatHref,
}: {
  bookingId: string;
  viewer: Viewer;
  chatHref: string;
}) {
  const { locale, t } = useSmartServiceJourneyTranslations();
  const [booking, setBooking] = useState<BookingSnapshot | null>(null);
  const [closeout, setCloseout] = useState<CloseoutSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const bookingPath = viewer === 'provider'
        ? `/api/provider/bookings/${encodeURIComponent(bookingId)}`
        : `/api/bookings/${encodeURIComponent(bookingId)}`;
      const [bookingResponse, closeoutResponse] = await Promise.all([
        fetch(bookingPath, { cache: 'no-store' }),
        fetch(`/api/bookings/${encodeURIComponent(bookingId)}/closeout`, { cache: 'no-store' }),
      ]);
      if (bookingResponse.ok) {
        const payload = await bookingResponse.json() as { booking?: BookingSnapshot };
        setBooking(payload.booking ?? null);
      }
      if (closeoutResponse.ok) {
        const payload = await closeoutResponse.json() as CloseoutSnapshot;
        setCloseout(payload);
      }
    } catch {
      // Journey guidance must never block the booking detail.
    }
  }, [bookingId, viewer]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) void load();
    };
    window.addEventListener('booking:closeout-refresh', refresh);
    window.addEventListener('booking:provider-list-refresh', refresh);
    return () => {
      window.removeEventListener('booking:closeout-refresh', refresh);
      window.removeEventListener('booking:provider-list-refresh', refresh);
    };
  }, [bookingId, load]);

  const timing = useMemo(() => {
    if (!booking) return null;
    try {
      const zone = booking.timezone || 'Asia/Kolkata';
      const startAt = zonedDateTimeToEpoch(booking.booking_date, booking.start_time, zone);
      const endAt = startAt + Math.max(Number(booking.duration_minutes) || 0, 0) * 60_000;
      return { zone, startAt, endAt };
    } catch {
      return null;
    }
  }, [booking]);

  if (!booking) return null;

  const attendanceTerminal = booking.attendance_outcome === 'customer_no_show' || booking.attendance_outcome === 'provider_no_show';
  const confirmedByCustomer = Boolean(closeout?.customer_completion_confirmed_at);
  const hasSupport = Boolean(closeout?.active_issue);
  const hasReview = Boolean(closeout?.review);
  const beforeStart = Boolean(timing && now < timing.startAt);
  const inService = Boolean(timing && now >= timing.startAt && now < timing.endAt);
  const afterServiceWindow = Boolean(timing && now >= timing.endAt);

  const stageIndex = booking.status === 'pending' || booking.status === 'rescheduled'
    ? 0
    : booking.status === 'confirmed'
      ? (beforeStart ? 1 : 2)
      : booking.status === 'completed'
        ? 3
        : 0;

  const steps = [
    t('smartJourney.step.requested'),
    t('smartJourney.step.confirmed'),
    t('smartJourney.step.service'),
    t('smartJourney.step.completion'),
  ];

  const providerAction = async (action: 'accept' | 'decline' | 'complete', reason?: string) => {
    if (busy) return false;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const payload = await response.json() as { booking?: BookingSnapshot; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? t('smartJourney.updateFallback'));
      setBooking(payload.booking);
      window.dispatchEvent(new CustomEvent('booking:provider-list-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId } }));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('smartJourney.updateFallback'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmCompletion = async () => {
    if (busy || viewer !== 'customer' || confirmedByCustomer || !closeout?.can_confirm_completion) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_completion' }),
      });
      const payload = await response.json() as CloseoutSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t('smartJourney.confirmFallback'));
      setCloseout(payload);
      window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('smartJourney.confirmFallback'));
    } finally {
      setBusy(false);
    }
  };

  const moment = timing
    ? formatMoment(beforeStart ? timing.startAt : timing.endAt, locale, timing.zone)
    : '';

  let tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' = 'info';
  let label = t('smartJourney.label.default');
  let title = '';
  let body = '';
  let primary: 'accept' | 'complete' | 'confirm_completion' | 'review' | null = null;

  if (booking.status === 'cancelled') {
    tone = 'danger';
    label = t('smartJourney.cancelled.label');
    title = t('smartJourney.cancelled.title');
    body = t('smartJourney.cancelled.body');
  } else if (attendanceTerminal) {
    tone = 'warning';
    label = t('smartJourney.attendance.label');
    title = t('smartJourney.attendance.title');
    body = t('smartJourney.attendance.body');
  } else if (viewer === 'provider' && booking.status === 'pending') {
    tone = 'warning';
    label = t('smartJourney.providerPending.label');
    title = t('smartJourney.providerPending.title');
    body = t('smartJourney.providerPending.body');
    primary = 'accept';
  } else if (viewer === 'provider' && booking.status === 'rescheduled') {
    tone = 'warning';
    label = t('smartJourney.providerRescheduled.label');
    title = t('smartJourney.providerRescheduled.title');
    body = t('smartJourney.providerRescheduled.body');
    primary = 'accept';
  } else if (booking.status === 'pending' || booking.status === 'rescheduled') {
    tone = 'info';
    label = t('smartJourney.waiting.label');
    title = t('smartJourney.waiting.title');
    body = t('smartJourney.waiting.body');
  } else if (booking.status === 'confirmed' && beforeStart) {
    tone = 'success';
    label = t('smartJourney.confirmed.label');
    title = viewer === 'provider'
      ? t('smartJourney.confirmed.providerTitle')
      : t('smartJourney.confirmed.customerTitle');
    body = interpolateSmartServiceJourney(t('smartJourney.confirmed.body'), { moment });
  } else if (booking.status === 'confirmed' && inService) {
    tone = 'success';
    label = t('smartJourney.inService.label');
    title = t('smartJourney.inService.title');
    body = t('smartJourney.inService.body');
  } else if (booking.status === 'confirmed' && afterServiceWindow) {
    tone = 'warning';
    label = viewer === 'provider'
      ? t('smartJourney.afterWindow.providerLabel')
      : t('smartJourney.afterWindow.customerLabel');
    title = viewer === 'provider'
      ? t('smartJourney.afterWindow.providerTitle')
      : t('smartJourney.afterWindow.customerTitle');
    body = viewer === 'provider'
      ? t('smartJourney.afterWindow.providerBody')
      : t('smartJourney.afterWindow.customerBody');
    if (viewer === 'provider') primary = 'complete';
  } else if (booking.status === 'completed' && hasSupport) {
    tone = 'warning';
    label = t('smartJourney.support.label');
    title = t('smartJourney.support.title');
    body = t('smartJourney.support.body');
  } else if (booking.status === 'completed' && viewer === 'customer' && !confirmedByCustomer && closeout?.can_confirm_completion) {
    tone = 'warning';
    label = t('smartJourney.customerConfirm.label');
    title = t('smartJourney.customerConfirm.title');
    body = t('smartJourney.customerConfirm.body');
    primary = 'confirm_completion';
  } else if (booking.status === 'completed' && viewer === 'customer' && confirmedByCustomer && !hasReview && closeout?.review_window_open !== false) {
    tone = 'success';
    label = t('smartJourney.review.label');
    title = t('smartJourney.review.title');
    body = t('smartJourney.review.body');
    primary = 'review';
  } else if (booking.status === 'completed' && viewer === 'provider' && !confirmedByCustomer) {
    tone = 'info';
    label = t('smartJourney.providerWaiting.label');
    title = t('smartJourney.providerWaiting.title');
    body = t('smartJourney.providerWaiting.body');
  } else if (booking.status === 'completed') {
    tone = 'success';
    label = t('smartJourney.done.label');
    title = t('smartJourney.done.title');
    body = t('smartJourney.done.body');
  }

  const showDecline = viewer === 'provider' && (booking.status === 'pending' || booking.status === 'rescheduled');

  return <div className="smart-service-journey">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{t('smartJourney.eyebrow')}</span>
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      <Badge tone={tone}>{label}</Badge>
    </div>

    <div className="smart-service-journey-steps" aria-label={t('smartJourney.progressAria')}>
      {steps.map((step, index) => {
        const reached = booking.status !== 'cancelled' && index <= stageIndex;
        const current = booking.status !== 'cancelled' && index === stageIndex;
        return <div key={step} className={`smart-service-journey-step${reached ? ' reached' : ''}${current ? ' current' : ''}`}>
          <span>{reached && index < stageIndex ? '✓' : index + 1}</span>
          <small>{step}</small>
        </div>;
      })}
    </div>

    <p className="detail-copy" style={{ margin: 0 }}>{body}</p>

    <div className="smart-service-journey-actions">
      {primary === 'accept' ? <Button type="button" disabled={busy} onClick={() => void providerAction('accept')}>
        {busy ? t('smartJourney.action.updating') : booking.status === 'rescheduled' ? t('smartJourney.action.acceptNewTime') : t('smartJourney.action.confirmService')}
      </Button> : null}
      {primary === 'complete' ? <Button type="button" disabled={busy} onClick={() => void providerAction('complete')}>
        {busy ? t('smartJourney.action.updating') : t('smartJourney.action.markComplete')}
      </Button> : null}
      {primary === 'confirm_completion' ? <Button type="button" disabled={busy} onClick={() => void confirmCompletion()}>
        {busy ? t('smartJourney.action.confirming') : t('smartJourney.action.confirmCompletion')}
      </Button> : null}
      {primary === 'review' ? <Link className="button button-primary" href="#customer-review">{t('smartJourney.action.leaveReview')}</Link> : null}
      {!primary && booking.status !== 'cancelled' ? <Link className="button button-secondary" href={chatHref}>{viewer === 'provider' ? t('smartJourney.action.messageCustomer') : t('smartJourney.action.messageProvider')}</Link> : null}
      {primary && booking.status !== 'cancelled' ? <Link className="button button-secondary" href={chatHref}>{t('smartJourney.action.message')}</Link> : null}
      {showDecline ? <Button type="button" variant="quiet" disabled={busy} onClick={() => setDeclineOpen(true)}>
        {booking.status === 'rescheduled' ? t('smartJourney.action.declineReschedule') : t('smartJourney.action.declineRequest')}
      </Button> : null}
    </div>

    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)', margin: 0 }}>{error}</p> : null}

    <BookingReasonDialog
      open={declineOpen}
      eyebrow={booking.status === 'rescheduled' ? t('smartJourney.dialog.rescheduleEyebrow') : t('smartJourney.dialog.requestEyebrow')}
      title={booking.status === 'rescheduled' ? t('smartJourney.dialog.rescheduleTitle') : t('smartJourney.dialog.requestTitle')}
      description={t('smartJourney.dialog.description')}
      options={booking.status === 'rescheduled' ? rescheduleDeclineReasons : declineReasons}
      confirmLabel={t('smartJourney.dialog.confirm')}
      busy={busy}
      onClose={() => setDeclineOpen(false)}
      onConfirm={async (reason) => { if (await providerAction('decline', reason)) setDeclineOpen(false); }}
    />

    <style jsx global>{`
      .smart-service-journey { display: grid; gap: .85rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e7eaf0; }
      .smart-service-journey-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .45rem; }
      .smart-service-journey-step { min-width: 0; display: grid; justify-items: center; gap: .35rem; text-align: center; color: var(--color-text-muted); }
      .smart-service-journey-step span { width: 2rem; height: 2rem; border-radius: 999px; display: grid; place-items: center; border: 1px solid var(--color-border); background: var(--color-surface); font-weight: 700; }
      .smart-service-journey-step.reached { color: var(--color-text); }
      .smart-service-journey-step.reached span { border-color: var(--color-primary); background: var(--color-selected); color: var(--color-primary); }
      .smart-service-journey-step.current span { box-shadow: 0 0 0 3px var(--color-selected); }
      .smart-service-journey-step small { font-size: .76rem; line-height: 1.2; overflow-wrap: anywhere; }
      .smart-service-journey-actions { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; }
      @media (max-width: 560px) {
        .smart-service-journey-steps { gap: .25rem; }
        .smart-service-journey-step small { font-size: .68rem; }
        .smart-service-journey-step span { width: 1.8rem; height: 1.8rem; }
        .smart-service-journey-actions { display: grid; grid-template-columns: 1fr; }
        .smart-service-journey-actions .button { width: 100%; }
      }
    `}</style>
  </div>;
}
