'use client';

import { useEffect } from 'react';

export default function ReferralAttributionCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.pathname.startsWith('/@')) return;

    const destinationHandle = decodeURIComponent(url.pathname.slice(2)).trim().replace(/^@+/, '').toLowerCase();
    const referrerHandle = (url.searchParams.get('ref') || '').trim().replace(/^@+/, '').toLowerCase();
    if (!destinationHandle || !referrerHandle) return;

    const controller = new AbortController();
    void fetch('/api/referral-attribution', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ referrer: referrerHandle, destination: destinationHandle }),
      credentials: 'same-origin',
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  return null;
}
