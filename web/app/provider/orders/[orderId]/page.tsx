import type { Metadata } from 'next';
import ProviderOrderDetail from '../../../../components/provider/ProviderOrderDetail';

export const metadata: Metadata = {
  title: { absolute: 'Business Product Order Details | TakeItEsee' },
  robots: { index: false, follow: false },
};

export default async function ProviderOrderDetailRoute({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <ProviderOrderDetail orderId={orderId} />;
}
