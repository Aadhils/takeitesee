'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '../ui/primitives';
import { useRequirementBookingContextTranslations } from '../i18n/RequirementBookingContextTranslations';
import SmartServiceJourneyGuide from './SmartServiceJourneyGuide';

type RequirementBookingContext = {
  requirement_id: string;
  requirement_title: string;
  conversation_id: string | null;
};

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export default function CustomerRequirementBookingContext({ bookingId }: { bookingId: string }) {
  const { t } = useRequirementBookingContextTranslations();
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

  const chatHref = context.conversation_id
    ? `/messages?conversation=${encodeURIComponent(context.conversation_id)}`
    : '/messages';

  return <Card id="requirement-completion" className="policy-card" tabIndex={-1}>
    <span className="eyebrow">{t('requirementBookingContext.eyebrow')}</span>
    <h2>{t('requirementBookingContext.title')}</h2>
    <p className="detail-copy">
      {interpolate(t('requirementBookingContext.body'), { title: context.requirement_title })}
    </p>
    <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
      <Link className="button button-primary" href={chatHref}>{t('requirementBookingContext.messageProvider')}</Link>
      <Link className="button button-secondary" href={`/requirements/${encodeURIComponent(context.requirement_id)}`}>{t('requirementBookingContext.openRequirement')}</Link>
    </div>
    <SmartServiceJourneyGuide bookingId={bookingId} viewer="customer" chatHref={chatHref} />
  </Card>;
}
