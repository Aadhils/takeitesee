'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '../ui/primitives';
import { useRequirementCompletionTranslations } from '../i18n/RequirementCompletionTranslations';

type Closeout = {
  customer_completion_confirmed_at?: string | null;
  can_confirm_completion?: boolean;
  review?: { id: string; rating: number } | null;
  active_issue?: { id: string; status: string; category: string } | null;
};

export default function RequirementCompletionGuide({ bookingId, viewer }: { bookingId: string; viewer: 'customer' | 'provider' }) {
  const { t } = useRequirementCompletionTranslations();
  const [completed, setCompleted] = useState(false);
  const [closeout, setCloseout] = useState<Closeout | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
        const payload = await bookingResponse.json() as { booking?: { status?: string } };
        setCompleted(payload.booking?.status === 'completed');
      }
      if (closeoutResponse.ok) {
        const payload = await closeoutResponse.json() as Closeout;
        setCloseout(payload);
      }
    } catch { /* Optional completion guidance must not block booking detail. */ }
  }, [bookingId, viewer]);

  useEffect(() => { void load(); }, [load]);
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

  if (!completed || !closeout) return null;

  const confirmed = Boolean(closeout.customer_completion_confirmed_at);
  const hasReview = Boolean(closeout.review);
  const hasSupport = Boolean(closeout.active_issue);

  const confirmCompletion = async () => {
    if (viewer !== 'customer' || busy || confirmed || !closeout.can_confirm_completion) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_completion' }),
      });
      const payload = await response.json() as Closeout & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t('requirementCompletion.confirmFallback'));
      setCloseout(payload);
      window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('requirementCompletion.confirmFallback'));
    } finally {
      setBusy(false);
    }
  };

  const copy = viewer === 'provider'
    ? hasSupport
      ? {
          tone: 'warning' as const,
          label: t('requirementCompletion.provider.support.label'),
          title: t('requirementCompletion.provider.support.title'),
          body: t('requirementCompletion.provider.support.body'),
        }
      : confirmed
        ? {
            tone: 'success' as const,
            label: t('requirementCompletion.provider.confirmed.label'),
            title: t('requirementCompletion.provider.confirmed.title'),
            body: t('requirementCompletion.provider.confirmed.body'),
          }
        : {
            tone: 'info' as const,
            label: t('requirementCompletion.provider.awaiting.label'),
            title: t('requirementCompletion.provider.awaiting.title'),
            body: t('requirementCompletion.provider.awaiting.body'),
          }
    : hasSupport
      ? {
          tone: 'warning' as const,
          label: t('requirementCompletion.customer.support.label'),
          title: t('requirementCompletion.customer.support.title'),
          body: t('requirementCompletion.customer.support.body'),
        }
      : !confirmed && closeout.can_confirm_completion
        ? {
            tone: 'warning' as const,
            label: t('requirementCompletion.customer.action.label'),
            title: t('requirementCompletion.customer.action.title'),
            body: t('requirementCompletion.customer.action.body'),
          }
        : confirmed && !hasReview
          ? {
              tone: 'success' as const,
              label: t('requirementCompletion.customer.review.label'),
              title: t('requirementCompletion.customer.review.title'),
              body: t('requirementCompletion.customer.review.body'),
            }
          : {
              tone: 'success' as const,
              label: t('requirementCompletion.customer.reviewed.label'),
              title: t('requirementCompletion.customer.reviewed.title'),
              body: t('requirementCompletion.customer.reviewed.body'),
            };

  return <div style={{ borderTop: '1px solid #e7eaf0', marginTop: '1rem', paddingTop: '1rem', display: 'grid', gap: '.55rem' }}>
    <div className="section-heading">
      <div><span className="eyebrow">{t('requirementCompletion.eyebrow')}</span><h3 style={{ margin: 0 }}>{copy.title}</h3></div>
      <Badge tone={copy.tone}>{copy.label}</Badge>
    </div>
    <p className="detail-copy" style={{ margin: 0 }}>{copy.body}</p>
    {viewer === 'customer' && !confirmed && !hasSupport && closeout.can_confirm_completion ? <div>
      <Button type="button" disabled={busy} onClick={() => void confirmCompletion()}>{busy ? t('requirementCompletion.confirming') : t('requirementCompletion.confirmAction')}</Button>
    </div> : null}
    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)', margin: 0 }}>{error}</p> : null}
  </div>;
}
