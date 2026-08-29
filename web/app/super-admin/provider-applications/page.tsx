import Link from 'next/link';
import ProviderApplicationsManager from '../../../components/admin/ProviderApplicationsManager';
import { productionAuthProvider } from '../../../server/auth/session';

export default async function ProviderApplicationsPage() {
  await productionAuthProvider.requireAdmin();
  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">Provider supply control</span>
      <h1>Provider applications</h1>
      <p>Review professional and business onboarding requests before provider ownership and workspace access are activated.</p>
      <Link href="/super-admin">← Super Admin</Link>
    </section>
    <ProviderApplicationsManager />
  </main>;
}
