import type { Metadata } from 'next';
import { PublicJobBoard } from '../../components/jobs/PublicJobBoard';

const jobsTitle = 'Jobs & Opportunities';
const jobsDescription = 'Explore full-time, part-time, contract, freelance and internship opportunities posted by verified TakeItEsee businesses.';

export const metadata: Metadata = {
  title: jobsTitle,
  description: jobsDescription,
  alternates: { canonical: '/jobs' },
  openGraph: {
    type: 'website',
    siteName: 'TakeItEsee',
    title: `${jobsTitle} | TakeItEsee`,
    description: jobsDescription,
    url: '/jobs',
    locale: 'en_IN',
    images: ['/brand/social'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${jobsTitle} | TakeItEsee`,
    description: jobsDescription,
    images: ['/brand/social'],
  },
};

export default function JobsPage() {
  return <PublicJobBoard />;
}
