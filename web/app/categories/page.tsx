import Link from 'next/link';
import { Alert, Badge, Card } from '../../components/ui/primitives';
import { loadPublicCategories } from '../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const categories = await loadPublicCategories();

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">Browse services</span>
        <h1>Browse the categories that are live right now.</h1>
        <p>Only categories with active services from verified providers appear here.</p>
      </section>

      {categories === null ? (
        <Alert title="Category directory temporarily unavailable" tone="warning">
          The live catalog could not be loaded. You can still search the marketplace directly from Explore.
        </Alert>
      ) : categories.length ? (
        <>
          <div className="results-heading"><div><span className="eyebrow">Live catalog</span><h2>{categories.length} active {categories.length === 1 ? 'category' : 'categories'}</h2></div></div>
          <div className="service-grid">
            {categories.map((category) => (
              <Card className="discovery-card" key={category.slug}>
                <div className="discovery-card-content">
                  <div className="card-meta"><Badge tone="info">Live category</Badge><Badge tone="neutral">{category.service_count} {category.service_count === 1 ? 'service' : 'services'}</Badge></div>
                  <h2><Link href={`/explore?category=${encodeURIComponent(category.slug)}`}>{category.name}</Link></h2>
                  <p className="card-description">Browse verified providers currently publishing services in {category.name}.</p>
                  <div className="card-footer"><span>Filtered live marketplace</span><Link href={`/explore?category=${encodeURIComponent(category.slug)}`} className="button button-secondary">Explore category</Link></div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <h2>No live service categories yet.</h2>
          <p>Categories will appear here automatically when verified providers publish active services.</p>
          <div className="button-row"><Link href="/requirements" className="button button-primary">Post a requirement</Link><Link href="/explore" className="button button-secondary">Explore marketplace</Link></div>
        </Card>
      )}
    </div>
  );
}
