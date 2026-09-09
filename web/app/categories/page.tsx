import { CanonicalPublicCategoriesDirectory } from '../../components/discovery/CanonicalPublicCategoriesDirectory';
import { loadCanonicalPublicCategories } from '../../server/marketplace/public-categories';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const categories = await loadCanonicalPublicCategories();
  return <CanonicalPublicCategoriesDirectory categories={categories} />;
}
