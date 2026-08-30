'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserUser } from '../../services/auth-adapter';
import { getCustomerProfile } from '../../services/customer-profile';
import { MarketplaceMessagingWorkspace } from './MarketplaceMessagingWorkspace';

const customerLinks = [
  { href: '/account', label: 'Overview' },
  { href: '/requirements', label: 'Requirements' },
  { href: '/messages', label: 'Messages' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/help', label: 'Help center' },
];

export function CustomerMessagesPage({ initialConversationId = '' }: { initialConversationId?: string }) {
  const [customerName, setCustomerName] = useState('Your account');

  useEffect(() => {
    let cancelled = false;
    void getSupabaseBrowserUser().then(async (user) => {
      if (!user) return;
      try {
        const profile = await getCustomerProfile(user.id, user.email ?? undefined);
        if (!cancelled) setCustomerName(profile.displayName || 'Your account');
      } catch { }
    });
    return () => { cancelled = true; };
  }, []);

  const initials = customerName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <div className="account-layout">
    <aside className="account-sidebar">
      <div className="account-sidebar-heading"><div className="provider-avatar account-avatar" aria-hidden="true">{initials || '?'}</div><div><strong>{customerName}</strong><span>Customer account</span></div></div>
      <nav aria-label="Customer account navigation">{customerLinks.map((link) => <Link href={link.href} className={link.href === '/messages' ? 'account-nav-active' : ''} aria-current={link.href === '/messages' ? 'page' : undefined} key={link.href}>{link.label}</Link>)}</nav>
    </aside>
    <main className="account-content"><MarketplaceMessagingWorkspace initialConversationId={initialConversationId} /></main>
  </div>;
}
