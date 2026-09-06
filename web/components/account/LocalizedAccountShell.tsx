'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

export default function LocalizedAccountShell({ children, active, customerName, unreadCount }: { children: ReactNode; active: string; customerName?: string; unreadCount?: number }) {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const name = customerName || t('account.yourAccount');
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const unreadLabel = locale === 'ta-IN' ? 'படிக்காத அறிவிப்புகள்' : 'unread notifications';
  const links = [
    { href: '/account', label: t('account.overview') },
    { href: '/account/profile', label: t('account.profile') },
    { href: '/account/settings', label: t('account.settings') },
    { href: '/saved-services', label: locale === 'ta-IN' ? 'சேமித்த சேவைகள்' : 'Saved services' },
    { href: '/notifications', label: t('account.notifications') },
    { href: '/reviews', label: t('account.reviews') },
    { href: '/account/support', label: locale === 'ta-IN' ? 'Platform உதவி' : 'Platform support' },
    { href: '/help', label: t('account.help') },
  ];

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <div className="account-sidebar-heading">
          <div className="provider-avatar account-avatar" aria-hidden="true">{initials || '?'}</div>
          <div><strong>{name}</strong><span>{t('account.customer')}</span></div>
        </div>
        <nav aria-label={t('account.nav')}>
          {links.map((link) => (
            <Link href={link.href} className={active === link.href ? 'account-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>
              {link.label}
              {link.href === '/notifications' && unreadCount ? <span className="account-nav-count" aria-label={`${unreadCount} ${unreadLabel}`}>{unreadCount}</span> : null}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="account-content">{children}</main>
    </div>
  );
}
