import ProviderTrustManager from '../../../components/admin/ProviderTrustManager';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProviderTrustPage() {
  await productionAuthProvider.requireAdmin();
  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">Trust & safety</span>
      <h1>Provider trust state</h1>
      <p>Require fresh verification, suspend marketplace access, or restore provider trust without deleting booking history or operational records.</p>
    </section>
    <ProviderTrustManager />
  </main>;
}
