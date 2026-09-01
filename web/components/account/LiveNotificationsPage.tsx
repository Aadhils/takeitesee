'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import LocalizedAccountShell from './LocalizedAccountShell';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { getSupabaseBrowserUser } from '../../services/auth-adapter';
import { getCustomerProfile } from '../../services/customer-profile';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

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

function hrefFor(item: NotificationItem) {
  if (item.conversation_id) return `/messages?conversation=${encodeURIComponent(item.conversation_id)}`;
  if (item.booking_id) return `/bookings/${encodeURIComponent(item.booking_id)}`;
  return '';
}

export default function LiveNotificationsPage() {
  const { locale, t } = useOperationalTranslations();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const guestCopy = locale === 'ta-IN' ? {
    title: 'அறிவிப்புகளை பார்க்க sign in செய்யவும்',
    help: 'உங்கள் booking, proposal மற்றும் message updates-ஐ பார்க்க உங்கள் account-ல் sign in செய்யவும்.',
    signIn: 'Sign in',
    createAccount: 'Account உருவாக்கவும்',
  } : {
    title: 'Sign in to view notifications',
    help: 'Sign in to your account to see booking, proposal, messaging and service updates.',
    signIn: 'Sign in',
    createAccount: 'Create account',
  };

  const labelFor = (type: string) => {
    if (type === 'message_received' || type === 'requirement_chat_opened') return t('notif.message');
    if (type.startsWith('booking_') || type.startsWith('reschedule_')) return t('notif.booking');
    if (type.startsWith('payment_') || type.startsWith('refund_')) return t('notif.payment');
    if (type.startsWith('review_')) return t('notif.review');
    if (type.startsWith('provider_') || type.startsWith('service_launch_')) return t('notif.provider');
    if (type.startsWith('support_') || type.includes('dispute')) return t('notif.support');
    return t('notif.update');
  };

  const load = async () => {
    try {
      setLoading(true);
      const user = await getSupabaseBrowserUser();
      if (!user) {
        setAuthenticated(false);
        setItems([]);
        setCustomerName('');
        setError('');
        return;
      }

      setAuthenticated(true);
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const payload = await response.json() as { notifications?: NotificationItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load notifications.');
      setItems(payload.notifications ?? []);

      try {
        const profile = await getCustomerProfile(user.id, user.email ?? undefined);
        setCustomerName(profile.displayName || '');
      } catch { }
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

  return <LocalizedAccountShell active="/notifications" customerName={customerName || undefined} unreadCount={unread}>
    <section className="account-page-heading"><span className="eyebrow">{t('notif.eyebrow')}</span><h1>{t('notif.title')}</h1><p>{t('notif.intro')}</p></section>
    {authenticated === false ? <Card>
      <EmptyState title={guestCopy.title}>{guestCopy.help}</EmptyState>
      <div className="button-row">
        <Link href="/login" className="button button-primary">{guestCopy.signIn}</Link>
        <Link href="/signup" className="button button-secondary">{guestCopy.createAccount}</Link>
      </div>
    </Card> : <>
      {authenticated === true && !loading ? <div className="notification-toolbar"><Badge tone={unread ? 'info' : 'neutral'}>{unread} {t('notif.unread')}</Badge>{unread ? <Button type="button" variant="quiet" loading={busy} onClick={() => void markAllRead()}>{t('notif.markAll')}</Button> : <span className="results-note">{t('notif.caughtUp')}</span>}</div> : null}
      {loading ? <Card><p>{t('notif.loading')}</p></Card> : error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{t('common.tryAgain')}</Button></Card> : items.length ? <div className="notification-list">{items.map((item) => {
        const label = labelFor(item.event_type);
        const href = hrefFor(item);
        return <Card className={`notification-card ${!item.read_at ? 'notification-unread' : ''}`} key={item.id}><div className="notification-card-mark" aria-hidden="true">{label.slice(0,1)}</div><div className="notification-card-body"><div className="notification-card-top"><Badge tone={!item.read_at ? 'info' : 'neutral'}>{label}</Badge><time>{new Date(item.created_at).toLocaleString(locale)}</time></div><h2>{item.title}</h2><p>{item.body}</p><div className="notification-card-actions">{href ? <Link href={href} className="text-link">{item.conversation_id ? t('notif.openConversation') : t('notif.viewBooking')}</Link> : null}{!item.read_at ? <Button type="button" variant="quiet" onClick={() => void markRead(item.id)}>{t('notif.markRead')}</Button> : null}</div></div></Card>;
      })}</div> : <Card><EmptyState title={t('notif.none')}>{t('notif.noneHelp')}</EmptyState></Card>}
    </>}
  </LocalizedAccountShell>;
}
