import Link from 'next/link';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createLocation, setApplicationLocation } from './actions';

export default async function LocationsPage() {
  const supabase = await createSupabaseServerClient();
  const [locationsResult, applicationsResult, assignmentsResult] = await Promise.all([
    supabase.from('platform_locations').select('id,parent_id,type,code,name,country_code,timezone,active').order('type').order('name'),
    supabase.from('platform_applications').select('id,code,name,status').neq('status', 'retired').order('name'),
    supabase.from('application_locations').select('application_id,location_id,enabled'),
  ]);

  if (locationsResult.error || applicationsResult.error || assignmentsResult.error) {
    throw new Error(locationsResult.error?.message || applicationsResult.error?.message || assignmentsResult.error?.message || 'Unable to load location registry.');
  }

  const locations = locationsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const enabled = new Map((assignmentsResult.data ?? []).map((row) => [`${row.application_id}:${row.location_id}`, row.enabled]));

  return (
    <main className="container section-stack">
      <section className="page-intro">
        <span className="eyebrow">SaaS control plane</span>
        <h1>Locations & markets</h1>
        <p>Build the country → state → city → zone hierarchy, then control where each approved application is available.</p>
        <Link href="/super-admin">← Super Admin</Link>
      </section>

      <section className="card">
        <h2>Add location</h2>
        <form action={createLocation} className="section-stack">
          <label>Name<input name="name" required placeholder="Chennai" /></label>
          <label>Code<input name="code" required pattern="[a-z0-9][a-z0-9_-]{1,62}" placeholder="chennai" /></label>
          <label>Type<select name="type" required><option value="country">Country</option><option value="state">State</option><option value="city">City</option><option value="zone">Zone</option></select></label>
          <label>Parent<select name="parent_id"><option value="">None / root</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.type})</option>)}</select></label>
          <label>Country code<input name="country_code" maxLength={2} placeholder="IN" /></label>
          <label>Timezone<input name="timezone" placeholder="Asia/Kolkata" /></label>
          <button type="submit">Add location</button>
        </form>
      </section>

      <section className="section-stack">
        <h2>Location registry</h2>
        {locations.length ? locations.map((location) => (
          <article className="card" key={location.id}>
            <span className="eyebrow">{location.type} · {location.code}</span>
            <h3>{location.name}</h3>
            <p>{location.country_code || '—'} · {location.timezone || 'Timezone not set'} · {location.active ? 'Active' : 'Inactive'}</p>
          </article>
        )) : <div className="card"><p>No locations registered yet.</p></div>}
      </section>

      <section className="section-stack">
        <h2>Application availability by market</h2>
        {applications.length && locations.length ? applications.map((application) => (
          <article className="card" key={application.id}>
            <span className="eyebrow">{application.status}</span>
            <h3>{application.name}</h3>
            <div className="section-stack">
              {locations.map((location) => {
                const isEnabled = enabled.get(`${application.id}:${location.id}`) === true;
                return (
                  <form action={setApplicationLocation} key={location.id}>
                    <input type="hidden" name="application_id" value={application.id} />
                    <input type="hidden" name="location_id" value={location.id} />
                    <input type="hidden" name="enabled" value={String(!isEnabled)} />
                    <span>{location.name} ({location.type}) — {isEnabled ? 'Enabled' : 'Disabled'} </span>
                    <button type="submit">{isEnabled ? 'Disable' : 'Enable'}</button>
                  </form>
                );
              })}
            </div>
          </article>
        )) : <div className="card"><p>Create at least one application and one location to configure market availability.</p></div>}
      </section>
    </main>
  );
}
