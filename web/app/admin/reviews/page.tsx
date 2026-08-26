import { AdminHeading, AdminShell } from '../../../components/admin/AdminPresentation';
import { Badge, Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveReview = {
  id: string;
  customer_id: string;
  service_id: string;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
};

type ServiceRow = { id: string; name: string };
type UserRow = { id: string; name: string; email: string };

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'published') return 'success';
  if (status === 'flagged') return 'danger';
  if (status === 'hidden' || status === 'pending') return 'warning';
  return 'neutral';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

export default async function AdminReviewsRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopes, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let reviews: LiveReview[] = [];
  let services: ServiceRow[] = [];

  if (serviceIds.length) {
    const [{ data: reviewData, error: reviewError }, { data: serviceData, error: serviceError }] = await Promise.all([
      supabase
        .from('reviews')
        .select('id,customer_id,service_id,rating,comment,status,created_at')
        .in('service_id', serviceIds)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('services').select('id,name').in('id', serviceIds),
    ]);

    if (reviewError) throw new Error(reviewError.message);
    if (serviceError) throw new Error(serviceError.message);
    reviews = (reviewData ?? []) as LiveReview[];
    services = (serviceData ?? []) as ServiceRow[];
  }

  const customerIds = Array.from(new Set(reviews.map((review) => review.customer_id)));
  let users: UserRow[] = [];

  if (customerIds.length) {
    const { data, error } = await supabase.from('users').select('id,name,email').in('id', customerIds);
    if (error) throw new Error(error.message);
    users = (data ?? []) as UserRow[];
  }

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return (
    <AdminShell active="/admin/reviews">
      <AdminHeading
        eyebrow="Scoped trust and quality"
        title="Live reviews queue"
        description="Customer reviews are loaded from Supabase and restricted to services inside this administrator’s assigned scope."
      />

      {reviews.length ? (
        <div className="admin-record-grid">
          {reviews.map((review) => {
            const service = serviceById.get(review.service_id);
            const customer = userById.get(review.customer_id);
            return (
              <Card className="admin-review-card" key={review.id}>
                <div className="admin-record-top">
                  <div>
                    <span className="eyebrow">{customer?.name || 'Customer'} · {formatDate(review.created_at)}</span>
                    <h2>{service?.name || 'Scoped service'}</h2>
                    {customer?.email ? <p>{customer.email}</p> : null}
                  </div>
                  <Badge tone={statusTone(review.status)}>{review.status.replaceAll('_', ' ')}</Badge>
                </div>
                <p><strong>{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</strong> · {review.rating}/5</p>
                <blockquote>{review.comment || 'No written comment was provided.'}</blockquote>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState title="No scoped reviews yet">
            Reviews will appear automatically after customers complete and review services inside this administrator scope.
          </EmptyState>
        </Card>
      )}
    </AdminShell>
  );
}
