import type { Metadata } from 'next';
import { PublicJobBoard } from '../../components/jobs/PublicJobBoard';

export const metadata: Metadata = {
  title: 'Jobs & Opportunities | TakeItEsee',
  description: 'Explore full-time, part-time, contract, freelance and internship opportunities posted by verified TakeItEsee businesses.',
  alternates: { canonical: '/jobs' },
};

export default function JobsPage() {
  return <PublicJobBoard />;
}
