import type { Metadata } from 'next';
import CustomerOrderDetail from '../../../components/order/CustomerOrderDetail';

export const metadata: Metadata = {
  title: { absolute: 'Product Order Details | TakeItEsee' },
  robots: { index: false, follow: false },
};

export default async function CustomerOrderDetailRoute({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <CustomerOrderDetail orderId={orderId} />;
}
