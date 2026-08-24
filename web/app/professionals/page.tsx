import Link from 'next/link';
import { Alert, Card } from '../../components/ui/primitives';

export default function ProfessionalsPage() {
  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">Professional directory</span>
        <h1>Independent professionals are coming to takeitesee.</h1>
        <p>Only verified, live professional profiles will appear here once provider registration and marketplace publishing are enabled.</p>
      </section>
      <Alert title="Directory is being prepared" tone="info">
        Presentation profiles have been removed from this production page so customers are never shown sample providers as real listings.
      </Alert>
      <Card>
        <h2>Looking for a service?</h2>
        <p>Browse the live service marketplace to see services that are currently active and published by verified providers.</p>
        <div className="button-row"><Link href="/explore" className="button button-primary">Explore live services</Link></div>
      </Card>
    </div>
  );
}
