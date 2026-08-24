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
  event_type: 'booking_created' | 'booking_accepted' | 'booking_declined' | 'booking_rescheduled' | 'booking_cancelled' | 'service_completed';
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const labels: Record<NotificationItem['event_type'], string> = {
  booking_created: 'Booking',
  booking_accepted: 'Booking',
  booking_declined: 'Booking',
  booking_rescheduled: 'Booking',
  booking_cancelled: 'Booking',
  service_completed: 'Service',
};

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
    <section className="account-page-heading"><span className="eyebrow">Live account activity</span><h1>Notifications</h1><p>Booking lifecycle updates from your shared production account.</p></section>
    <div className="notification-toolbar"><Badge tone={unread ? 'info' : 'neutral'}>{unread} unread</Badge>{unread ? <Button type="button" variant="quiet" loading={busy} onClick={() => void markAllRead()}>Mark all as read</Button> : <span className="results-note">You are all caught up</span>}</div>
    {loading ? <Card><p>Loading notifications…</p></Card> : error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Try again</Button></Card> : items.length ? <div className="notification-list">{items.map((item) => <Card className={`notification-card ${!item.read_at ? 'notification-unread' : ''}`} key={item.id}><div className="notification-card-mark" aria-hidden="true">{labels[item.event_type].slice(0,1)}</div><div className="notification-card-body"><div className="notification-card-top"><Badge tone={!item.read_at ? 'info' : 'neutral'}>{labels[item.event_type]}</Badge><time>{new Date(item.created_at).toLocaleString('en-IN')}</time></div><h2>{item.title}</h2><p>{item.body}</p><div className="notification-card-actions">{item.booking_id ? <Link href={`/bookings/${item.booking_id}`} className="text-link">View booking</Link> : null}{!item.read_at ? <Button type="button" variant="quiet" onClick={() => void markRead(item.id)}>Mark as read</Button> : null}</div></div></Card>)}</div> : <Card><EmptyState title="No notifications yet">New booking updates will appear here automatically.</EmptyState></Card>}
  </AccountShell>;
}
