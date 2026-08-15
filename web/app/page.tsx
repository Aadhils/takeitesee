import Link from 'next/link';
import { Badge, Button, Input } from '../components/ui/primitives';
import { CategoryCard, ProviderCard, ServiceCard } from '../components/discovery/MarketplaceCards';
import { discoveryCategories, discoveryProfessionals, discoveryServices } from '../data/discovery-fixtures';

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <Badge tone="info">A better way to find help</Badge>
          <h1>Find the right service for the next thing you need.</h1>
          <p className="hero-lede">Discover trusted professionals and businesses, compare what fits, and move from question to done with less friction.</p>
          <form className="search-panel" action="/explore">
            <Input label="What do you need help with?" name="q" placeholder="Try &quot;AC repair&quot; or &quot;logo design&quot;" aria-label="Search for a service" />
            <Input label="Where?" name="location" placeholder="City or neighbourhood" aria-label="Choose a location" />
            <Button type="submit">Explore services</Button>
          </form>
          <div className="hero-links">
            <Link href="/requirements">Can&apos;t find it? Post a requirement <span aria-hidden="true">-&gt;</span></Link>
            <span><span aria-hidden="true">⌖</span> Showing services around Chennai</span>
          </div>
        </div>
        <div className="hero-aside" aria-label="TakeItEsee marketplace snapshot">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="snapshot-card snapshot-main">
            <div className="snapshot-topline"><span className="eyebrow">Nearby today</span><span className="live-dot">Live</span></div>
            <strong>Services that fit<br />your day.</strong>
            <div className="snapshot-route"><span className="route-dot" /><span>Chennai, Tamil Nadu</span><span className="route-line" /><span className="route-pin" /></div>
          </div>
          <div className="snapshot-card snapshot-float snapshot-rating"><span className="rating-star">*</span><strong>4.8</strong><span>average provider rating</span></div>
          <div className="snapshot-card snapshot-float snapshot-count"><strong>2,400+</strong><span>services to explore</span></div>
        </div>
      </section>

      <section className="section-block" aria-labelledby="category-heading">
        <div className="section-heading"><div><span className="eyebrow">Start somewhere useful</span><h2 id="category-heading">Explore by category</h2></div><Link href="/categories" className="text-link">View all categories <span aria-hidden="true">-&gt;</span></Link></div>
        <div className="category-grid">
          {discoveryCategories.slice(0, 4).map((category) => <CategoryCard category={category} key={category.id} />)}
        </div>
      </section>

      <section className="section-block section-muted" aria-labelledby="services-heading">
        <div className="section-heading"><div><span className="eyebrow">Curated starting points</span><h2 id="services-heading">Popular near you</h2></div><Link href="/explore" className="text-link">See the full explore view <span aria-hidden="true">-&gt;</span></Link></div>
        <div className="service-grid">
          {discoveryServices.slice(0, 3).map((service) => <ServiceCard service={service} key={service.id} />)}
        </div>
      </section>

      <section className="section-block provider-preview" aria-labelledby="provider-heading">
        <div className="section-heading"><div><span className="eyebrow">People behind the service</span><h2 id="provider-heading">Meet trusted professionals</h2></div><Link href="/professionals" className="text-link">Browse professionals <span aria-hidden="true">-&gt;</span></Link></div>
        <div className="provider-grid">{discoveryProfessionals.slice(0, 2).map((provider) => <ProviderCard provider={provider} key={provider.id} />)}</div>
      </section>

      <section className="how-it-works section-block" aria-labelledby="how-heading">
        <div className="section-heading"><div><span className="eyebrow">A clearer way forward</span><h2 id="how-heading">From need to next step</h2></div></div>
        <div className="steps-grid"><article><span>01</span><h3>Tell us what you need</h3><p>Search by service, category, or the kind of help you have in mind.</p></article><article><span>02</span><h3>Compare with confidence</h3><p>Review providers, ratings, locations, and straightforward starting prices.</p></article><article><span>03</span><h3>Choose what fits</h3><p>Take the next step when you are ready, with the details in view.</p></article></div>
      </section>

      <section className="trust-strip" aria-labelledby="trust-heading">
        <div><span className="eyebrow">For every side of the connection</span><h2 id="trust-heading">Useful when you need help.<br />Practical when you offer it.</h2></div>
        <div className="trust-actions"><Link href="/professionals" className="button button-secondary">Offer a service</Link><Link href="/requirements" className="button button-primary">Post a requirement</Link></div>
      </section>
    </div>
  );
}
