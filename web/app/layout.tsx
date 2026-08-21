import './globals.css';
import './responsive-overrides.css';
import { ReactNode } from 'react';
import AppShell from '../components/layout/AppShell';

export const metadata = {
  title: 'takeitesee',
  description: 'Find Services. Find Professionals. Grow Your Business.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
