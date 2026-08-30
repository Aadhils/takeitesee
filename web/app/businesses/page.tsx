import { PublicBusinessesDirectory } from '../../components/discovery/PublicDirectoryViews';
import { loadPublicBusinesses } from '../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

export default async function BusinessesPage() {
  const businesses = await loadPublicBusinesses();
  return <PublicBusinessesDirectory businesses={businesses} />;
}
