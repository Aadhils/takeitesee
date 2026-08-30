'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';
import { useAdminAccess } from './AdminAccessContext';

const links = [
  { href: '/admin', en: 'Dashboard', ta: 'டாஷ்போர்டு' },
  { href: '/admin/bookings', en: 'Bookings', ta: 'புக்கிங்ஸ்' },
  { href: '/admin/moderation', en: 'Moderation', ta: 'Moderation' },
  { href: '/admin/disputes', en: 'Issues', ta: 'சிக்கல்கள்' },
  { href: '/admin/providers', en: 'Providers', ta: 'வழங்குநர்கள்' },
  { href: '/admin/customers', en: 'Customers', ta: 'வாடிக்கையாளர்கள்' },
  { href: '/admin/services', en: 'Services', ta: 'சேவைகள்' },
  { href: '/admin/reviews', en: 'Reviews', ta: 'மதிப்புரைகள்' },
  { href: '/admin/reports', en: 'Reports', ta: 'அறிக்கைகள்' },
  { href: '/admin/settings', en: 'Settings', ta: 'அமைப்புகள்' },
] as const;

export function AdminLiveShell({ children, active }: { children: ReactNode; active: string }) {
  const { locale } = useLanguage();
  const access = useAdminAccess();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const scope = access.isSuperAdmin
    ? text('Super Admin access', 'Super Admin அணுகல்')
    : access.scopeCount
      ? text(`${access.scopeCount} delegated scope${access.scopeCount === 1 ? '' : 's'}`, `${access.scopeCount} delegated scope`)
      : text('Delegated admin access', 'Delegated admin அணுகல்');

  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <div className="admin-sidebar-heading"><div className="admin-mark" aria-hidden="true">A</div><div><strong>TakeItEsee Ops</strong><span>{text('Marketplace operations', 'Marketplace செயல்பாடுகள்')}</span></div></div>
      <nav aria-label={text('Admin navigation', 'Admin வழிசெலுத்தல்')}>{links.map((link) => <Link href={link.href} className={active === link.href ? 'admin-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>{text(link.en, link.ta)}</Link>)}</nav>
      <div className="admin-scope-note"><Badge tone={access.canManage || access.isSuperAdmin ? 'success' : 'info'}>{scope}</Badge><p>{access.canManage || access.isSuperAdmin ? text('Live scoped management is enabled.', 'Live scoped management இயக்கப்பட்டுள்ளது.') : text('Live scoped read access is enabled.', 'Live scoped read access இயக்கப்பட்டுள்ளது.')}</p></div>
      {access.isSuperAdmin ? <Link href="/super-admin" className="admin-exit-link">{text('Open Super Admin', 'Super Admin திற')}</Link> : null}
      <Link href="/" className="admin-exit-link">{text('Return to marketplace', 'Marketplace-க்கு திரும்பு')}</Link>
    </aside>
    <main className="admin-content">{children}</main>
  </div>;
}

export function AdminLiveHeading({ eyebrow, title, description, action }: { eyebrow: ReactNode; title: ReactNode; description: ReactNode; action?: ReactNode }) {
  return <section className="admin-page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action ? <div className="admin-heading-action">{action}</div> : null}</section>;
}

export function AdminLiveMetricCard({ label, value, detail, tone = 'neutral' }: { label: ReactNode; value: string; detail: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'info' }) {
  return <Card className="admin-metric-card"><span className="eyebrow">{label}</span><strong>{value}</strong><span className={`admin-metric-detail admin-metric-${tone}`}>{detail}</span></Card>;
}
