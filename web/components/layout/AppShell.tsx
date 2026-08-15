'use client';

import Link from 'next/link';
import { useState } from 'react';

const primaryLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/categories', label: 'Categories' },
  { href: '/professionals', label: 'Professionals' },
  { href: '/businesses', label: 'Businesses' },
];

const mobileLinks = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/explore', label: 'Explore', icon: '⌕' },
  { href: '/requirements', label: 'Requests', icon: '＋' },
  { href: '/login', label: 'Profile', icon: '◯' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="shell-bar">
          <Link href="/" className="brand" aria-label="TakeItEsee home">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span>TakeItEsee</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {primaryLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          </nav>
          <div className="header-actions">
            <Link href="/login" className="header-login">Log in</Link>
            <Link href="/register" className="button button-primary header-join">Join</Link>
            <button
              className="menu-trigger"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label="Toggle navigation menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">
            {primaryLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>
            ))}
            <Link href="/register" className="mobile-menu-join" onClick={() => setMenuOpen(false)}>Create an account</Link>
          </nav>
        ) : null}
      </header>

      <main className="page-frame">{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <Link href="/" className="brand brand-footer"><span className="brand-mark" aria-hidden="true">T</span><span>TakeItEsee</span></Link>
            <p>Find the right service for the next thing you need.</p>
          </div>
          <div className="footer-links" aria-label="Footer navigation">
            <Link href="/requirements">Post a requirement</Link>
            <Link href="/professionals">For professionals</Link>
            <Link href="/businesses">For businesses</Link>
          </div>
          <p className="footer-note">Built for useful connections.</p>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        {mobileLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <span aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
