import FinanceManager from '../../../components/admin/FinanceManager';
import FinanceRefundQueue from '../../../components/admin/FinanceRefundQueue';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function SuperAdminFinancePage() {
  await productionAuthProvider.requireAdmin();
  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">Platform finance</span>
      <h1>Commission, payouts & refunds</h1>
      <p>Control versioned commission rules, settlement holds, provider payout transfers, and verified customer refund reconciliation from one finance workspace.</p>
    </section>
    <FinanceManager />
    <FinanceRefundQueue />
  </main>;
}
