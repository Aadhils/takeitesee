'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AccountShell } from './AccountPresentation';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { getSupabaseBrowserUser } from '../../services/auth-adapter';
import { getCustomerProfile } from '../../services/customer-profile';

type NotificationItem = {
  id: string;
  booking_id: string | null;
  conversation_id: string | null;
  event_type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function labelFor(type: string) {
  if (type === 'message_received' || type === 'requirement_chat_opened') return 'Message';
  if (type.startsWith('booking_') || type.startsWith('reschedule_')) return 'Booking';
  if (type.startsWith('payment_') || type.startsWith('refund_')) return 'Payment';
  if (type.startsWith('review_')) return 'Review';
  if (type.startsWith('provider_') || type.startsWith('service_launch_')) return 'Provider';
  if (type.startsWith('support_') || type.includes('dispute')) return 'Support';
  return 'Update';
}

function hrefFor(item: NotificationItem) {
  if (item.conversation_id) return `/messages?conversation=${encodeURIComponent(item.conversation_id)}`;
  if (item.booking_id) return `/bookings/${encodeURIComponent(item.booking_id)}`;
  return '';
}

export default function LiveNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [customerName, setCustomerName] = useState('Your account');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [response, user] = await Promise.all([fetch('/api/notifications', { cache: 'no-store' }), getSupabaseBrowserUser()]);
      const payload = await response.json() as { notifications?: NotificationItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load notifications.');
      setItems(payload.notifications ?? []);
      if (user) {
        try {
          const profile = await getCustomerProfile(user.id, user.email ?? undefined);
          setCustomerName(profile.displayName || 'Your account');
        } catch { }
      }
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  useEffect(() => {
    const badge = document.querySelector<HTMLElement>('.account-nav-count');
    if (!badge) return;
    badge.textContent = String(unread);
    badge.style.display = unread ? '' : 'none';
    badge.setAttribute('aria-label', `${unread} unread notification${unread === 1 ? '' : 's'}`);
  });

  const markRead = async (id: string) => {
    const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!response.ok) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  };

  const markAllRead = async () => {
    if (!unread || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mark_all_read: true }) });
      if (!response.ok) return;
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: now }));
    } finally { setBusy(false); }
  };

  return <AccountShell active="/notifications" customerName={customerName}>
    <section className="account-page-heading"><span className="eyebrow">Live account activity</span><h1>Notifications</h1><p>Booking, proposal, messaging and service lifecycle updates from your account.</p></section>
    <div className="notification-toolbar"><Badge tone={unread ? 'info' : 'neutral'}>{unread} unread</Badge>{unread ? <Button type="button" variant="quiet" loading={busy} onClick={() => void markAllRead()}>Mark all as read</Button> : <span className="results-note">You are all caught up</span>}</div>
    {loading ? <Card><p>Loading notifications…</p></Card> : error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Try again</Button></Card> : items.length ? <div className="notification-list">{items.map((item) => {
      const label = labelFor(item.event_type);
      const href = hrefFor(item);
      return <Card className={`notification-card ${!item.read_at ? 'notification-unread' : ''}`} key={item.id}><div className="notification-card-mark" aria-hidden="true">{label.slice(0,1)}</div><div className="notification-card-body"><div className="notification-card-top"><Badge tone={!item.read_at ? 'info' : 'neutral'}>{label}</Badge><time>{new Date(item.created_at).toLocaleString('en-IN')}</time></div><h2>{item.title}</h2><p>{item.body}</p><div className="notification-card-actions">{href ? <Link href={href} className="text-link">{item.conversation_id ? 'Open conversation' : 'View booking'}</Link> : null}{!item.read_at ? <Button type="button" variant="quiet" onClick={() => void markRead(item.id)}>Mark as read</Button> : null}</div></div></Card>;
    })}</div> : <Card><EmptyState title="No notifications yet">New booking, proposal and messaging updates will appear here automatically.</EmptyState></Card>}
  </AccountShell>;
}
