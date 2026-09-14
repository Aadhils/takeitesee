'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

export default function LocalizedAccountShell({ children, active, customerName, unreadCount }: { children: ReactNode; active: string; customerName?: string; unreadCount?: number }) {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [fetchedUnreadCount, setFetchedUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [productOrderUnreadCount, setProductOrderUnreadCount] = useState(0);
  const name = customerName || t('account.yourAccount');
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const unreadLabel = locale === 'ta-IN' ? 'படிக்காத அறிவிப்புகள்' : 'unread notifications';
  const messageUnreadLabel = locale === 'ta-IN' ? 'படிக்காத செய்திகள்' : 'unread messages';
  const productOrderUnreadLabel = locale === 'ta-IN' ? 'புதிய Product Order updates' : 'new Product Order updates';
  const moreLabel = locale === 'ta-IN' ? 'மேலும்' : 'More';
  const resolvedUnreadCount = unreadCount ?? fetchedUnreadCount;
  const countLabel = (value: number) => value > 99 ? '99+' : String(value);
  const links = [
    { href: '/account', label: t('account.overview'), mobileLabel: t('account.overview') },
    { href: '/account/profile', label: t('account.profile'), mobileLabel: t('account.profile') },
    { href: '/account/settings', label: t('account.settings'), mobileLabel: t('account.settings') },
    { href: '/saved-services', label: locale === 'ta-IN' ? 'சேமித்த சேவைகள்' : 'Saved services', mobileLabel: locale === 'ta-IN' ? 'சேவைகள்' : 'Services' },
    { href: '/saved-products', label: locale === 'ta-IN' ? 'சேமித்த Products' : 'Saved Products', mobileLabel: 'Products' },
    { href: '/requirements', label: locale === 'ta-IN' ? 'தேவைகள்' : 'Requirements', mobileLabel: locale === 'ta-IN' ? 'தேவைகள்' : 'Needs' },
    { href: '/orders', label: locale === 'ta-IN' ? 'என் Product Orders' : 'My product orders', mobileLabel: 'Orders' },
    { href: '/messages', label: locale === 'ta-IN' ? 'செய்திகள்' : 'Messages', mobileLabel: locale === 'ta-IN' ? 'செய்திகள்' : 'Messages' },
    { href: '/notifications', label: t('account.notifications'), mobileLabel: t('account.notifications') },
    { href: '/reviews', label: t('account.reviews'), mobileLabel: t('account.reviews') },
    { href: '/account/support', label: locale === 'ta-IN' ? 'Platform உதவி' : 'Platform support', mobileLabel: locale === 'ta-IN' ? 'உதவி' : 'Support' },
    { href: '/help', label: t('account.help'), mobileLabel: t('account.help') },
  ];
  const mobilePrimaryHrefs = new Set(['/account', '/saved-services', '/saved-products', '/requirements']);
  const mobilePrimaryLinks = links.filter((link) => mobilePrimaryHrefs.has(link.href));
  const mobileSecondaryLinks = links.filter((link) => !mobilePrimaryHrefs.has(link.href));
  const activeSecondaryLink = mobileSecondaryLinks.find((link) => link.href === active);
  const mobileMoreLabel = activeSecondaryLink?.mobileLabel || moreLabel;

  useEffect(() => {
    if (unreadCount !== undefined) return;
    let activeRequest = true;
    const load = async () => {
      try {
        const response = await fetch('/api/notifications?mode=unread-count', { cache: 'no-store' });
        if (!response.ok || !activeRequest) return;
        const payload = await response.json() as { unread_count?: number };
        if (Number.isFinite(payload.unread_count)) setFetchedUnreadCount(Math.max(0, Number(payload.unread_count)));
      } catch {
        // Notification navigation attention is progressive enhancement.
      }
    };
    const refresh = () => { void load(); };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    void load();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('notifications-attention-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      activeRequest = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('notifications-attention-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, [unreadCount]);

  useEffect(() => {
    let activeRequest = true;
    const load = async () => {
      try {
        const response = await fetch('/api/messages?mode=unread-count', { cache: 'no-store' });
        if (!response.ok || !activeRequest) return;
        const payload = await response.json() as { unread_count?: number };
        if (Number.isFinite(payload.unread_count)) setMessageUnreadCount(Math.max(0, Number(payload.unread_count)));
      } catch {
        // Message navigation attention is progressive enhancement.
      }
    };
    const refresh = () => { void load(); };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    void load();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('marketplace-messages-attention-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      activeRequest = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('marketplace-messages-attention-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, []);

  useEffect(() => {
    let activeRequest = true;
    const load = async () => {
      try {
        const response = await fetch('/api/notifications?mode=product-order-unread-updates', { cache: 'no-store' });
        if (!response.ok || !activeRequest) return;
        const payload = await response.json() as { unread_count?: number };
        if (Number.isFinite(payload.unread_count)) setProductOrderUnreadCount(Math.max(0, Number(payload.unread_count)));
      } catch {
        // Product Order navigation attention is progressive enhancement.
      }
    };
    const refresh = () => { void load(); };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    void load();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('customer-product-order-attention-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      activeRequest = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('customer-product-order-attention-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, []);

  const notificationBadge = resolvedUnreadCount ? <span className="account-nav-count" aria-label={`${resolvedUnreadCount} ${unreadLabel}`}>{countLabel(resolvedUnreadCount)}</span> : null;
  const messageBadge = messageUnreadCount ? <span className="account-nav-count" aria-label={`${messageUnreadCount} ${messageUnreadLabel}`}>{countLabel(messageUnreadCount)}</span> : null;
  const productOrderBadge = productOrderUnreadCount ? <span className="account-nav-count" aria-label={`${productOrderUnreadCount} ${productOrderUnreadLabel}`}>{countLabel(productOrderUnreadCount)}</span> : null;

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <div className="account-sidebar-heading">
          <div className="provider-avatar account-avatar" aria-hidden="true">{initials || '?'}</div>
          <div><strong>{name}</strong><span>{t('account.customer')}</span></div>
        </div>
        <nav className="account-desktop-nav" aria-label={t('account.nav')}>
          {links.map((link) => (
            <Link href={link.href} className={active === link.href ? 'account-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>
              {link.label}
              {link.href === '/orders' ? productOrderBadge : null}
              {link.href === '/messages' ? messageBadge : null}
              {link.href === '/notifications' ? notificationBadge : null}
            </Link>
          ))}
        </nav>
        <nav className="account-mobile-nav" aria-label={`${t('account.nav')} ${locale === 'ta-IN' ? 'மொபைல்' : 'mobile'}`}>
          {mobilePrimaryLinks.map((link) => (
            <Link
              href={link.href}
              className={`account-mobile-tab${active === link.href ? ' account-mobile-tab-active' : ''}`}
              aria-current={active === link.href ? 'page' : undefined}
              aria-label={link.label}
              key={link.href}
            >
              <span className="account-mobile-tab-label">{link.mobileLabel}</span>
            </Link>
          ))}
          <details className={`account-mobile-more${activeSecondaryLink ? ' account-mobile-more-active' : ''}`}>
            <summary aria-label={activeSecondaryLink ? `${mobileMoreLabel} — ${moreLabel}` : moreLabel}>
              <span className="account-mobile-more-label">{mobileMoreLabel}</span>
              {resolvedUnreadCount ? <span className="account-nav-count account-mobile-more-count" aria-label={`${resolvedUnreadCount} ${unreadLabel}`}>{countLabel(resolvedUnreadCount)}</span> : null}
              <span className="account-mobile-more-caret" aria-hidden="true">⌄</span>
            </summary>
            <div className="account-mobile-more-menu">
              {mobileSecondaryLinks.map((link) => (
                <Link href={link.href} className={active === link.href ? 'account-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>
                  <span>{link.label}</span>
                  {link.href === '/orders' ? productOrderBadge : null}
                  {link.href === '/messages' ? messageBadge : null}
                  {link.href === '/notifications' ? notificationBadge : null}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      </aside>
      <main className="account-content">{children}</main>
    </div>
  );
}