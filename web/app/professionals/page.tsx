import { PublicProfessionalsDirectory } from '../../components/discovery/PublicDirectoryViews';
import { loadPublicProfessionals } from '../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

export default async function ProfessionalsPage() {
  const professionals = await loadPublicProfessionals();
  return <PublicProfessionalsDirectory professionals={professionals} />;
}
