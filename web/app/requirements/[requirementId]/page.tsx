import CustomerRequirementDetail from '../../../components/requirements/CustomerRequirementDetail';

export default async function RequirementDetailPage({ params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = await params;
  return <CustomerRequirementDetail requirementId={requirementId} />;
}
