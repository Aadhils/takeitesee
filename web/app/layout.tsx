import type { Metadata } from 'next';
import { ReactNode } from 'react';
import AppShell from '../components/layout/AppShell';
import './globals.css';
import './responsive-overrides.css';

const siteUrl = 'https://www.takeitesee.com';
const siteDescription = 'Find trusted local services, verified professionals, and service businesses. Compare live marketplace listings and book with confidence on TakeItEsee.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TakeItEsee | Find Trusted Local Services',
    template: '%s | TakeItEsee',
  },
  description: siteDescription,
  applicationName: 'TakeItEsee',
  openGraph: {
    type: 'website',
    siteName: 'TakeItEsee',
    title: 'TakeItEsee | Find Trusted Local Services',
    description: siteDescription,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary',
    title: 'TakeItEsee | Find Trusted Local Services',
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
