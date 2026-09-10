'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

type Closeout = {
  customer_completion_confirmed_at?: string | null;
  can_confirm_completion?: boolean;
  review?: { id: string; rating: number } | null;
  active_issue?: { id: string; status: string; category: string } | null;
};

export default function RequirementCompletionGuide({ bookingId, viewer }: { bookingId: string; viewer: 'customer' | 'provider' }) {
  const { locale } = useLanguage();
  const [completed, setCompleted] = useState(false);
  const [closeout, setCloseout] = useState<Closeout | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const bookingPath = viewer === 'provider'
          ? `/api/provider/bookings/${encodeURIComponent(bookingId)}`
          : `/api/bookings/${encodeURIComponent(bookingId)}`;
        const [bookingResponse, closeoutResponse] = await Promise.all([
          fetch(bookingPath, { cache: 'no-store' }),
          fetch(`/api/bookings/${encodeURIComponent(bookingId)}/closeout`, { cache: 'no-store' }),
        ]);
        if (!active) return;
        if (bookingResponse.ok) {
          const payload = await bookingResponse.json() as { booking?: { status?: string } };
          setCompleted(payload.booking?.status === 'completed');
        }
        if (closeoutResponse.ok) {
          const payload = await closeoutResponse.json() as Closeout;
          setCloseout(payload);
        }
      } catch { /* Optional completion guidance must not block booking detail. */ }
    })();
    return () => { active = false; };
  }, [bookingId, viewer]);

  if (!completed || !closeout) return null;

  const tamil = locale.toLowerCase().startsWith('ta');
  const confirmed = Boolean(closeout.customer_completion_confirmed_at);
  const hasReview = Boolean(closeout.review);
  const hasSupport = Boolean(closeout.active_issue);

  const copy = viewer === 'provider'
    ? hasSupport
      ? {
          tone: 'warning' as const,
          label: tamil ? 'Support open' : 'Support open',
          title: tamil ? 'Customer ஒரு issue பதிவு செய்துள்ளார்' : 'Customer raised a service issue',
          body: tamil
            ? 'Booking closeout-ல் active support case உள்ளது. Service record-ஐ final ஆக assume செய்யாமல், customer coordination மற்றும் support resolution-ஐ தொடருங்கள்.'
            : 'An active support case is attached to this booking. Keep coordinating and wait for support resolution before treating the service record as final.',
        }
      : confirmed
        ? {
            tone: 'success' as const,
            label: tamil ? 'Confirmed' : 'Confirmed',
            title: tamil ? 'Customer service completion-ஐ உறுதி செய்துள்ளார்' : 'Customer confirmed service completion',
            body: tamil
              ? 'Customer acknowledgement பதிவு செய்யப்பட்டுள்ளது. Review அல்லது support activity இருந்தால் booking closeout section-ல் தொடர்ந்து பார்க்கலாம்.'
              : 'Customer acknowledgement is recorded. Continue to watch the booking closeout section for any review or support activity.',
          }
        : {
            tone: 'info' as const,
            label: tamil ? 'Awaiting customer' : 'Awaiting customer',
            title: tamil ? 'Service complete — Customer acknowledgement காத்திருக்கிறது' : 'Service complete — awaiting customer acknowledgement',
            body: tamil
              ? 'நீங்கள் service-ஐ complete என்று பதிவு செய்துள்ளீர்கள். Customer completion-ஐ confirm செய்யலாம் அல்லது issue/support raise செய்யலாம்; அதுவரை coordination channel open-ஆ வைத்திருங்கள்.'
              : 'You marked the service complete. The customer can confirm completion or raise an issue; keep the coordination channel available until that acknowledgement arrives.',
          }
    : hasSupport
      ? {
          tone: 'warning' as const,
          label: tamil ? 'Support open' : 'Support open',
          title: tamil ? 'உங்கள் service issue support-ல் உள்ளது' : 'Your service issue is with support',
          body: tamil
            ? 'Active support case இருக்கும் போது completion-ஐ அவசரமாக confirm செய்ய தேவையில்லை. கீழே உள்ள closeout section-ல் case status-ஐ பார்க்கலாம்.'
            : 'You do not need to confirm completion while an active service issue is being handled. Follow the case status in the closeout section below.',
        }
      : !confirmed && closeout.can_confirm_completion
        ? {
            tone: 'warning' as const,
            label: tamil ? 'Action needed' : 'Action needed',
            title: tamil ? 'Provider service-ஐ complete என்று பதிவு செய்துள்ளார்' : 'Provider marked the service complete',
            body: tamil
              ? 'Service உண்மையாக முடிந்திருந்தால் முதலில் completion-ஐ confirm செய்யுங்கள். ஏதேனும் பிரச்சனை இருந்தால் confirm செய்யாமல் Provider-க்கு message செய்யவும் அல்லது support raise செய்யவும். அதன் பிறகு review கொடுக்கலாம்.'
              : 'If the service was actually completed, confirm completion first. If there is a problem, do not confirm yet—message the provider or open support. You can leave a review after checking the completion details.',
          }
        : confirmed && !hasReview
          ? {
              tone: 'success' as const,
              label: tamil ? 'Acknowledged' : 'Acknowledged',
              title: tamil ? 'Completion confirmed — Review அடுத்த step' : 'Completion confirmed — review is the next step',
              body: tamil
                ? 'Service completion acknowledgement பதிவு செய்யப்பட்டுள்ளது. உங்கள் experience-ஐ rating/review மூலம் பதிவு செய்யலாம்; issue இருந்தால் support window இருக்கும் வரை help பெறலாம்.'
                : 'Your completion acknowledgement is recorded. You can now rate and review the experience, and still use support while the support window remains open.',
            }
          : {
              tone: 'success' as const,
              label: tamil ? 'Reviewed' : 'Reviewed',
              title: tamil ? 'Completion மற்றும் review பதிவு செய்யப்பட்டுள்ளது' : 'Completion and review are recorded',
              body: tamil
                ? 'இந்த service interaction-ன் customer-side steps முடிந்துள்ளன. Final lifecycle status booking closeout rules-ன் படி update ஆகும்.'
                : 'Your customer-side service steps are complete. Final lifecycle status will continue according to the existing booking closeout rules.',
            };

  return <div style={{ borderTop: '1px solid #e7eaf0', marginTop: '1rem', paddingTop: '1rem', display: 'grid', gap: '.55rem' }}>
    <div className="section-heading">
      <div><span className="eyebrow">{tamil ? 'Service completion' : 'Service completion'}</span><h3 style={{ margin: 0 }}>{copy.title}</h3></div>
      <Badge tone={copy.tone}>{copy.label}</Badge>
    </div>
    <p className="detail-copy" style={{ margin: 0 }}>{copy.body}</p>
    {viewer === 'customer' ? <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>
      {!confirmed && !hasSupport ? <Link className="button button-primary" href="#service-closeout">{tamil ? 'Completion details பார்க்க' : 'Review completion details'}</Link> : null}
      {confirmed && !hasReview && !hasSupport ? <Link className="button button-secondary" href="#customer-review">{tamil ? 'Review கொடுக்க' : 'Leave a review'}</Link> : null}
      {hasSupport ? <Link className="button button-secondary" href="#service-closeout">{tamil ? 'Support status பார்க்க' : 'View support status'}</Link> : null}
    </div> : <div><Link className="button button-secondary" href="#provider-service-closeout">{tamil ? 'Closeout status பார்க்க' : 'View closeout status'}</Link></div>}
  </div>;
}
