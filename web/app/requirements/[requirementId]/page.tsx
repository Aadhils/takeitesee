import { CustomerRequirementWorkspace } from '../../../components/requirements/CustomerRequirementWorkspace';

type SearchParams = { proposal?: string | string[] };

export default async function RequirementDetailPage({ params, searchParams }: { params: Promise<{ requirementId: string }>; searchParams: Promise<SearchParams> }) {
  const [{ requirementId }, query] = await Promise.all([params, searchParams]);
  const proposalValue = Array.isArray(query.proposal) ? query.proposal[0] : query.proposal;
  const proposalReference = proposalValue && /^PROP-[A-Z0-9-]{6,64}$/i.test(proposalValue) ? proposalValue : undefined;
  return <CustomerRequirementWorkspace requirementId={requirementId} proposalReference={proposalReference} />;
}
