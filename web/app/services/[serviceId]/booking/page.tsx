import { notFound } from 'next/navigation';
import { BookingSelection } from '../../../../components/detail/DetailPresentation';
import { getCatalogService } from '../../../../services/catalog-repository';

export default async function ServiceBookingPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const service = await getCatalogService(serviceId);
  if (!service) notFound();
  return <BookingSelection service={service} />;
}
