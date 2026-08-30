import Link from 'next/link';
import HomepageSearchForm from '../components/discovery/HomepageSearchForm';

const siteUrl = 'https://www.takeitesee.com';
const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'TakeItEsee',
  alternateName: 'takeitesee',
  url: siteUrl,
  description: 'Find trusted local services, verified professionals, and service businesses on the TakeItEsee marketplace.',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${siteUrl}/explore?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

const marketplacePaths = [
  { query: 'home', title: 'Home services', description: 'Cleaning, inspection, repair, and practical help for your space.', icon: '⌂' },
  { query: 'business', title: 'Business services', description: 'Find support for business, operations, and professional needs.', icon: '▦' },
  { query: 'technology', title: 'Tech & digital', description: 'Browse active technology and digital service listings.', icon: '◇' },
  { query: 'learning', title: 'Learning', description: 'Explore tutoring, coaching, and learning services when available.', icon: '↗' },
  { query: '', title: 'All live services', description: 'See the full marketplace catalog currently published on takeitesee.', icon: '✦' },
];

export default function Home() {
  return (
    <div className="home-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, '\\u003c') }}
      />
      <section className="hero-grid hero-centered">
        <div className="hero-copy hero-centered-copy">
          <div className="hero-logo-wrap">
            <img className="hero-logo" src="/official-takeitesee-logo.png" alt="takeitesee" />
          </div>
          <span className="hero-eyebrow">A better way to find help</span>
          <h1>Find the right service<br />for the <span className="text-accent">next thing you need.</span></h1>
          <p className="hero-lede">Search the live marketplace, compare published services, and book with verified providers as the catalog grows.</p>
          <HomepageSearchForm />
          <div className="hero-trust-row" aria-label="Marketplace information">
            <span><b aria-hidden="true">✓</b><strong>Verified providers</strong><small>Live listings require verification</small></span>
            <span><b aria-hidden="true">◷</b><strong>Published reviews</strong><small>Ratings come from approved reviews</small></span>
            <span><b aria-hidden="true">◇</b><strong>Live booking data</strong><small>Availability is checked during booking</small></span>
            <span><b aria-hidden="true">✦</b><strong>Growing catalog</strong><small>Only active services are shown</small></span>
          </div>
        </div>
      </section>

      <section className="section-block homepage-categories" aria-labelledby="category-heading">
        <div className="category-heading-centered"><span className="eyebrow">Live marketplace</span><h2 id="category-heading">Explore active services</h2><p>These shortcuts search the services currently published in the marketplace.</p></div>
        <div className="homepage-category-grid">
          {marketplacePaths.map((item, index) => {
            const href = item.query ? `/explore?q=${encodeURIComponent(item.query)}` : '/explore';
            return <Link href={href} className={`homepage-category-card category-accent-${index + 1}`} key={item.title}><span className="homepage-category-icon" aria-hidden="true">{item.icon}</span><strong>{item.title}</strong><p>{item.description}</p><span className="homepage-category-link">Explore services <span aria-hidden="true">-&gt;</span></span></Link>;
          })}
        </div>
        <Link href="/explore" className="category-view-all">Browse live marketplace <span aria-hidden="true">-&gt;</span></Link>
      </section>
    </div>
  );
}
