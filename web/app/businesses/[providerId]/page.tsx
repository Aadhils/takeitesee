import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Badge, Card } from '../../../components/ui/primitives';
import { Breadcrumbs } from '../../../components/layout/NavigationContext';

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) notFound();

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: business, error } = await supabase
    .from('businesses')
    .select('id,name,description,location,verified')
    .eq('id', providerId)
    .eq('verified', true)
    .maybeSingle();
  if (error || !business) notFound();

  const { data: services } = await supabase
    .from('services')
    .select('id,name,description,base_price,currency,duration_minutes,location')
    .eq('business_id', providerId)
    .eq('provider_type', 'business')
    .eq('status', 'active')
    .eq('active', true)
    .order('name');

  const initials = business.name.split(' ').map((part: string) => part[0]).join('').slice(0, 2);

  return <div className="profile-page">
    <Breadcrumbs items={[{ label: 'Explore', href: '/explore' }, { label: 'Business' }]} />
    <section className="profile-hero"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{initials}</div><div><div className="detail-badges"><Badge tone="success">Verified profile</Badge><Badge tone="info">Business provider</Badge></div><h1>{business.name}</h1><p className="profile-headline">{business.description || 'Verified business on takeitesee'}</p><p className="card-location">{business.location || 'Service area confirmed during booking'}</p></div></section>
    <div className="profile-layout"><main>
      <section className="detail-section"><span className="eyebrow">Business profile</span><h2>About {business.name}</h2><p className="detail-copy">{business.description || 'This verified business publishes live services through takeitesee.'}</p></section>
      <section className="detail-section"><div className="section-heading"><div><span className="eyebrow">Available services</span><h2>Choose a service</h2></div><Badge tone="info">{services?.length ?? 0} listed</Badge></div><div className="profile-services">{services?.length ? services.map((service: any) => <Card className="profile-service" key={service.id}><div><h3>{service.name}</h3><p>{service.description || 'Service details are available on the listing page.'}</p><p>{service.duration_minutes ? `${service.duration_minutes} minutes · ` : ''}{money(Number(service.base_price || 0), service.currency || 'INR')}</p></div><Link href={`/services/${service.id}`} className="button button-primary">View service</Link></Card>) : <p className="empty-inline">No active services are currently published.</p>}</div></section>
    </main><aside className="profile-aside"><Card><span className="eyebrow">Live provider</span><h2>Verified business</h2><p>Only active, published services from this business are shown here.</p><Link href="/explore" className="button button-secondary">Explore services</Link></Card></aside></div>
  </div>;
}
