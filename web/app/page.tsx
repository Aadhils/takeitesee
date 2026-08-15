import Link from 'next/link';
import { Badge, Button, Card, Input } from '../components/ui/primitives';

const categories = [
  { name: 'Home & repair', detail: 'Electricians, plumbers, painters', mark: '01' },
  { name: 'Learning', detail: 'Tutors, coaches, mentors', mark: '02' },
  { name: 'Wellness', detail: 'Fitness, beauty, care', mark: '03' },
  { name: 'Business help', detail: 'Design, accounting, strategy', mark: '04' },
];

const services = [
  { title: 'Home electrical inspection', provider: 'Brightline Services', location: 'Chennai · Available today', price: 'From INR 850', tone: 'success' as const },
  { title: 'Brand identity starter kit', provider: 'Maya Thomas · Professional', location: 'Remote · 4.9 rating', price: 'From INR 4,500', tone: 'info' as const },
  { title: 'Maths coaching for grades 8-10', provider: 'Northstar Learning', location: 'Bengaluru · Weekday slots', price: 'From INR 600 / hour', tone: 'warning' as const },
];

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <Badge tone="info">A better way to find help</Badge>
          <h1>Find the right service for the next thing you need.</h1>
          <p className="hero-lede">Discover trusted professionals and businesses, compare what fits, and move from question to done with less friction.</p>
          <form className="search-panel" action="/explore">
            <Input label="What do you need help with?" placeholder="Try &quot;AC repair&quot; or &quot;logo design&quot;" aria-label="Search for a service" />
            <Input label="Where?" placeholder="City or neighbourhood" aria-label="Choose a location" />
            <Button type="submit">Explore services</Button>
          </form>
          <div className="hero-links">
            <Link href="/requirements">Can&apos;t find it? Post a requirement <span aria-hidden="true">-&gt;</span></Link>
            <span>English · Tamil · Hindi · Malayalam</span>
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
          {categories.map((category) => <Link href="/categories" className="category-tile" key={category.name}><span className="category-mark">{category.mark}</span><strong>{category.name}</strong><span>{category.detail}</span></Link>)}
        </div>
      </section>

      <section className="section-block section-muted" aria-labelledby="services-heading">
        <div className="section-heading"><div><span className="eyebrow">Curated starting points</span><h2 id="services-heading">Popular near you</h2></div><Link href="/explore" className="text-link">See the full explore view <span aria-hidden="true">-&gt;</span></Link></div>
        <div className="service-grid">
          {services.map((service) => <Card className="service-card" key={service.title}><div className="service-art" aria-hidden="true"><span>{service.title.slice(0, 1)}</span></div><div className="service-content"><div className="service-meta"><Badge tone={service.tone}>{service.tone === 'success' ? 'Available' : service.tone === 'info' ? 'Remote' : 'Popular'}</Badge><span>New listing</span></div><h3>{service.title}</h3><p className="service-provider">{service.provider}</p><p className="service-location">{service.location}</p><div className="service-bottom"><strong>{service.price}</strong><Link href="/explore" className="icon-link" aria-label={`View ${service.title}`}>-&gt;</Link></div></div></Card>)}
        </div>
      </section>

      <section className="trust-strip" aria-labelledby="trust-heading">
        <div><span className="eyebrow">For every side of the connection</span><h2 id="trust-heading">Useful when you need help.<br />Practical when you offer it.</h2></div>
        <div className="trust-actions"><Link href="/professionals" className="button button-secondary">Offer a service</Link><Link href="/requirements" className="button button-primary">Post a requirement</Link></div>
      </section>
    </div>
  );
}
