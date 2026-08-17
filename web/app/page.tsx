import Link from 'next/link';
import HomepageSearchForm from '../components/discovery/HomepageSearchForm';
import { discoveryCategories } from '../data/discovery-fixtures';

const homepageCategories = [
  { slug: 'home-repair', title: 'Home & Repair', description: 'Practical help for the spaces you live in.', icon: '⌂' },
  { slug: 'business-help', title: 'Business Help', description: 'Specialists to help your work move forward.', icon: '▦' },
  { slug: 'technology', title: 'Tech & Digital', description: 'Reliable support for your digital life.', icon: '◇' },
  { slug: 'learning', title: 'Learning & Tuition', description: 'Tutors, coaches, and mentors for every goal.', icon: '↗' },
  { slug: 'wellness', title: 'Health & Wellness', description: 'Make time for your health and wellbeing.', icon: '✦' },
];

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero-grid hero-centered">
        <div className="hero-copy hero-centered-copy">
          <div className="hero-logo-wrap">
            <img className="hero-logo" src="/official-takeitesee-logo.png" alt="TakeItSee" />
          </div>
          <span className="hero-eyebrow">A better way to find help</span>
          <h1>Find the right service<br />for the <span className="text-accent">next thing you need.</span></h1>
          <p className="hero-lede">Discover trusted professionals and businesses, compare what fits, and move from question to done with less friction.</p>
          <HomepageSearchForm />
          <div className="hero-trust-row" aria-label="Trust indicators">
            <span><b aria-hidden="true">✓</b><strong>Verified professionals</strong><small>Quality you can trust</small></span>
            <span><b aria-hidden="true">◷</b><strong>Transparent reviews</strong><small>Real feedback, real people</small></span>
            <span><b aria-hidden="true">◇</b><strong>Secure and safe</strong><small>Your safety, our priority</small></span>
            <span><b aria-hidden="true">✦</b><strong>Thousands of services</strong><small>All in one place</small></span>
          </div>
        </div>
      </section>

      <section className="section-block homepage-categories" aria-labelledby="category-heading">
        <div className="category-heading-centered"><span className="eyebrow">Popular near you</span><h2 id="category-heading">Explore services by category</h2><p>Top categories people are using right now</p></div>
        <div className="homepage-category-grid">
          {homepageCategories.map((item, index) => {
            const category = discoveryCategories.find((entry) => entry.slug === item.slug);
            return category ? <Link href={`/explore?category=${category.slug}`} className={`homepage-category-card category-accent-${index + 1}`} key={category.id}><span className="homepage-category-icon" aria-hidden="true">{item.icon}</span><strong>{item.title}</strong><p>{item.description}</p><span className="homepage-category-link">Explore services <span aria-hidden="true">-&gt;</span></span></Link> : null;
          })}
        </div>
        <Link href="/categories" className="category-view-all">View all categories <span aria-hidden="true">-&gt;</span></Link>
      </section>
    </div>
  );
}
