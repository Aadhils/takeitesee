import Link from 'next/link';
import { Alert, Card } from '../../components/ui/primitives';

export default function BusinessesPage() {
  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">Business directory</span>
        <h1>Verified businesses are coming to takeitesee.</h1>
        <p>This directory will show real business profiles after registration, verification, and marketplace publishing are fully enabled.</p>
      </section>
      <Alert title="Directory is being prepared" tone="info">
        Presentation businesses have been removed from this production page so sample companies cannot be mistaken for live marketplace listings.
      </Alert>
      <Card>
        <h2>Looking for a service?</h2>
        <p>Use Explore to browse services that are currently active and published by verified providers.</p>
        <div className="button-row"><Link href="/explore" className="button button-primary">Explore live services</Link></div>
      </Card>
    </div>
  );
}
