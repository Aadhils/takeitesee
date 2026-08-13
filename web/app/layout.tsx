import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'TakeItEsee',
  description: 'Find Services. Find Professionals. Grow Your Business.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="text-xl font-bold">TakeItEsee</div>
            <nav className="space-x-4">
              <a href="/explore" className="text-sm font-medium">Explore</a>
              <a href="/categories" className="text-sm font-medium">Categories</a>
              <a href="/requirements" className="text-sm font-medium">Requirements</a>
              <a href="/professionals" className="text-sm font-medium">Professionals</a>
              <a href="/businesses" className="text-sm font-medium">Businesses</a>
            </nav>
            <div className="space-x-2">
              <a href="/login" className="text-sm">Login</a>
              <a href="/register" className="ml-2 inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded">Join TakeItEsee</a>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>

        <footer className="border-t bg-white mt-12">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-600">© TakeItEsee — Placeholder footer</div>
        </footer>
      </body>
    </html>
  );
}
