import type { Metadata } from 'next';
import { ReactNode } from 'react';
import AppShell from '../components/layout/AppShell';
import './globals.css';
import './responsive-overrides.css';
import './ui-polish.css';
import './responsive-foundation.css';
import './auth-entry-responsive.css';
import './customer-booking-flow-responsive.css';
import './customer-booking-confirmation-responsive.css';
import './responsive-admin.css';
import './products-mobile-polish.css';
import './account-mobile-navigation.css';
import './account-real-device-fix.css';
import './account-shell-signout-responsive.css';
import './account-overview-stage4-polish.css';
import './post-requirement-mobile-cta.css';
import './bookings-real-device-fix.css';

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
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/icon/32', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon/192', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/icon/180', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'TakeItEsee',
    title: 'TakeItEsee | Find Trusted Local Services',
    description: siteDescription,
    locale: 'en_IN',
    images: [
      {
        url: '/brand/social',
        width: 1200,
        height: 630,
        alt: 'TakeItEsee',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakeItEsee | Find Trusted Local Services',
    description: siteDescription,
    images: ['/brand/social'],
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
