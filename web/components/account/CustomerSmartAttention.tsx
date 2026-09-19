'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';
import type { CustomerBooking } from '../../types/booking-domain';

type RequirementAttentionRow = {
  id: string;
  reference: string;
  title: string;
  status: 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
  unread_proposal_count: number | null;
  latest_proposal_reference: string | null;
  latest_unread_proposal_reference: string | null;
  latest_proposal_at: string | null;
};

type ProductOrderNotification = {
  id: string;
  target_path: string | null;
  event_type: string;
  title: string;
  body: string;
  created_at: string;
};

type ConversationSummary = {
  id: string;
  conversation_kind: 'requirement' | 'job_application' | 'product_order';
  requirement_title: string | null;
  job_title: string | null;
  product_name: string | null;
  counterpart_name: string;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type SmartAttention =
  | { kind: 'completion'; title: string; body: string; href: string; badge: string; bookingId: string }
  | { kind: 'proposal'; title: string; body: string; href: string; badge: string; requirementId: string }
  | { kind: 'schedule'; title: string; body: string; href: string; badge: string }
  | { kind: 'message'; title: string; body: string; href: string; badge: string }
  | { kind: 'order'; title: string; body: string; href: string; badge: string; orderId: string | null }
  | { kind: 'service'; title: string; body: string; href: string; badge: string }
  | { kind: 'clear'; title: string; body: string; href: string; badge: string };

function bookingMoment(booking: CustomerBooking) {
  return `${booking.bookingDate}T${String(booking.startTime || '00:00').slice(0, 8)}`;
}

export default function CustomerSmartAttention({ bookings }: { bookings: CustomerBooking[] }) {
  const router = useRouter();
  const { t } = useOperationalTranslations();
  const [requirements, setRequirements] = useState<RequirementAttentionRow[]>([]);
  const [unscheduledRequirement, setUnscheduledRequirement] = useState<RequirementAttentionRow | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [latestOrder, setLatestOrder] = useState<ProductOrderNotification | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [opening, setOpening] = useState(false);

  const loadAttention = useCallback(async () => {
    const [requirementsResult, ordersResult, messagesResult] = await Promise.allSettled([
      fetch('/api/requirements', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Requirements attention unavailable.');
        return response.json() as Promise<{ requirements?: RequirementAttentionRow[] }>;
      }),
      fetch('/api/notifications?mode=product-order-unread-updates', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Order attention unavailable.');
        return response.json() as Promise<{ unread_count?: number; latest?: ProductOrderNotification | null }>;
      }),
      fetch('/api/messages?workspace=customer', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Message attention unavailable.');
        return response.json() as Promise<{ conversations?: ConversationSummary[] }>;
      }),
    ]);

    if (requirementsResult.status === 'fulfilled') {
      const rows = requirementsResult.value.requirements ?? [];
      setRequirements(rows);
      const awarded = rows.filter((row) => row.status === 'awarded').slice(0, 5);
      if (!awarded.length) {
        setUnscheduledRequirement(null);
      } else {
        const jobResults = await Promise.allSettled(awarded.map(async (row) => {
          const response = await fetch(`/api/requirements/${encodeURIComponent(row.id)}/job`, { cache: 'no-store' });
          if (!response.ok) throw new Error('Requirement service journey unavailable.');
          const payload = await response.json() as { jobs?: Array<{ id?: string }> };
          return { row, hasJob: (payload.jobs ?? []).length > 0 };
        }));
        const nextUnscheduled = jobResults.find((result) => result.status === 'fulfilled' && !result.value.hasJob);
        setUnscheduledRequirement(nextUnscheduled && nextUnscheduled.status === 'fulfilled' ? nextUnscheduled.value.row : null);
      }
    } else {
      setUnscheduledRequirement(null);
    }
    if (ordersResult.status === 'fulfilled') {
      setOrderCount(Math.max(0, Number(ordersResult.value.unread_count ?? 0)));
      setLatestOrder(ordersResult.value.latest ?? null);
    }
    if (messagesResult.status === 'fulfilled') setConversations(messagesResult.value.conversations ?? []);
  }, []);

  useEffect(() => { void loadAttention(); }, [loadAttention]);
  useEffect(() => {
    const refresh = () => { void loadAttention(); };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('notifications-attention-refresh', refresh);
    window.addEventListener('customer-product-order-attention-refresh', refresh);
    window.addEventListener('marketplace-messages-attention-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('notifications-attention-refresh', refresh);
      window.removeEventListener('customer-product-order-attention-refresh', refresh);
      window.removeEventListener('marketplace-messages-attention-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, [loadAttention]);

  const attention = useMemo<SmartAttention>(() => {
    const completion = bookings.find((booking) =>
      booking.status === 'completed'
      && booking.closeoutState === 'awaiting_customer'
      && booking.attendanceOutcome !== 'customer_no_show'
      && booking.attendanceOutcome !== 'provider_no_show'
    );
    if (completion) {
      return {
        kind: 'completion',
        title: t('customer.attention.completionTitle'),
        body: t('customer.attention.completionBody').replace('{serviceName}', completion.serviceName),
        href: `/bookings/${encodeURIComponent(completion.bookingId)}#requirement-completion`,
        badge: t('customer.attention.actionNeeded'),
        bookingId: completion.bookingId,
      };
    }

    const proposal = requirements
      .filter((row) => Math.max(0, row.unread_proposal_count ?? 0) > 0)
      .sort((left, right) => new Date(right.latest_proposal_at ?? 0).getTime() - new Date(left.latest_proposal_at ?? 0).getTime())[0];
    if (proposal) {
      const proposalRef = proposal.latest_unread_proposal_reference || proposal.latest_proposal_reference;
      return {
        kind: 'proposal',
        title: t('customer.attention.proposalTitle'),
        body: t('customer.attention.proposalBody').replace('{title}', proposal.title),
        href: proposalRef
          ? `/requirements/${encodeURIComponent(proposal.id)}?proposal=${encodeURIComponent(proposalRef)}`
          : `/requirements/${encodeURIComponent(proposal.id)}`,
        badge: `${Math.max(1, proposal.unread_proposal_count ?? 1)} ${t('customer.attention.new')}`,
        requirementId: proposal.id,
      };
    }

    if (unscheduledRequirement) {
      return {
        kind: 'schedule',
        title: t('customer.attention.scheduleTitle'),
        body: t('customer.attention.scheduleBody').replace('{title}', unscheduledRequirement.title),
        href: `/requirements/${encodeURIComponent(unscheduledRequirement.id)}#requirement-service-job`,
        badge: t('customer.attention.actionNeeded'),
      };
    }

    const message = conversations.find((row) => Math.max(0, Number(row.unread_count ?? 0)) > 0);
    if (message) {
      const context = message.requirement_title || message.product_name || message.job_title || t('customer.attention.conversation');
      return {
        kind: 'message',
        title: t('customer.attention.messageTitle').replace('{counterpartName}', message.counterpart_name),
        body: message.last_message_body
          ? `${context} · ${message.last_message_body}`
          : t('customer.attention.messageContinue').replace('{context}', context),
        href: `/messages?conversation=${encodeURIComponent(message.id)}`,
        badge: `${Math.max(1, Number(message.unread_count ?? 1))} ${t('customer.attention.unread')}`,
      };
    }

    const safeOrderTarget = latestOrder?.target_path?.startsWith('/orders/') ? latestOrder.target_path : '/orders';
    if (orderCount > 0 && latestOrder) {
      const match = safeOrderTarget.match(/^\/orders\/([0-9a-f-]+)$/i);
      return {
        kind: 'order',
        title: latestOrder.title || t('customer.attention.orderTitle'),
        body: latestOrder.body || t('customer.attention.orderBody'),
        href: safeOrderTarget,
        badge: `${orderCount > 99 ? '99+' : orderCount} ${t('customer.attention.new')}`,
        orderId: match?.[1] ?? null,
      };
    }

    const nextService = bookings
      .filter((booking) => ['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status))
      .sort((left, right) => bookingMoment(left).localeCompare(bookingMoment(right)))[0];
    if (nextService) {
      const waiting = nextService.status === 'pending' || nextService.status === 'rescheduled';
      return {
        kind: 'service',
        title: waiting
          ? t('customer.attention.waitingTitle')
          : t('customer.attention.nextServiceTitle'),
        body: waiting
          ? t('customer.attention.waitingBody').replace('{serviceName}', nextService.serviceName)
          : `${nextService.serviceName} · ${nextService.bookingDate} · ${String(nextService.startTime).slice(0, 5)}`,
        href: `/bookings/${encodeURIComponent(nextService.bookingId)}`,
        badge: waiting ? t('customer.attention.waiting') : t('customer.attention.nextUp'),
      };
    }

    return {
      kind: 'clear',
      title: t('customer.attention.clearTitle'),
      body: t('customer.attention.clearBody'),
      href: '/explore',
      badge: t('customer.attention.clearBadge'),
    };
  }, [bookings, conversations, latestOrder, orderCount, requirements, t, unscheduledRequirement]);

  const openAttention = async () => {
    if (opening) return;
    setOpening(true);
    try {
      if (attention.kind === 'proposal') {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mark_requirement_proposals_read: true, requirement_id: attention.requirementId }),
        });
        window.dispatchEvent(new Event('notifications-attention-refresh'));
      } else if (attention.kind === 'order' && attention.orderId) {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mark_product_order_updates_read: true, order_id: attention.orderId }),
        });
        window.dispatchEvent(new Event('customer-product-order-attention-refresh'));
        window.dispatchEvent(new Event('notifications-attention-refresh'));
      }
    } catch {
      // Acknowledgement is best effort. The exact destination remains available.
    } finally {
      router.push(attention.href);
    }
  };

  const clear = attention.kind === 'clear';
  const informational = attention.kind === 'service';
  const tone = clear ? 'success' : informational ? 'info' : 'warning';
  const actionLabel = attention.kind === 'completion'
    ? t('customer.attention.reviewService')
    : attention.kind === 'proposal'
      ? t('customer.attention.reviewProposal')
      : attention.kind === 'schedule'
        ? t('customer.attention.chooseServiceTime')
      : attention.kind === 'message'
        ? t('customer.attention.openMessage')
        : attention.kind === 'order'
          ? t('customer.attention.reviewOrderUpdate')
          : attention.kind === 'service'
            ? t('customer.attention.openServiceJourney')
            : t('customer.attention.exploreServices');

  return <Card className={`customer-smart-attention customer-smart-attention-${attention.kind}`}>
    <div className="customer-smart-attention-head">
      <div>
        <span className="eyebrow">{t('customer.attention.eyebrow')}</span>
        <h2>{attention.title}</h2>
      </div>
      <Badge tone={tone}>{attention.badge}</Badge>
    </div>
    <p className="detail-copy">{attention.body}</p>
    <div className="customer-smart-attention-actions">
      <Button type="button" variant={clear ? 'secondary' : 'primary'} loading={opening} onClick={() => void openAttention()}>{actionLabel}</Button>
      {!clear && attention.kind !== 'service' && attention.kind !== 'schedule' ? <Button type="button" variant="quiet" onClick={() => router.push('/notifications')}>{t('customer.attention.allUpdates')}</Button> : null}
    </div>

    <style jsx global>{`
      .customer-smart-attention { display: grid; gap: .8rem; margin-top: 16px; border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border)); background: linear-gradient(135deg, white 0%, color-mix(in srgb, var(--color-selected) 58%, white) 100%); box-shadow: var(--shadow-sm); }
      .customer-smart-attention-clear { border-color: #cce2d5; background: #fbfefc; }
      .customer-smart-attention-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .9rem; }
      .customer-smart-attention-head > div { min-width: 0; }
      .customer-smart-attention-head h2 { margin: .22rem 0 0; overflow-wrap: anywhere; }
      .customer-smart-attention .detail-copy { margin: 0; max-width: 68ch; }
      .customer-smart-attention-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
      @media (max-width: 720px) {
        .customer-smart-attention { gap: .6rem; margin-top: 8px; padding: 16px !important; }
        .customer-smart-attention-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: .55rem; }
        .customer-smart-attention-head h2 { font-size: clamp(1.2rem, 5.4vw, 1.45rem); line-height: 1.14; }
        .customer-smart-attention .detail-copy { font-size: .9rem; line-height: 1.5; }
        .customer-smart-attention-actions { display: grid; grid-template-columns: 1fr; gap: .45rem; }
        .customer-smart-attention-actions .button { width: 100%; justify-content: center; min-height: 42px; }
        .customer-smart-attention-clear .customer-smart-attention-actions .button { border-color: color-mix(in srgb, var(--color-primary) 42%, var(--color-border)); background: var(--color-selected); color: var(--color-primary-strong); font-weight: 800; }
      }
    `}</style>
  </Card>;
}
