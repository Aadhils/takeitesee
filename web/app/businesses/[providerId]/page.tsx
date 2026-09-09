import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import BusinessPublicProfileContent, {
  loadPublicBusiness,
  publicBusinessSeoText,
  publicSiteUrl,
} from '../../../components/detail/BusinessPublicProfileContent';
import BusinessShopPublicStatus from '../../../components/detail/BusinessShopPublicStatus';
import { loadCurrentPublicProviderHandle } from '../../../server/identity/public-handle';

export async function generateMetadata({ params }: { params: Promise<{ providerId: string }> }): Promise<Metadata> {
  const { providerId } = await params;
  const [record, handle] = await Promise.all([
    loadPublicBusiness(providerId),
    loadCurrentPublicProviderHandle('business', providerId),
  ]);

  if (!record) {
    return {
      title: { absolute: 'Business unavailable | TakeItEsee' },
      robots: { index: false, follow: false },
    };
  }

  const { business, services, products } = record;
  const location = business.location || '';
  const pageTitle = `${business.name || 'Verified business'}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const offeringLabel = services.length > 0 && products.length > 0
    ? 'services and products'
    : products.length > 0
      ? 'products'
      : 'services';
  const description = publicBusinessSeoText(
    business.description,
    `Explore ${offeringLabel} from ${business.name || 'this business'}${location ? ` in ${location}` : ''} on TakeItEsee.`,
  );
  const canonical = handle
    ? `${publicSiteUrl}/@${encodeURIComponent(handle)}`
    : `${publicSiteUrl}/businesses/${encodeURIComponent(providerId)}`;
  const indexable = services.length > 0 || products.length > 0;

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
  const [record, handle] = await Promise.all([
    loadPublicBusiness(providerId),
    loadCurrentPublicProviderHandle('business', providerId),
  ]);
  if (!record) notFound();

  if (handle) {
    permanentRedirect(`/@${encodeURIComponent(handle)}`);
  }

  return <>
    <BusinessShopPublicStatus businessId={providerId} />
    <BusinessPublicProfileContent
      providerId={providerId}
      canonicalUrl={`${publicSiteUrl}/businesses/${encodeURIComponent(providerId)}`}
    />
  </>;
}
