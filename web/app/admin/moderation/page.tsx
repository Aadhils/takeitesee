import { AdminShell } from '../../../components/admin/AdminPresentation';
import { MarketplaceModerationManager } from '../../../components/admin/MarketplaceModerationManager';

export const dynamic = 'force-dynamic';

export default function AdminModerationPage() {
  return <AdminShell active="/admin/moderation"><MarketplaceModerationManager /></AdminShell>;
}
