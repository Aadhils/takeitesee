import { CustomerRequirementWorkspace } from '../../../components/requirements/CustomerRequirementWorkspace';

export default async function RequirementDetailPage({ params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = await params;
  return <CustomerRequirementWorkspace requirementId={requirementId} />;
}
