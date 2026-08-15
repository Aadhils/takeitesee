import { notFound } from 'next/navigation';
import { AdminServiceModerationDetail } from '../../../../components/admin/AdminPresentation';
import { adminServices } from '../../../../data/admin-fixtures';

export default async function AdminServiceDetailRoute({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  if (!adminServices.some((service) => service.id === serviceId)) notFound();
  return <AdminServiceModerationDetail serviceId={serviceId} />;
}
