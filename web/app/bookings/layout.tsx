import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'My Bookings',
  description: 'View and manage your TakeItEsee bookings, schedules and available booking actions.',
  robots: { index: false, follow: false },
};

export default function BookingsLayout({ children }: { children: ReactNode }) {
  return children;
}
