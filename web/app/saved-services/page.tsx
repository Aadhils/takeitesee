import type { Metadata } from 'next';
import SavedServicesPage from '../../components/account/SavedServicesPage';

export const metadata: Metadata = {
  title: { absolute: 'Saved Services | TakeItEsee' },
  robots: { index: false, follow: false },
};

export default function SavedServicesRoute() {
  return <SavedServicesPage />;
}
