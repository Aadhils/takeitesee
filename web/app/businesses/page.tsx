import BusinessProductsDiscoveryEntry from '../../components/discovery/BusinessProductsDiscoveryEntry';
import { PublicBusinessesDirectory } from '../../components/discovery/PublicDirectoryViews';
import { loadPublicBusinesses } from '../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

export default async function BusinessesPage() {
  const businesses = await loadPublicBusinesses();
  return <>
    <div className="container"><BusinessProductsDiscoveryEntry /></div>
    <PublicBusinessesDirectory businesses={businesses} />
  </>;
}
