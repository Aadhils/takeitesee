import ProviderApplicationsManager from '../../../components/admin/ProviderApplicationsManager';
import { AdminLiveHeading, AdminLiveShell, AdminLiveText } from '../../../components/admin/AdminLiveChrome';

export const dynamic = 'force-dynamic';

export default function AdminProviderApplicationsPage() {
  return <AdminLiveShell active="/admin/provider-applications">
    <AdminLiveHeading
      eyebrow={<AdminLiveText en="Provider operations" ta="Provider செயல்பாடுகள்" />}
      title={<AdminLiveText en="Provider applications" ta="Provider விண்ணப்பங்கள்" />}
      description={<AdminLiveText en="Review Professional and Business onboarding requests before Provider workspace access is activated." ta="Provider workspace access செயல்படுத்தப்படும் முன் Professional மற்றும் Business onboarding requests-ஐ review செய்யவும்." />}
    />
    <ProviderApplicationsManager />
  </AdminLiveShell>;
}
