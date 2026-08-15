import { notFound } from 'next/navigation';
import { AdminDisputeDetail } from '../../../../components/admin/AdminPresentation';
import { adminIssues } from '../../../../data/admin-fixtures';

export default async function AdminDisputeDetailRoute({ params }: { params: Promise<{ disputeId: string }> }) {
  const { disputeId } = await params;
  if (!adminIssues.some((issue) => issue.id === disputeId)) notFound();
  return <AdminDisputeDetail disputeId={disputeId} />;
}
