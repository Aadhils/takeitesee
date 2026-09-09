import type { Metadata } from 'next';
import CustomerOrdersManager from '../../components/order/CustomerOrdersManager';

export const metadata: Metadata = {
  title: { absolute: 'Product Orders | TakeItEsee' },
  robots: { index: false, follow: false },
};

export default function OrdersRoute() {
  return <CustomerOrdersManager />;
}
