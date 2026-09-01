import type { Metadata } from 'next';
import LocalizedHomepage from '../components/discovery/LocalizedHomepage';

const siteUrl = 'https://www.takeitesee.com';
const homepageDescription = 'Find trusted local services, verified professionals, and service businesses. Compare live marketplace listings and book with confidence on TakeItEsee.';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'TakeItEsee | Find Trusted Local Services',
    description: homepageDescription,
    images: ['/brand/social'],
  },
};

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

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, '\\u003c') }}
      />
      <LocalizedHomepage />
    </>
  );
}
