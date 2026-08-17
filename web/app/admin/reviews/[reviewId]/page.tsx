import { notFound } from 'next/navigation';
import { AdminReviewModerationDetail } from '../../../../components/admin/AdminPresentation';
import { adminReviews } from '../../../../data/admin-fixtures';

export default async function AdminReviewDetailRoute({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  if (!adminReviews.some((review) => review.id === reviewId)) notFound();
  return <AdminReviewModerationDetail reviewId={reviewId} />;
}
