import Link from 'next/link';
import type { ReactNode } from 'react';

const links = [
  { href: '/super-admin', label: 'Overview' },
  { href: '/super-admin/applications', label: 'Applications' },
  { href: '/super-admin/locations', label: 'Locations & markets' },
  { href: '/super-admin/categories', label: 'Categories' },
  { href: '/super-admin/admins', label: 'Admins & permissions' },
  { href: '/admin', label: 'Operations dashboard' },
];

export function SuperAdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="super-admin-workspace">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-heading">
            <div className="admin-mark" aria-hidden="true">S</div>
            <div>
              <strong>TakeItEsee Control</strong>
              <span>Super Admin workspace</span>
            </div>
          </div>
          <nav aria-label="Super Admin navigation">
            {links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
          </nav>
          <div className="admin-scope-note">
            <strong>Platform authority</strong>
            <p>Protected by active membership plus platform manage scope.</p>
          </div>
          <Link href="/account" className="admin-exit-link">Account</Link>
          <Link href="/" className="admin-exit-link">Return to marketplace</Link>
        </aside>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
