import { notFound } from 'next/navigation';
import { AdminProviderDetail } from '../../../../components/admin/AdminPresentation';
import { adminProviders } from '../../../../data/admin-fixtures';

export default async function AdminProviderDetailRoute({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  if (!adminProviders.some((provider) => provider.id === providerId)) notFound();
  return <AdminProviderDetail providerId={providerId} />;
}
