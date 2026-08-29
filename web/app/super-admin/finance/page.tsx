import FinanceManager from '../../../components/admin/FinanceManager';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function SuperAdminFinancePage() {
  await productionAuthProvider.requireAdmin();
  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">Platform finance</span>
      <h1>Commission & payouts</h1>
      <p>Configure versioned commission rules, settlement holds, minimum payout thresholds, and prepare provider payout batches without moving funds until the payout gateway is enabled.</p>
    </section>
    <FinanceManager />
  </main>;
}
