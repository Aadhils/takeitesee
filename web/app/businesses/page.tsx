import { BusinessCard } from '../../components/discovery/MarketplaceCards';
import { discoveryBusinesses } from '../../data/discovery-fixtures';

export default function BusinessesPage() {
  return <div className="discovery-page"><section className="page-intro"><span className="eyebrow">Local teams and studios</span><h1>Find businesses built to help.</h1><p>See the service focus, location, trust signals, and customer feedback for each business profile.</p></section><div className="directory-toolbar"><span>3 businesses in presentation data</span><span>Open status is a discovery placeholder, not a booking promise.</span></div><div className="business-grid">{discoveryBusinesses.map((business) => <BusinessCard business={business} key={business.id} />)}</div></div>;
}
