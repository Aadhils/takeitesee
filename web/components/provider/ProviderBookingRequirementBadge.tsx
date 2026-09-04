'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../ui/primitives';

type Context = { schedule_pattern: 'one_time' | 'recurring'; occurrence_number: number; occurrence_count: number };

export default function ProviderBookingRequirementBadge({ bookingId }: { bookingId: string }) {
  const [context, setContext] = useState<Context | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}/requirement-context`, { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ context?: Context | null }> : { context: null })
      .then((payload) => { if (active) setContext(payload.context ?? null); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [bookingId]);
  if (context?.schedule_pattern !== 'recurring') return null;
  return <Badge tone="info">Occurrence #{context.occurrence_number}/{context.occurrence_count}</Badge>;
}
