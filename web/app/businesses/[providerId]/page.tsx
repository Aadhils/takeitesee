import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BusinessPublicProfileContent, {
  loadPublicBusiness,
  publicBusinessSeoText,
  publicSiteUrl,
} from '../../../components/detail/BusinessPublicProfileContent';

export async function generateMetadata({ params }: { params: Promise<{ providerId: string }> }): Promise<Metadata> {
  const { providerId } = await params;
  const record = await loadPublicBusiness(providerId);

  if (!record) {
    return {
      title: { absolute: 'Business unavailable | TakeItEsee' },
      robots: { index: false, follow: false },
    };
  }

  const { business, services } = record;
  const location = business.location || '';
  const pageTitle = `${business.name || 'Verified business'}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const description = publicBusinessSeoText(
    business.description,
    `Explore services from ${business.name || 'this business'}${location ? ` in ${location}` : ''} on TakeItEsee.`,
  );
  const canonical = `${publicSiteUrl}/businesses/${encodeURIComponent(providerId)}`;
  const indexable = services.length > 0;

  return {
    title: { absolute: socialTitle },
    description,
    alternates: indexable ? { canonical } : undefined,
    robots: { index: indexable, follow: indexable },
    openGraph: indexable ? {
      title: socialTitle,
      description,
      url: canonical,
      type: 'website',
      images: ['/brand/social'],
    } : undefined,
    twitter: indexable ? {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/brand/social'],
    } : undefined,
  };
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const record = await loadPublicBusiness(providerId);
  if (!record) notFound();

  return <BusinessPublicProfileContent
    providerId={providerId}
    canonicalUrl={`${publicSiteUrl}/businesses/${encodeURIComponent(providerId)}`}
  />;
}
