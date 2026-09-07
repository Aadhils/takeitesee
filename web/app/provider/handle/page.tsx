import IdentityHandleManager from '../../../components/identity/IdentityHandleManager';
import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';
import { getProviderSessionOrNull } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProviderHandlePage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;

  return <LiveProviderShell active="/provider/handle">
    <IdentityHandleManager context="provider" />
  </LiveProviderShell>;
}
