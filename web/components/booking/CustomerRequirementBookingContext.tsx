'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';
import BookingServiceExecutionGuide from './BookingServiceExecutionGuide';
import RequirementCompletionGuide from './RequirementCompletionGuide';

type RequirementBookingContext = {
  requirement_id: string;
  requirement_title: string;
  conversation_id: string | null;
};

export default function CustomerRequirementBookingContext({ bookingId }: { bookingId: string }) {
  const { locale } = useOperationalTranslations();
  const [context, setContext] = useState<RequirementBookingContext | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/requirement-context`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { context?: RequirementBookingContext | null };
        if (active) setContext(payload.context ?? null);
      } catch { /* Optional requirement context must not block the booking detail. */ }
    })();
    return () => { active = false; };
  }, [bookingId]);

  if (!context) return null;

  const tamil = locale.toLowerCase().startsWith('ta');
  const chatHref = context.conversation_id
    ? `/messages?conversation=${encodeURIComponent(context.conversation_id)}`
    : '/messages';

  return <Card className="policy-card">
    <span className="eyebrow">Requirement coordination</span>
    <h2>{tamil ? 'Selected Provider உடன் coordination தொடருங்கள்' : 'Continue with your selected provider'}</h2>
    <p className="detail-copy">
      {tamil
        ? `இந்த booking “${context.requirement_title}” requirement-லிருந்து உருவானது. Schedule அல்லது service details பற்றி பேச வேண்டுமெனில் அதே private conversation-ஐ தொடருங்கள்.`
        : `This booking was created from “${context.requirement_title}”. Keep schedule and service-detail coordination in the same private conversation.`}
    </p>
    <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
      <Link className="button button-primary" href={chatHref}>{tamil ? 'Provider-க்கு message செய்' : 'Message provider'}</Link>
      <Link className="button button-secondary" href={`/requirements/${encodeURIComponent(context.requirement_id)}`}>{tamil ? 'Requirement பார்க்க' : 'Open requirement'}</Link>
    </div>
    <BookingServiceExecutionGuide bookingId={bookingId} viewer="customer" />
    <RequirementCompletionGuide bookingId={bookingId} viewer="customer" />
  </Card>;
}
