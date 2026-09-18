import { redirect } from 'next/navigation';
import { CustomerMessagesPage } from '../../components/messages/CustomerMessagesPage';
import { productionAuthProvider } from '../../server/auth/session';

type SearchParams = Promise<{ conversation?: string }>;

export default async function MessagesRoute({ searchParams }: { searchParams: SearchParams }) {
  const session = await productionAuthProvider.getSession();
  const params = await searchParams;
  const conversationId = typeof params.conversation === 'string' ? params.conversation : '';
  const returnTo = `/messages${conversationId ? `?conversation=${encodeURIComponent(conversationId)}` : ''}`;

  if (!session) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);

  return <CustomerMessagesPage initialConversationId={conversationId} />;
}
