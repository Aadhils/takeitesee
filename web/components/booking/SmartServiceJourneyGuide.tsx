'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';
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
  const { locale } = useLanguage();
  const tamil = locale.toLowerCase().startsWith('ta');
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

  const steps = tamil
    ? ['Request', 'Confirmed', 'Service', 'Completion']
    : ['Requested', 'Confirmed', 'Service', 'Completion'];

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
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to update service.');
      setBooking(payload.booking);
      window.dispatchEvent(new CustomEvent('booking:provider-list-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId } }));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update service.');
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
      if (!response.ok) throw new Error(payload.error ?? 'Completion could not be confirmed.');
      setCloseout(payload);
      window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Completion could not be confirmed.');
    } finally {
      setBusy(false);
    }
  };

  const moment = timing
    ? formatMoment(beforeStart ? timing.startAt : timing.endAt, locale, timing.zone)
    : '';

  let tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' = 'info';
  let label = tamil ? 'Service journey' : 'Service journey';
  let title = '';
  let body = '';
  let primary: 'accept' | 'complete' | 'confirm_completion' | 'review' | null = null;

  if (booking.status === 'cancelled') {
    tone = 'danger';
    label = tamil ? 'Stopped' : 'Stopped';
    title = tamil ? 'இந்த service request நிறுத்தப்பட்டுள்ளது' : 'This service request has stopped';
    body = tamil ? 'இந்த booking-க்கு இனி action தேவையில்லை. History மற்றும் support details கீழே பார்க்கலாம்.' : 'No further service action is needed for this booking. History and support details remain available below.';
  } else if (attendanceTerminal) {
    tone = 'warning';
    label = tamil ? 'Follow-up' : 'Follow-up';
    title = tamil ? 'Attendance issue பதிவு செய்யப்பட்டுள்ளது' : 'An attendance issue was recorded';
    body = tamil ? 'Normal service journey இங்கே pause ஆகிறது. Support/closeout section-ல் next resolution-ஐ தொடருங்கள்.' : 'The normal service journey is paused here. Continue through the support and closeout section below.';
  } else if (viewer === 'provider' && booking.status === 'pending') {
    tone = 'warning';
    label = tamil ? 'Action needed' : 'Action needed';
    title = tamil ? 'Customer service request-ஐ confirm செய்யுங்கள்' : 'Confirm the customer service request';
    body = tamil ? 'Date/time உங்களுக்கு சரியாக இருந்தால் confirm செய்யுங்கள். Confirm செய்ததும் Customer-க்கு service ready என்று update ஆகும்.' : 'Confirm if the date and time work for you. The customer will immediately see that the service is ready.';
    primary = 'accept';
  } else if (viewer === 'provider' && booking.status === 'rescheduled') {
    tone = 'warning';
    label = tamil ? 'Action needed' : 'Action needed';
    title = tamil ? 'Customer புதிய time கேட்டுள்ளார்' : 'The customer requested a new time';
    body = tamil ? 'புதிய schedule சரியாக இருந்தால் accept செய்யுங்கள்; முடியாவிட்டால் Other option மூலம் காரணம் சொல்லலாம்.' : 'Accept the new schedule if it works. If it does not, use the other option to give a reason.';
    primary = 'accept';
  } else if (booking.status === 'pending' || booking.status === 'rescheduled') {
    tone = 'info';
    label = tamil ? 'Waiting' : 'Waiting';
    title = tamil ? 'Provider confirmation காத்திருக்கிறது' : 'Waiting for provider confirmation';
    body = tamil ? 'இப்போது நீங்கள் வேறு எதுவும் செய்ய வேண்டியதில்லை. Provider confirm செய்ததும் journey தானாக அடுத்த stage-க்கு நகரும்.' : 'You do not need to do anything else now. The journey moves forward automatically when the provider confirms.';
  } else if (booking.status === 'confirmed' && beforeStart) {
    tone = 'success';
    label = tamil ? 'Confirmed' : 'Confirmed';
    title = viewer === 'provider'
      ? (tamil ? 'Service confirmed — தயாராகுங்கள்' : 'Service confirmed — get ready')
      : (tamil ? 'Provider confirmed — service ready' : 'Provider confirmed — your service is ready');
    body = tamil
      ? `Service ${moment}க்கு தொடங்கும். தேவையான clarification இருந்தால் ஒரே private chat-ஐ பயன்படுத்துங்கள்.`
      : `Service starts at ${moment}. Use the same private chat only if you need to clarify anything.`;
  } else if (booking.status === 'confirmed' && inService) {
    tone = 'success';
    label = tamil ? 'In service' : 'In service';
    title = tamil ? 'Service இப்போது நடைபெறுகிறது' : 'Service is now in progress';
    body = tamil ? 'இது scheduled service window. தேவையான coordination மட்டும் chat-ல் தொடருங்கள்.' : 'This is the scheduled service window. Keep any needed coordination in the same chat.';
  } else if (booking.status === 'confirmed' && afterServiceWindow) {
    tone = 'warning';
    label = viewer === 'provider' ? (tamil ? 'Action needed' : 'Action needed') : (tamil ? 'Finishing' : 'Finishing');
    title = viewer === 'provider'
      ? (tamil ? 'Service முடிந்திருந்தால் complete செய்யுங்கள்' : 'Mark complete if the service is finished')
      : (tamil ? 'Provider completion update காத்திருக்கிறது' : 'Waiting for the provider to finish the service record');
    body = viewer === 'provider'
      ? (tamil ? 'Service உண்மையாக வழங்கி முடித்திருந்தால் மட்டும் complete செய்யுங்கள்.' : 'Only mark complete if the agreed service was actually delivered.')
      : (tamil ? 'இப்போது action தேவையில்லை. Provider complete செய்ததும் நீங்கள் final confirmation செய்யலாம்.' : 'No action is needed yet. Once the provider marks it complete, you can give the final confirmation.');
    if (viewer === 'provider') primary = 'complete';
  } else if (booking.status === 'completed' && hasSupport) {
    tone = 'warning';
    label = tamil ? 'Support open' : 'Support open';
    title = tamil ? 'Service issue support-ல் உள்ளது' : 'A service issue is with support';
    body = tamil ? 'Completion flow-ஐ force செய்ய வேண்டாம். Support resolution வரை coordination available-ஆ இருக்கும்.' : 'Do not force the completion flow. Coordination remains available while support resolves the issue.';
  } else if (booking.status === 'completed' && viewer === 'customer' && !confirmedByCustomer && closeout?.can_confirm_completion) {
    tone = 'warning';
    label = tamil ? 'Action needed' : 'Action needed';
    title = tamil ? 'Service முடிந்ததா என்பதை உறுதி செய்யுங்கள்' : 'Confirm whether the service was completed';
    body = tamil ? 'Service சரியாக முடிந்திருந்தால் confirm செய்யுங்கள். Issue இருந்தால் confirm செய்யாமல் chat/support பயன்படுத்துங்கள்.' : 'Confirm if the service was completed correctly. If there is an issue, do not confirm yet—use chat or support instead.';
    primary = 'confirm_completion';
  } else if (booking.status === 'completed' && viewer === 'customer' && confirmedByCustomer && !hasReview && closeout?.review_window_open !== false) {
    tone = 'success';
    label = tamil ? 'Completed' : 'Completed';
    title = tamil ? 'Service complete — experience-ஐ review செய்யலாம்' : 'Service complete — you can review your experience';
    body = tamil ? 'Core service journey முடிந்தது. விருப்பமிருந்தால் கீழே ஒரு short review கொடுக்கலாம்.' : 'The core service journey is complete. You can leave a short review below if you want.';
    primary = 'review';
  } else if (booking.status === 'completed' && viewer === 'provider' && !confirmedByCustomer) {
    tone = 'info';
    label = tamil ? 'Waiting' : 'Waiting';
    title = tamil ? 'Customer acknowledgement காத்திருக்கிறது' : 'Waiting for customer acknowledgement';
    body = tamil ? 'நீங்கள் service completion பதிவு செய்துள்ளீர்கள். Customer confirm/support action வரும் வரை வேறு action தேவையில்லை.' : 'You recorded service completion. No further action is needed while the customer confirms or raises support.';
  } else if (booking.status === 'completed') {
    tone = 'success';
    label = tamil ? 'Done' : 'Done';
    title = tamil ? 'Service journey முடிந்தது' : 'Service journey complete';
    body = tamil ? 'இந்த service-ன் முக்கிய user actions முடிந்துள்ளன. Audit/history கீழே read-only ஆக இருக்கும்.' : 'The main user actions for this service are complete. Audit and history remain available below.';
  }

  const showDecline = viewer === 'provider' && (booking.status === 'pending' || booking.status === 'rescheduled');

  return <div className="smart-service-journey">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Smart Service Journey</span>
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      <Badge tone={tone}>{label}</Badge>
    </div>

    <div className="smart-service-journey-steps" aria-label={tamil ? 'Service progress' : 'Service progress'}>
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
        {busy ? (tamil ? 'Updating…' : 'Updating…') : booking.status === 'rescheduled' ? (tamil ? 'புதிய time-ஐ accept செய்' : 'Accept new time') : (tamil ? 'Service confirm செய்' : 'Confirm service')}
      </Button> : null}
      {primary === 'complete' ? <Button type="button" disabled={busy} onClick={() => void providerAction('complete')}>
        {busy ? (tamil ? 'Updating…' : 'Updating…') : (tamil ? 'Service complete செய்' : 'Mark service complete')}
      </Button> : null}
      {primary === 'confirm_completion' ? <Button type="button" disabled={busy} onClick={() => void confirmCompletion()}>
        {busy ? (tamil ? 'Confirming…' : 'Confirming…') : (tamil ? 'Service முடிந்தது உறுதி செய்' : 'Confirm service completed')}
      </Button> : null}
      {primary === 'review' ? <Link className="button button-primary" href="#customer-review">{tamil ? 'Review கொடு' : 'Leave a review'}</Link> : null}
      {!primary && booking.status !== 'cancelled' ? <Link className="button button-secondary" href={chatHref}>{viewer === 'provider' ? (tamil ? 'Customer-க்கு message செய்' : 'Message customer') : (tamil ? 'Provider-க்கு message செய்' : 'Message provider')}</Link> : null}
      {primary && booking.status !== 'cancelled' ? <Link className="button button-secondary" href={chatHref}>{tamil ? 'Message' : 'Message'}</Link> : null}
      {showDecline ? <Button type="button" variant="quiet" disabled={busy} onClick={() => setDeclineOpen(true)}>
        {booking.status === 'rescheduled' ? (tamil ? 'இந்த time முடியாது' : 'This time does not work') : (tamil ? 'இந்த request எடுக்க முடியாது' : 'Cannot take this request')}
      </Button> : null}
    </div>

    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)', margin: 0 }}>{error}</p> : null}

    <BookingReasonDialog
      open={declineOpen}
      eyebrow={booking.status === 'rescheduled' ? (tamil ? 'புதிய time-ஐ decline செய்' : 'Decline new time') : (tamil ? 'Service request decline' : 'Decline service request')}
      title={booking.status === 'rescheduled' ? (tamil ? 'இந்த புதிய time ஏன் முடியவில்லை?' : 'Why does the new time not work?') : (tamil ? 'இந்த request-ஐ ஏன் எடுக்க முடியவில்லை?' : 'Why can you not take this request?')}
      description={tamil ? 'Customer-க்கு புரியும் ஒரு காரணத்தை தேர்வு செய்யுங்கள்.' : 'Choose a clear reason for the customer.'}
      options={booking.status === 'rescheduled' ? rescheduleDeclineReasons : declineReasons}
      confirmLabel={tamil ? 'Decline செய்' : 'Decline'}
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
