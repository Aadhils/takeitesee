import { AdminLiveShell } from '../../../components/admin/AdminLiveChrome';
import { MarketplaceModerationManager } from '../../../components/admin/MarketplaceModerationManager';

export const dynamic = 'force-dynamic';

export default function AdminModerationPage() {
  return <AdminLiveShell active="/admin/moderation"><MarketplaceModerationManager /></AdminLiveShell>;
}
