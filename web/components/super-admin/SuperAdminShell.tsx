'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const groups = [
  {
    label: 'Overview',
    links: [{ href: '/super-admin', label: 'Dashboard' }],
  },
  {
    label: 'Admin governance',
    links: [
      { href: '/super-admin/admins', label: 'Admins & permissions' },
      { href: '/super-admin/audit', label: 'Audit log' },
    ],
  },
  {
    label: 'Platform governance',
    links: [
      { href: '/super-admin/applications', label: 'Platform applications' },
      { href: '/super-admin/locations', label: 'Locations' },
      { href: '/super-admin/categories', label: 'Categories' },
      { href: '/super-admin/privacy-requests', label: 'Privacy requests' },
    ],
  },
] as const;

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => href === '/super-admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="super-admin-shell">
      <aside className="super-admin-sidebar">
        <div className="super-admin-brand">
          <span className="super-admin-mark">S</span>
          <div><strong>TakeItEsee Control</strong><span>Super Admin</span></div>
        </div>
        <nav aria-label="Super Admin navigation" className="super-admin-nav">
          {groups.map((group) => (
            <section key={group.label} className="super-admin-nav-group">
              <span>{group.label}</span>
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className={active(link.href) ? 'super-admin-nav-active' : ''} aria-current={active(link.href) ? 'page' : undefined}>
                  {link.label}
                </Link>
              ))}
            </section>
          ))}
        </nav>
        <div className="super-admin-handoff">
          <span>Marketplace operations</span>
          <p>Provider reviews, verification and day-to-day operations stay in Admin.</p>
          <Link href="/admin">Open Admin operations →</Link>
        </div>
      </aside>
      <div className="super-admin-content">{children}</div>
      <style jsx global>{`
        .super-admin-shell { display: grid; grid-template-columns: 248px minmax(0, 1fr); gap: 28px; align-items: start; }
        .super-admin-sidebar { position: sticky; top: 88px; display: grid; gap: 18px; max-height: calc(100vh - 110px); overflow: auto; padding: 16px; border: 1px solid var(--color-border); border-radius: 20px; background: var(--color-surface); box-shadow: 0 12px 36px rgb(29 28 54 / 7%); }
        .super-admin-brand { display: flex; align-items: center; gap: 10px; }
        .super-admin-brand div { display: grid; gap: 2px; }
        .super-admin-brand strong { font-size: .9rem; }
        .super-admin-brand span { color: var(--color-ink-muted); font-size: .72rem; }
        .super-admin-mark { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 12px; background: var(--color-primary); color: white !important; font-weight: 800; }
        .super-admin-nav { display: grid; gap: 14px; }
        .super-admin-nav-group { display: grid; gap: 4px; }
        .super-admin-nav-group > span { padding: 0 8px; color: var(--color-ink-muted); font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .super-admin-nav-group a { padding: 9px 10px; border-radius: 11px; color: var(--color-ink); font-size: .86rem; font-weight: 650; text-decoration: none; }
        .super-admin-nav-group a:hover, .super-admin-nav-active { background: var(--color-primary-soft); color: var(--color-primary-strong) !important; }
        .super-admin-handoff { display: grid; gap: 6px; padding: 12px; border-radius: 14px; background: var(--color-surface-muted); }
        .super-admin-handoff > span { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
        .super-admin-handoff p { margin: 0; color: var(--color-ink-muted); font-size: .76rem; line-height: 1.4; }
        .super-admin-handoff a { font-size: .78rem; font-weight: 750; }
        .super-admin-content { min-width: 0; }
        @media (max-width: 900px) {
          .super-admin-shell { display: block; }
          .super-admin-sidebar { position: static; max-height: none; margin-bottom: 18px; }
          .super-admin-nav { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
          .super-admin-nav-group { padding: 10px; border: 1px solid var(--color-border); border-radius: 14px; }
          .super-admin-handoff { display: none; }
        }
        @media (max-width: 620px) {
          .super-admin-nav { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
