import FinanceManager from '../../../components/admin/FinanceManager';
import FinanceRefundQueue from '../../../components/admin/FinanceRefundQueue';
import FinanceRiskManager from '../../../components/admin/FinanceRiskManager';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function SuperAdminFinancePage() {
  await productionAuthProvider.requireAdmin();
  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">Platform finance</span>
      <h1>Commission, payouts, refunds & payment risk</h1>
      <p>Control versioned commission rules, settlement holds, provider payout transfers, verified customer refunds, chargebacks, auto-refunds, and provider recovery from one finance workspace.</p>
    </section>
    <FinanceManager />
    <FinanceRefundQueue />
    <FinanceRiskManager />
  </main>;
}
