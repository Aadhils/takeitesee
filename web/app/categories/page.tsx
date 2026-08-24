import Link from 'next/link';
import { Alert, Card } from '../../components/ui/primitives';

export default function CategoriesPage() {
  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">Browse services</span>
        <h1>Find the right service for what you need.</h1>
        <p>Marketplace categories will be generated from real published services as the live catalog grows.</p>
      </section>
      <Alert title="Live catalog only" tone="info">
        Sample category counts have been removed from production. Explore now shows the marketplace services that are actually active and available from verified providers.
      </Alert>
      <Card>
        <h2>Explore the marketplace</h2>
        <p>Search and filter the current service catalog by category, provider type, location, rating, and price.</p>
        <div className="button-row"><Link href="/explore" className="button button-primary">Browse live services</Link></div>
      </Card>
    </div>
  );
}
