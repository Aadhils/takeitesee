'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

export default function LocalizedAccountShell({ children, active, customerName, unreadCount }: { children: ReactNode; active: string; customerName?: string; unreadCount?: number }) {
  const { t } = useRemainingWorkspaceTranslations();
  const [fetchedUnreadCount, setFetchedUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [productOrderUnreadCount, setProductOrderUnreadCount] = useState(0);
  const name = customerName || t('account.yourAccount');
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const unreadLabel = t('account.unreadNotifications');
  const messageUnreadLabel = t('account.unreadMessages');
  const productOrderUnreadLabel = t('account.newProductOrderUpdates');
  const moreLabel = t('account.more');
  const resolvedUnreadCount = unreadCount ?? fetchedUnreadCount;
  const countLabel = (value: number) => value > 99 ? '99+' : String(value);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('customer-workspace-active');
    return () => { document.body.classList.remove('customer-workspace-active'); };
  }, []);
  const links = [
    { href: '/account', label: t('account.overview'), mobileLabel: t('account.overview') },
    { href: '/account/profile', label: t('account.profile'), mobileLabel: t('account.profile') },
    { href: '/account/settings', label: t('account.settings'), mobileLabel: t('account.settings') },
    { href: '/saved-services', label: t('account.savedServices'), mobileLabel: t('account.savedServicesMobile') },
    { href: '/saved-products', label: t('account.savedProducts'), mobileLabel: t('account.savedProductsMobile') },
    { href: '/requirements', label: t('account.requirements'), mobileLabel: t('account.requirementsMobile') },
    { href: '/orders', label: t('account.orders'), mobileLabel: t('account.ordersMobile') },
    { href: '/messages', label: t('account.messages'), mobileLabel: t('account.messagesMobile') },
    { href: '/notifications', label: t('account.notifications'), mobileLabel: t('account.notifications') },
    { href: '/reviews', label: t('account.reviews'), mobileLabel: t('account.reviews') },
    { href: '/account/support', label: t('account.support'), mobileLabel: t('account.supportMobile') },
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
        const response = await fetch('/api/messages?mode=unread-count&workspace=customer', { cache: 'no-store' });
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
        <nav className="account-mobile-nav" aria-label={`${t('account.nav')} ${t('account.mobileNavSuffix')}`}>
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