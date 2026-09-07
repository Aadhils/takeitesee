import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import ProfessionalPublicProfileContent, {
  loadPublicProfessional,
  publicProfessionalSeoText,
  publicProfessionalSiteUrl,
} from '../../../components/detail/ProfessionalPublicProfileContent';
import { loadCurrentPublicProviderHandle } from '../../../server/identity/public-handle';

export async function generateMetadata({ params }: { params: Promise<{ providerId: string }> }): Promise<Metadata> {
  const { providerId } = await params;
  const [record, handle] = await Promise.all([
    loadPublicProfessional(providerId),
    loadCurrentPublicProviderHandle('professional', providerId),
  ]);

  if (!record) {
    return {
      title: { absolute: 'Professional unavailable | TakeItEsee' },
      robots: { index: false, follow: false },
    };
  }

  const { provider, services, roles, career } = record;
  const displayName = provider.headline || 'Verified professional';
  const location = provider.service_area || '';
  const primaryTalent = roles[0]?.title ? ` · ${String(roles[0].title)}` : '';
  const pageTitle = `${displayName}${primaryTalent}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const skillNames = career?.skills?.slice(0, 3).map((skill: any) => String(skill.name || '')).filter(Boolean) ?? [];
  const talentNames = roles.slice(0, Math.max(0, 3 - skillNames.length)).map((role: any) => String(role.title || '')).filter(Boolean);
  const careerText = [...talentNames, ...skillNames].length ? ` Skills include ${[...talentNames, ...skillNames].join(', ')}.` : '';
  const description = publicProfessionalSeoText(
    career?.profile?.career_summary || provider.description,
    `Explore services, professional talents, career experience and work samples from ${displayName}${location ? ` in ${location}` : ''} on TakeItEsee.${careerText}`,
  );
  const canonical = handle
    ? `${publicProfessionalSiteUrl}/@${encodeURIComponent(handle)}`
    : `${publicProfessionalSiteUrl}/professionals/${encodeURIComponent(providerId)}`;
  const indexable = services.length > 0 || roles.length > 0 || Boolean(career);

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

export default async function ProfessionalProfilePage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const [record, handle] = await Promise.all([
    loadPublicProfessional(providerId),
    loadCurrentPublicProviderHandle('professional', providerId),
  ]);
  if (!record) notFound();

  if (handle) {
    permanentRedirect(`/@${encodeURIComponent(handle)}`);
  }

  return <ProfessionalPublicProfileContent
    providerId={providerId}
    canonicalUrl={`${publicProfessionalSiteUrl}/professionals/${encodeURIComponent(providerId)}`}
  />;
}
