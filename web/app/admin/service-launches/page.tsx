import ServiceLaunchReviewManager from '../../../components/admin/ServiceLaunchReviewManager';
import { AdminLiveHeading, AdminLiveShell, AdminLiveText } from '../../../components/admin/AdminLiveChrome';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminServiceLaunchReviewsPage() {
  await productionAuthProvider.requireAdmin();

  return <AdminLiveShell active="/admin/service-launches">
    <AdminLiveHeading
      eyebrow={<AdminLiveText en="Scoped catalog approvals" ta="Scope செய்யப்பட்ட catalog approvals" />}
      title={<AdminLiveText en="Service launch reviews" ta="Service launch reviews" />}
      description={<AdminLiveText en="Review provider category and location launch requests visible inside your delegated marketplace scope. Manage actions are enabled only where your assigned scope grants manage permission." ta="உங்கள் delegated marketplace scope-ல் காணப்படும் provider category மற்றும் location launch requests-ஐ review செய்யவும். Manage permission உள்ள assigned scope-களில் மட்டும் actions enable ஆகும்." />}
    />
    <ServiceLaunchReviewManager />
  </AdminLiveShell>;
}
