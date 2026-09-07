'use client';

import { useEffect } from 'react';

type Props = {
  referrerHandle: string;
  destinationHandle: string;
};

export default function ReferralAttributionCapture({ referrerHandle, destinationHandle }: Props) {
  useEffect(() => {
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
  }, [referrerHandle, destinationHandle]);

  return null;
}
