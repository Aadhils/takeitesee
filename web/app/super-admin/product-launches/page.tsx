import Link from 'next/link';
import ProductLaunchReviewManager from '../../../components/admin/ProductLaunchReviewManager';
import { getSuperAdminSessionOrNull } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProductLaunchReviewPage() {
  if (!await getSuperAdminSessionOrNull()) return null;
  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">Business catalog governance</span>
      <h1>Product launch reviews</h1>
      <p>Review the exact current product revision before it can become eligible for the public Business storefront.</p>
      <Link href="/super-admin">← Super Admin</Link>
    </section>
    <ProductLaunchReviewManager />
  </main>;
}
