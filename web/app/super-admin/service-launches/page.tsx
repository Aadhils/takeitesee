import Link from 'next/link';
import ServiceLaunchReviewManager from '../../../components/admin/ServiceLaunchReviewManager';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ServiceLaunchReviewPage() {
  await productionAuthProvider.requireAdmin();
  return <main className="container section-stack"><section className="page-intro"><span className="eyebrow">Provider launch control</span><h1>Service launch reviews</h1><p>Approve canonical application, category, and location mappings before a provider can activate a service.</p><Link href="/super-admin">← Super Admin</Link></section><ServiceLaunchReviewManager /></main>;
}
