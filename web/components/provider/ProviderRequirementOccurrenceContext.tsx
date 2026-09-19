'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
import SmartServiceJourneyGuide from '../booking/SmartServiceJourneyGuide';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type JobState = 'active' | 'declined' | 'cancelled' | 'service_completed' | 'fulfilled';
type RequirementContext = {
  requirement_id: string;
  requirement_title: string;
  requirement_status: RequirementStatus;
  job_state: JobState;
  schedule_pattern: 'one_time' | 'recurring';
  occurrence_number: number;
  occurrence_count: number;
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
  pricing_basis: 'per_occurrence' | 'whole_requirement' | null;
  conversation_id?: string | null;
  recovery: {
    id: string;
    attempt_number: number;
    prior_booking_id: string;
    prior_booking_reference: string;
    recovered_at: string;
  } | null;
};

const WEEKDAY_KEYS = ['day.0', 'day.1', 'day.2', 'day.3', 'day.4', 'day.5', 'day.6'] as const;
const FREQUENCY_KEYS = {
  daily: 'providerBooking.occurrence.frequency.daily',
  weekly: 'providerBooking.occurrence.frequency.weekly',
  monthly: 'providerBooking.occurrence.frequency.monthly',
} as const;

export default function ProviderRequirementOccurrenceContext({ bookingId, locale, onResolved }: { bookingId: string; locale: string; onResolved?: (linked: boolean) => void }) {
  const { t } = useRemainingWorkspaceTranslations();
  const [context, setContext] = useState<RequirementContext | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}/requirement-context`, { cache: 'no-store' });
      const payload = await response.json() as { context?: RequirementContext | null; error?: string };
      if (!response.ok) throw new Error(payload.error ?? t('providerBooking.occurrence.loadFallback'));
      setContext(payload.context ?? null);
      setError('');
      onResolved?.(Boolean(payload.context));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('providerBooking.occurrence.loadFallback'));
      onResolved?.(false);
    }
  }, [bookingId, onResolved, t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) void load();
    };
    window.addEventListener('booking:provider-list-refresh', refresh);
    return () => window.removeEventListener('booking:provider-list-refresh', refresh);
  }, [bookingId, load]);

  if (!context) return error ? <Card><p role="status" className="summary-note">{error}</p></Card> : null;
  const recurring = context.schedule_pattern === 'recurring';
  const chatHref = context.conversation_id
    ? `/provider/messages?conversation=${encodeURIComponent(context.conversation_id)}`
    : '/provider/messages';
  const weekdays = context.recurrence_frequency === 'weekly' && context.recurrence_weekdays?.length
    ? context.recurrence_weekdays.map((value) => WEEKDAY_KEYS[value] ? t(WEEKDAY_KEYS[value]) : String(value)).join(', ')
    : null;
  const frequencyLabel = context.recurrence_frequency ? t(FREQUENCY_KEYS[context.recurrence_frequency]) : null;
  const cadence = recurring && frequencyLabel
    ? `${context.recurrence_interval && context.recurrence_interval > 1 ? `${context.recurrence_interval} × ` : ''}${frequencyLabel}${weekdays ? ` · ${weekdays}` : ''}`
    : null;
  const pricing = context.pricing_basis === 'whole_requirement'
    ? t('providerBooking.occurrence.pricingWhole')
    : t('providerBooking.occurrence.pricingEach');
  const lifecycle = context.requirement_status === 'fulfilled'
    ? { tone: 'success' as const, label: t('providerBooking.occurrence.requirementFulfilled') }
    : context.requirement_status === 'cancelled'
      ? { tone: 'danger' as const, label: t('providerBooking.occurrence.requirementCancelled') }
      : context.job_state === 'fulfilled'
        ? { tone: 'success' as const, label: t('providerBooking.occurrence.fulfilled') }
        : context.job_state === 'service_completed'
          ? { tone: 'warning' as const, label: t('providerBooking.occurrence.serviceCompleted') }
          : context.job_state === 'cancelled' || context.job_state === 'declined'
            ? { tone: 'danger' as const, label: t('providerBooking.occurrence.stopped') }
            : { tone: 'info' as const, label: t('providerBooking.occurrence.active') };

  return <Card className="provider-detail-card">
    <div className="section-heading">
      <div><span className="eyebrow">{t('providerBooking.occurrence.eyebrow')}</span><h2>{context.requirement_title}</h2></div>
      <div style={{ display: 'flex', gap: '.45rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Badge tone={recurring ? 'info' : 'neutral'}>{recurring ? t('providerBooking.occurrence.recurring') : t('providerBooking.occurrence.oneTime')}</Badge>
        <Badge tone={lifecycle.tone}>{lifecycle.label}</Badge>
      </div>
    </div>
    {recurring ? <p><strong>{t('providerBooking.occurrence.label')} #{context.occurrence_number}</strong> / {context.occurrence_count}</p> : null}
    {cadence ? <p className="summary-note">{t('providerBooking.occurrence.schedule')}: {cadence}</p> : null}
    <p className="summary-note">{pricing}</p>
    <div style={{ display: 'grid', gap: '.55rem', marginTop: '.9rem', paddingTop: '.9rem', borderTop: '1px solid #e7eaf0' }}>
      <strong>{t('providerBooking.occurrence.coordinationTitle')}</strong>
      <p className="summary-note">{t('providerBooking.occurrence.coordinationHelp')}</p>
      <div><Link className="button button-secondary" href={chatHref}>{t('providerBooking.occurrence.messageCustomer')}</Link></div>
    </div>
    <SmartServiceJourneyGuide bookingId={bookingId} viewer="provider" chatHref={chatHref} />
    {context.requirement_status === 'fulfilled' && recurring ? <p className="summary-note">{t('providerBooking.occurrence.finalHistory')}</p> : null}

    {context.recovery ? <div style={{ borderTop: '1px solid #e7eaf0', marginTop: '1rem', paddingTop: '1rem', display: 'grid', gap: '.45rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone="warning">{t('providerBooking.occurrence.recoveredBadge')}</Badge>
        <strong>{t('providerBooking.occurrence.recoveryAttempt')} #{context.recovery.attempt_number}</strong>
      </div>
      <p className="summary-note">{t('providerBooking.occurrence.recoveryHelp')}</p>
      <p className="summary-note">
        {t('providerBooking.occurrence.previousBooking')}: <Link href={`/provider/bookings/${encodeURIComponent(context.recovery.prior_booking_id)}`}>{context.recovery.prior_booking_reference}</Link>
      </p>
      <p className="summary-note">{t('providerBooking.occurrence.recoveredAt')}: {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(context.recovery.recovered_at))}</p>
    </div> : null}
  </Card>;
}
