import Link from 'next/link';
import { LocaleText } from '../../../components/i18n/LocaleText';
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

  return <main className="container section-stack">
    <section className="page-intro"><span className="eyebrow"><LocaleText en="SaaS control plane" ta="SaaS கட்டுப்பாட்டு மையம்" /></span><h1><LocaleText en="Locations & markets" ta="இடங்கள் & சந்தைகள்" /></h1><p><LocaleText en="Build the country → state → city → zone hierarchy, then control where each approved application is available." ta="Country → state → city → zone hierarchy உருவாக்கி, ஒவ்வொரு approved application எந்த market-ல் கிடைக்க வேண்டும் என்பதை கட்டுப்படுத்தவும்." /></p><Link href="/super-admin">← Super Admin</Link></section>
    <section className="card"><h2><LocaleText en="Add location" ta="இடம் சேர்க்க" /></h2><form action={createLocation} className="section-stack">
      <label><LocaleText en="Name" ta="பெயர்" /><input name="name" required placeholder="Chennai" /></label>
      <label><LocaleText en="Code" ta="குறியீடு" /><input name="code" required pattern="[a-z0-9][a-z0-9_-]{1,62}" placeholder="chennai" /></label>
      <label><LocaleText en="Type" ta="வகை" /><select name="type" required><option value="country">Country</option><option value="state">State</option><option value="city">City</option><option value="zone">Zone</option></select></label>
      <label><LocaleText en="Parent" ta="மேல் இடம்" /><select name="parent_id"><option value="">None / root</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.type})</option>)}</select></label>
      <label><LocaleText en="Country code" ta="நாட்டு குறியீடு" /><input name="country_code" maxLength={2} placeholder="IN" /></label>
      <label><LocaleText en="Timezone" ta="நேர மண்டலம்" /><input name="timezone" placeholder="Asia/Kolkata" /></label>
      <button type="submit"><LocaleText en="Add location" ta="இடம் சேர்க்க" /></button>
    </form></section>
    <section className="section-stack"><h2><LocaleText en="Location registry" ta="இட பதிவகம்" /></h2>{locations.length ? locations.map((location) => <article className="card" key={location.id}><span className="eyebrow">{location.type} · {location.code}</span><h3>{location.name}</h3><p>{location.country_code || '—'} · {location.timezone || <LocaleText en="Timezone not set" ta="Timezone அமைக்கப்படவில்லை" />} · <LocaleText en={location.active ? 'Active' : 'Inactive'} ta={location.active ? 'செயலில்' : 'செயலற்றது'} /></p></article>) : <div className="card"><p><LocaleText en="No locations registered yet." ta="இன்னும் locations பதிவு செய்யப்படவில்லை." /></p></div>}</section>
    <section className="section-stack"><h2><LocaleText en="Application availability by market" ta="Market அடிப்படையிலான application availability" /></h2>{applications.length && locations.length ? applications.map((application) => <article className="card" key={application.id}><span className="eyebrow">{application.status}</span><h3>{application.name}</h3><div className="section-stack">{locations.map((location) => { const isEnabled = enabled.get(`${application.id}:${location.id}`) === true; return <form action={setApplicationLocation} key={location.id}><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="location_id" value={location.id} /><input type="hidden" name="enabled" value={String(!isEnabled)} /><span>{location.name} ({location.type}) — <LocaleText en={isEnabled ? 'Enabled' : 'Disabled'} ta={isEnabled ? 'இயக்கப்பட்டது' : 'முடக்கப்பட்டது'} /> </span><button type="submit"><LocaleText en={isEnabled ? 'Disable' : 'Enable'} ta={isEnabled ? 'முடக்கு' : 'இயக்கு'} /></button></form>; })}</div></article>) : <div className="card"><p><LocaleText en="Create at least one application and one location to configure market availability." ta="Market availability அமைக்க குறைந்தது ஒரு application மற்றும் ஒரு location உருவாக்கவும்." /></p></div>}</section>
  </main>;
}
