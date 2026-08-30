import Link from 'next/link';
import { Alert, Badge, Card } from '../../components/ui/primitives';
import { loadPublicProfessionals } from '../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function ProfessionalsPage() {
  const professionals = await loadPublicProfessionals();

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">Professional directory</span>
        <h1>Verified independent professionals.</h1>
        <p>Browse professionals that currently have at least one active service published on the TakeItEsee marketplace.</p>
      </section>

      {professionals === null ? (
        <Alert title="Professional directory temporarily unavailable" tone="warning">
          The live provider catalog could not be loaded. Explore remains the best place to browse currently published services.
        </Alert>
      ) : professionals.length ? (
        <>
          <div className="results-heading"><div><span className="eyebrow">Live marketplace</span><h2>{professionals.length} verified {professionals.length === 1 ? 'professional' : 'professionals'}</h2></div></div>
          <div className="service-grid">
            {professionals.map((professional) => (
              <Card className="discovery-card provider-card" key={professional.id}>
                <div className="provider-avatar" aria-hidden="true">{professional.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div className="discovery-card-content">
                  <div className="card-meta"><Badge tone="success">Verified professional</Badge><Badge tone="info">{professional.service_count} active {professional.service_count === 1 ? 'service' : 'services'}</Badge></div>
                  <h2><Link href={`/professionals/${professional.id}`}>{professional.name}</Link></h2>
                  <p className="card-description">{professional.description || 'Verified professional with active services on TakeItEsee.'}</p>
                  <p className="card-location"><span aria-hidden="true">⌖</span> {professional.location || 'Service area shown on individual listings'}</p>
                  {professional.categories.length ? <p className="card-specialty">{professional.categories.slice(0, 3).join(' · ')}</p> : null}
                  <div className="card-footer">
                    <div>{professional.starting_price !== null ? <span className="price">From {money(professional.starting_price, professional.currency)}</span> : <span>See service pricing</span>}</div>
                    <Link href={`/professionals/${professional.id}`} className="button button-secondary">View profile</Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <h2>No verified professionals are publishing services right now.</h2>
          <p>New professionals will appear here automatically after verification and after at least one service becomes active.</p>
          <div className="button-row"><Link href="/explore" className="button button-primary">Explore live services</Link></div>
        </Card>
      )}
    </div>
  );
}
