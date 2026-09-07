import ProviderVerificationReviewManager from '../../../components/admin/ProviderVerificationReviewManager';
import { AdminLiveHeading, AdminLiveShell, AdminLiveText } from '../../../components/admin/AdminLiveChrome';

export const dynamic = 'force-dynamic';

export default function AdminProviderVerificationsPage() {
  return <AdminLiveShell active="/admin/provider-verifications">
    <AdminLiveHeading
      eyebrow={<AdminLiveText en="Provider trust operations" ta="Provider trust செயல்பாடுகள்" />}
      title={<AdminLiveText en="Provider verification" ta="Provider verification" />}
      description={<AdminLiveText en="Review private Provider verification references before public marketplace publishing is enabled." ta="Public marketplace publishing enable செய்யப்படும் முன் private Provider verification references-ஐ review செய்யவும்." />}
    />
    <ProviderVerificationReviewManager />
  </AdminLiveShell>;
}
