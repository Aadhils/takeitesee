import AdminLiveIssueDetail from '../../../../components/admin/AdminLiveIssueDetail';
import { getAdminSessionOrNull } from '../../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminDisputeDetailRoute({ params }: { params: Promise<{ disputeId: string }> }) {
  if (!await getAdminSessionOrNull()) return null;
  const { disputeId } = await params;
  return <AdminLiveIssueDetail issueId={disputeId} />;
}
