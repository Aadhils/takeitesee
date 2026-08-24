'use client';

import Link from 'next/link';
import { Alert, Card } from '../ui/primitives';

export function ProviderOnboarding() {
  return (
    <div className="auth-page provider-onboarding-page">
      <section className="page-intro">
        <span className="eyebrow">Provider onboarding</span>
        <h1>Provider registration is being finalized.</h1>
        <p>
          New professional and business registrations are not enabled yet. Existing providers can continue using the live provider workspace.
        </p>
      </section>

      <Alert title="Registration temporarily unavailable" tone="info">
        We are connecting provider creation, ownership, verification, and role assignment to the production account system before opening registration.
      </Alert>

      <Card>
        <h2>Already have a provider account?</h2>
        <p>Open the provider workspace to manage your live services and bookings.</p>
        <div className="button-row">
          <Link href="/provider" className="button button-primary">Open provider workspace</Link>
          <Link href="/account" className="button button-secondary">Back to account</Link>
        </div>
      </Card>
    </div>
  );
}
