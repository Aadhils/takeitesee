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
  const { locale } = useOperationalTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
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
        title: tamil ? 'Service முடிந்ததா என்பதை உறுதி செய்யுங்கள்' : 'Confirm whether your service was completed',
        body: tamil
          ? `${completion.serviceName} service-க்கு உங்கள் acknowledgement தேவை. சரியாக முடிந்திருந்தால் confirm செய்யுங்கள்; issue இருந்தால் confirm செய்யாமல் support/chat பயன்படுத்தலாம்.`
          : `Your ${completion.serviceName} service needs your acknowledgement. Confirm it if everything is complete; if there is an issue, use chat or support instead.`,
        href: `/bookings/${encodeURIComponent(completion.bookingId)}#requirement-completion`,
        badge: tamil ? 'Action needed' : 'Action needed',
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
        title: tamil ? 'புதிய Provider proposal வந்துள்ளது' : 'A new provider proposal is ready',
        body: tamil
          ? `“${proposal.title}” requirement-க்கு புதிய reply வந்துள்ளது. Profile, quote மற்றும் service details-ஐ ஒரே இடத்தில் compare செய்யலாம்.`
          : `A provider replied to “${proposal.title}”. Compare the profile, quote and service details in one place.`,
        href: proposalRef
          ? `/requirements/${encodeURIComponent(proposal.id)}?proposal=${encodeURIComponent(proposalRef)}`
          : `/requirements/${encodeURIComponent(proposal.id)}`,
        badge: `${Math.max(1, proposal.unread_proposal_count ?? 1)} ${tamil ? 'new' : 'new'}`,
        requirementId: proposal.id,
      };
    }

    if (unscheduledRequirement) {
      return {
        kind: 'schedule',
        title: tamil ? 'Provider தேர்வு முடிந்தது — service time தேர்வு செய்யுங்கள்' : 'Provider chosen — choose your service time',
        body: tamil
          ? `“${unscheduledRequirement.title}” service-க்கு Provider already தேர்வு செய்யப்பட்டுள்ளார். Date/time தேர்வு செய்தால் journey அடுத்த stage-க்கு நகரும்.`
          : `A provider is already chosen for “${unscheduledRequirement.title}”. Choose the date and time to move the service journey forward.`,
        href: `/requirements/${encodeURIComponent(unscheduledRequirement.id)}#requirement-service-job`,
        badge: tamil ? 'Action needed' : 'Action needed',
      };
    }

    const message = conversations.find((row) => Math.max(0, Number(row.unread_count ?? 0)) > 0);
    if (message) {
      const context = message.requirement_title || message.product_name || message.job_title || (tamil ? 'conversation' : 'conversation');
      return {
        kind: 'message',
        title: tamil ? `${message.counterpart_name}-இடமிருந்து புதிய message` : `New message from ${message.counterpart_name}`,
        body: message.last_message_body
          ? `${context} · ${message.last_message_body}`
          : (tamil ? `${context} conversation-ஐ தொடருங்கள்.` : `Continue your ${context} conversation.`),
        href: `/messages?conversation=${encodeURIComponent(message.id)}`,
        badge: `${Math.max(1, Number(message.unread_count ?? 1))} ${tamil ? 'unread' : 'unread'}`,
      };
    }

    const safeOrderTarget = latestOrder?.target_path?.startsWith('/orders/') ? latestOrder.target_path : '/orders';
    if (orderCount > 0 && latestOrder) {
      const match = safeOrderTarget.match(/^\/orders\/([0-9a-f-]+)$/i);
      return {
        kind: 'order',
        title: latestOrder.title || (tamil ? 'Product Order update' : 'Product Order update'),
        body: latestOrder.body || (tamil ? 'உங்கள் order-ல் புதிய update உள்ளது.' : 'There is a new update on your order.'),
        href: safeOrderTarget,
        badge: `${orderCount > 99 ? '99+' : orderCount} ${tamil ? 'new' : 'new'}`,
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
          ? (tamil ? 'Provider confirmation காத்திருக்கிறது' : 'Waiting for provider confirmation')
          : (tamil ? 'உங்கள் அடுத்த service ready' : 'Your next service is ready'),
        body: waiting
          ? (tamil ? `${nextService.serviceName} request அனுப்பப்பட்டுள்ளது. இப்போது வேறு action தேவையில்லை; status மாறும்போது இங்கே காட்டப்படும்.` : `Your ${nextService.serviceName} request is with the provider. No action is needed now; this card will update when the status changes.`)
          : `${nextService.serviceName} · ${nextService.bookingDate} · ${String(nextService.startTime).slice(0, 5)}`,
        href: `/bookings/${encodeURIComponent(nextService.bookingId)}`,
        badge: waiting ? (tamil ? 'Waiting' : 'Waiting') : (tamil ? 'Next up' : 'Next up'),
      };
    }

    return {
      kind: 'clear',
      title: tamil ? 'இப்போது செய்ய வேண்டிய urgent action இல்லை' : 'You are all caught up',
      body: tamil
        ? 'புதிய proposal, message, order update அல்லது service action வந்தால் இந்த card தானாக மாறும்.'
        : 'This card will update automatically when a proposal, message, order update or service action needs your attention.',
      href: '/explore',
      badge: tamil ? 'Clear' : 'Clear',
    };
  }, [bookings, conversations, latestOrder, orderCount, requirements, tamil, unscheduledRequirement]);

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
    ? (tamil ? 'Service-ஐ check செய்' : 'Review service')
    : attention.kind === 'proposal'
      ? (tamil ? 'Proposal review செய்' : 'Review proposal')
      : attention.kind === 'schedule'
        ? (tamil ? 'Service time தேர்வு செய்' : 'Choose service time')
      : attention.kind === 'message'
        ? (tamil ? 'Message திற' : 'Open message')
        : attention.kind === 'order'
          ? (tamil ? 'Order update பார்க்க' : 'Review order update')
          : attention.kind === 'service'
            ? (tamil ? 'Service journey பார்க்க' : 'Open service journey')
            : (tamil ? 'Services தேடு' : 'Explore services');

  return <Card className={`customer-smart-attention customer-smart-attention-${attention.kind}`}>
    <div className="customer-smart-attention-head">
      <div>
        <span className="eyebrow">{tamil ? 'இப்போது முக்கியம்' : 'What needs my attention now?'}</span>
        <h2>{attention.title}</h2>
      </div>
      <Badge tone={tone}>{attention.badge}</Badge>
    </div>
    <p className="detail-copy">{attention.body}</p>
    <div className="customer-smart-attention-actions">
      <Button type="button" variant={clear ? 'secondary' : 'primary'} loading={opening} onClick={() => void openAttention()}>{actionLabel}</Button>
      {!clear && attention.kind !== 'service' && attention.kind !== 'schedule' ? <Button type="button" variant="quiet" onClick={() => router.push('/notifications')}>{tamil ? 'அனைத்து updates' : 'All updates'}</Button> : null}
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
        .customer-smart-attention { margin-top: 12px; }
        .customer-smart-attention-head { align-items: flex-start; flex-direction: column; }
        .customer-smart-attention-actions { display: grid; grid-template-columns: 1fr; }
        .customer-smart-attention-actions :global(.button) { width: 100%; justify-content: center; min-height: 44px; }
      }
    `}</style>
  </Card>;
}
