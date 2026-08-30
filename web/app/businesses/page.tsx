import Link from 'next/link';
import { Alert, Badge, Card } from '../../components/ui/primitives';
import { loadPublicBusinesses } from '../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function BusinessesPage() {
  const businesses = await loadPublicBusinesses();

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">Business directory</span>
        <h1>Verified local service businesses.</h1>
        <p>Browse businesses that currently have at least one active service published on the TakeItEsee marketplace.</p>
      </section>

      {businesses === null ? (
        <Alert title="Business directory temporarily unavailable" tone="warning">
          The live provider catalog could not be loaded. Explore remains the best place to browse currently published services.
        </Alert>
      ) : businesses.length ? (
        <>
          <div className="results-heading"><div><span className="eyebrow">Live marketplace</span><h2>{businesses.length} verified {businesses.length === 1 ? 'business' : 'businesses'}</h2></div></div>
          <div className="service-grid">
            {businesses.map((business) => (
              <Card className="discovery-card business-card" key={business.id}>
                <div className="business-banner" aria-hidden="true"><span>{business.name.slice(0, 1).toUpperCase()}</span></div>
                <div className="discovery-card-content">
                  <div className="card-meta"><Badge tone="success">Verified business</Badge><Badge tone="info">{business.service_count} active {business.service_count === 1 ? 'service' : 'services'}</Badge></div>
                  <h2><Link href={`/businesses/${business.id}`}>{business.name}</Link></h2>
                  <p className="card-description">{business.description || 'Verified business with active services on TakeItEsee.'}</p>
                  <p className="card-location"><span aria-hidden="true">⌖</span> {business.location || 'Service area shown on individual listings'}</p>
                  {business.categories.length ? <p className="card-specialty">{business.categories.slice(0, 3).join(' · ')}</p> : null}
                  <div className="card-footer">
                    <div>{business.starting_price !== null ? <span className="price">From {money(business.starting_price, business.currency)}</span> : <span>See service pricing</span>}</div>
                    <Link href={`/businesses/${business.id}`} className="button button-secondary">View business</Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <h2>No verified businesses are publishing services right now.</h2>
          <p>New businesses will appear here automatically after verification and after at least one service becomes active.</p>
          <div className="button-row"><Link href="/explore" className="button button-primary">Explore live services</Link></div>
        </Card>
      )}
    </div>
  );
}
