import { AdminProviderDetail } from '../../../../components/admin/AdminPresentation';

export default async function AdminProviderDetailRoute({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  return <AdminProviderDetail providerId={providerId} />;
}
