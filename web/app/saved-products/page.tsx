import type { Metadata } from 'next';
import SavedProductsPage from '../../components/account/SavedProductsPage';

export const metadata: Metadata = {
  title: { absolute: 'Saved Products | TakeItEsee' },
  robots: { index: false, follow: false },
};

export default function SavedProductsRoute() {
  return <SavedProductsPage />;
}
