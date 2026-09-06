import Link from 'next/link';
import ProviderVerificationReviewManager from '../../../components/admin/ProviderVerificationReviewManager';
import { getSuperAdminSessionOrNull } from '../../../server/auth/session';

export default async function ProviderVerificationsPage() {
  if (!await getSuperAdminSessionOrNull()) return null;
  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">Provider trust control</span>
      <h1>Provider verification</h1>
      <p>Review private provider verification references before public service publishing is enabled.</p>
      <Link href="/super-admin">← Super Admin</Link>
    </section>
    <ProviderVerificationReviewManager />
  </main>;
}
