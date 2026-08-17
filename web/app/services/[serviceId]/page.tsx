import { notFound } from 'next/navigation';
import { ServiceDetail } from '../../../components/detail/DetailPresentation';
import { discoveryServices } from '../../../data/discovery-fixtures';

export default async function ServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const service = discoveryServices.find((item) => item.id === serviceId);
  if (!service) notFound();
  return <ServiceDetail service={service} />;
}
