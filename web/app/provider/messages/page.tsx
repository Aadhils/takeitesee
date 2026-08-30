import { MarketplaceMessagingWorkspace } from '../../../components/messages/MarketplaceMessagingWorkspace';
import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';

type SearchParams = Promise<{ conversation?: string }>;

export default async function ProviderMessagesRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const conversationId = typeof params.conversation === 'string' ? params.conversation : '';
  return <LiveProviderShell active="/provider/messages">
    <MarketplaceMessagingWorkspace initialConversationId={conversationId} />
  </LiveProviderShell>;
}
