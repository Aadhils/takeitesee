import Link from 'next/link';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

type AuditRow = {
  id: number;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  application_id: string | null;
  location_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type UserRow = { id: string; name: string | null; email: string | null };
type NamedRow = { id: string; name: string };

function titleCase(value: string) {
  return value
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function metadataSummary(row: AuditRow) {
  const metadata = row.metadata ?? {};
  if (row.action === 'settings.update') {
    const after = metadata.after;
    if (after && typeof after === 'object') {
      const queue = (after as Record<string, unknown>).default_review_queue;
      if (typeof queue === 'string') return `Review queue: ${titleCase(queue)}`;
    }
    return 'Scoped operational settings updated';
  }

  const name = metadata.name;
  if (typeof name === 'string') return name;

  const status = metadata.status;
  if (typeof status === 'string') return `Status: ${titleCase(status)}`;

  const enabled = metadata.enabled;
  if (typeof enabled === 'boolean') return enabled ? 'Enabled' : 'Disabled';

  return row.resource_id ? `Resource ${row.resource_id.slice(0, 12)}…` : 'Platform action';
}

export default async function SuperAdminAuditPage() {
  const supabase = await createSupabaseServerClient();

  const { data: auditData, error } = await supabase
    .from('admin_audit_log')
    .select('id,actor_user_id,action,resource_type,resource_id,application_id,location_id,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const auditRows = (auditData ?? []) as AuditRow[];
  const actorIds = Array.from(new Set(auditRows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id))));
  const applicationIds = Array.from(new Set(auditRows.map((row) => row.application_id).filter((id): id is string => Boolean(id))));
  const locationIds = Array.from(new Set(auditRows.map((row) => row.location_id).filter((id): id is string => Boolean(id))));

  const [usersResult, applicationsResult, locationsResult] = await Promise.all([
    actorIds.length
      ? supabase.from('users').select('id,name,email').in('id', actorIds)
      : Promise.resolve({ data: [] as UserRow[], error: null }),
    applicationIds.length
      ? supabase.from('platform_applications').select('id,name').in('id', applicationIds)
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
    locationIds.length
      ? supabase.from('platform_locations').select('id,name').in('id', locationIds)
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
  ]);

  if (usersResult.error) throw new Error(usersResult.error.message);
  if (applicationsResult.error) throw new Error(applicationsResult.error.message);
  if (locationsResult.error) throw new Error(locationsResult.error.message);

  const users = new Map(((usersResult.data ?? []) as UserRow[]).map((row) => [row.id, row]));
  const applications = new Map(((applicationsResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const locations = new Map(((locationsResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));

  return (
    <main className="container section-stack">
      <section className="page-intro">
        <span className="eyebrow">Platform governance</span>
        <h1>Admin audit log</h1>
        <p>Review the latest protected Super Admin and delegated Admin changes recorded by Supabase.</p>
        <p><Link href="/super-admin">← Super Admin</Link></p>
      </section>

      <section className="card">
        <div className="detail-list">
          <div><strong>{auditRows.length}</strong><span> recent events</span></div>
          <div><strong>Supabase persisted</strong><span> · newest first</span></div>
        </div>
      </section>

      {auditRows.length ? (
        <section className="section-stack" aria-label="Recent admin audit events">
          {auditRows.map((row) => {
            const actor = row.actor_user_id ? users.get(row.actor_user_id) : undefined;
            return (
              <article className="card" key={row.id}>
                <span className="eyebrow">{titleCase(row.resource_type)}</span>
                <h2>{titleCase(row.action)}</h2>
                <p>{metadataSummary(row)}</p>
                <div className="detail-list">
                  <div><strong>Actor</strong><span>{actor?.name || actor?.email || 'System'}</span></div>
                  <div><strong>When</strong><span>{formatTime(row.created_at)} IST</span></div>
                  {row.application_id ? <div><strong>Application</strong><span>{applications.get(row.application_id) ?? 'Assigned application'}</span></div> : null}
                  {row.location_id ? <div><strong>Location</strong><span>{locations.get(row.location_id) ?? 'Assigned location'}</span></div> : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="card">
          <h2>No audit events yet</h2>
          <p>Protected admin changes will appear here automatically.</p>
        </section>
      )}
    </main>
  );
}
