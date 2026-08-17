import { CategoryCard } from '../../components/discovery/MarketplaceCards';
import { discoveryCategories } from '../../data/discovery-fixtures';

export default function CategoriesPage() {
  return <div className="discovery-page"><section className="page-intro"><span className="eyebrow">Find a starting point</span><h1>Browse by category.</h1><p>Explore practical services across home, work, learning, wellness, events, and technology.</p></section><div className="categories-grid">{discoveryCategories.map((category) => <CategoryCard category={category} key={category.id} />)}</div><p className="explore-disclaimer">Category detail pages are represented by the Explore route until catalog navigation is introduced.</p></div>;
}
