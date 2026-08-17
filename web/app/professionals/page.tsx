import { ProviderCard } from '../../components/discovery/MarketplaceCards';
import { discoveryProfessionals } from '../../data/discovery-fixtures';

export default function ProfessionalsPage() {
  return <div className="discovery-page"><section className="page-intro"><span className="eyebrow">People with a craft</span><h1>Meet independent professionals.</h1><p>Compare specialties, service areas, ratings, and working styles before you take the next step.</p></section><div className="directory-toolbar"><span>3 professionals in presentation data</span><span>Verification and availability are shown as supplied profile metadata.</span></div><div className="provider-grid">{discoveryProfessionals.map((provider) => <ProviderCard provider={provider} key={provider.id} />)}</div></div>;
}
