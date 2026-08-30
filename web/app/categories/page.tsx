import { PublicCategoriesDirectory } from '../../components/discovery/PublicDirectoryViews';
import { loadPublicCategories } from '../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const categories = await loadPublicCategories();
  return <PublicCategoriesDirectory categories={categories} />;
}
