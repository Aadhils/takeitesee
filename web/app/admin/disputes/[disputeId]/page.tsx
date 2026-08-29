import AdminLiveIssueDetail from '../../../../components/admin/AdminLiveIssueDetail';
import { productionAuthProvider } from '../../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminDisputeDetailRoute({ params }: { params: Promise<{ disputeId: string }> }) {
  await productionAuthProvider.requireAdmin();
  const { disputeId } = await params;
  return <AdminLiveIssueDetail issueId={disputeId} />;
}
