import Link from 'next/link';
import { requireAdminAccess } from '../../../lib/admin/access';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createLocation, setApplicationLocation } from './actions';

export default async function LocationsPage(){
  await requireAdminAccess({superAdminOnly:true});
  const supabase=await createSupabaseServerClient();
  const [{data:locations,error:locationError},{data:applications,error:appError},{data:assignments,error:assignmentError}]=await Promise.all([
    supabase.from('platform_locations').select('id,parent_id,type,code,name,country_code,timezone,active').order('type').order('name'),
    supabase.from('platform_applications').select('id,code,name,status').neq('status','retired').order('name'),
    supabase.from('application_locations').select('application_id,location_id,enabled')
  ]);
  if(locationError||appError||assignmentError) throw new Error(locationError?.message||appError?.message||assignmentError?.message);
  const enabled=new Map((assignments??[]).map(x=>[`${x.application_id}:${x.location_id}`,x.enabled]));
  return <main className="container section-stack">
    <section className="page-intro"><span className="eyebrow">SaaS control plane</span><h1>Locations & markets</h1><p>Build the country → state → city → zone hierarchy, then decide exactly where each approved application is available.</p><Link href="/super-admin">← Super Admin</Link></section>
    <section className="card"><h2>Add location</h2><form action={createLocation} className="section-stack">
      <label>Name<input name="name" required placeholder="Chennai"/></label><label>Code<input name="code" required placeholder="chennai"/></label>
      <label>Type<select name="type" required><option value="country">Country</option><option value="state">State</option><option value="city">City</option><option value="zone">Zone</option></select></label>
      <label>Parent<select name="parent_id"><option value="">None / root</option>{locations?.map(l=><option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}</select></label>
      <label>Country code<input name="country_code" maxLength={2} placeholder="IN"/></label><label>Timezone<input name="timezone" placeholder="Asia/Kolkata"/></label><button type="submit">Add location</button>
    </form></section>
    <section className="section-stack"><h2>Location registry</h2>{locations?.length?locations.map(l=><article className="card" key={l.id}><span className="eyebrow">{l.type} · {l.code}</span><h3>{l.name}</h3><p>{l.country_code||'—'} · {l.timezone||'Timezone not set'} · {l.active?'Active':'Inactive'}</p></article>):<div className="card"><p>No locations registered yet.</p></div>}</section>
    <section className="section-stack"><h2>Application availability by market</h2>{applications?.length&&locations?.length?applications.map(app=><article className="card" key={app.id}><span className="eyebrow">{app.status}</span><h3>{app.name}</h3><div className="section-stack">{locations.map(location=>{const isEnabled=enabled.get(`${app.id}:${location.id}`)===true;return <form action={setApplicationLocation} key={location.id}><input type="hidden" name="application_id" value={app.id}/><input type="hidden" name="location_id" value={location.id}/><input type="hidden" name="enabled" value={String(!isEnabled)}/><span>{location.name} ({location.type}) — {isEnabled?'Enabled':'Disabled'} </span><button type="submit">{isEnabled?'Disable':'Enable'}</button></form>})}</div></article>):<div className="card"><p>Create at least one application and one location to configure market availability.</p></div>}</section>
  </main>;
}
