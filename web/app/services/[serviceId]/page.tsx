import { notFound } from 'next/navigation';
import { ServiceDetail } from '../../../components/detail/DetailPresentation';
import { getCatalogService } from '../../../services/catalog-repository';

export default async function ServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const service = await getCatalogService(serviceId);
  if (!service) notFound();
  return <ServiceDetail service={service} />;
}
