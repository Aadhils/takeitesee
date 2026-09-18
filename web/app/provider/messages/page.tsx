import { MarketplaceMessagingWorkspace } from '../../../components/messages/MarketplaceMessagingWorkspace';
import styles from '../../../components/messages/MarketplaceMessagingResponsive.module.css';
import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';

type SearchParams = Promise<{ conversation?: string }>;

export default async function ProviderMessagesRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const conversationId = typeof params.conversation === 'string' ? params.conversation : '';
  return <LiveProviderShell active="/provider/messages">
    <div className={styles.shell}>
      <MarketplaceMessagingWorkspace initialConversationId={conversationId} workspace="provider" />
    </div>
  </LiveProviderShell>;
}
