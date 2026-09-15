'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import ProviderServiceReachControl from './ProviderServiceReachControl';
import styles from './ProviderDashboardReachCenter.module.css';

type Service = {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
};

const MAX_DASHBOARD_SERVICES = 4;

export default function ProviderDashboardReachCenter() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const copy = useMemo(() => tamil ? {
    eyebrow: 'Service reach',
    title: 'Customer-ஐ service எப்படி reach செய்யும்?',
    intro: 'Shop / office-க்கு customer வருகிறாரா, நீங்கள் customer இடத்திற்கு செல்கிறீர்களா, அல்லது remote service-ஆ என்பதை இங்கிருந்தே அமைக்கலாம். Precise location settings collapsed ஆக இருக்கும்; தேவையான service-க்கு மட்டும் திறக்கவும்.',
    loading: 'Service reach load ஆகிறது…',
    empty: 'முதலில் ஒரு service create செய்யுங்கள். அதன் reach settings இங்கே வரும்.',
    manage: 'Advanced service manager',
    more: 'மேலும் services-ஐ advanced manager-ல் configure செய்யுங்கள்',
    retry: 'Retry',
  } : {
    eyebrow: 'Service reach',
    title: 'How does each service reach the customer?',
    intro: 'Set whether customers come to you, you travel to them, or the service is remote. Precise location controls stay collapsed until you open the service that needs them.',
    loading: 'Loading service reach…',
    empty: 'Create a service first. Its reach settings will appear here.',
    manage: 'Advanced service manager',
    more: 'Configure more services in the advanced manager',
    retry: 'Retry',
  }, [tamil]);

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/services', { cache: 'no-store' });
      const body = await response.json() as { services?: Service[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to load services.');
      setServices(body.services ?? []);
    } catch (cause) {
      setServices([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load service reach.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visibleServices = services.slice(0, MAX_DASHBOARD_SERVICES);

  return <section id="provider-service-reach" className={styles.center} aria-label="Provider service reach controls">
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <Link href="/provider/services" className={styles.secondaryLink}>{copy.manage}</Link>
      </div>

      {loading ? <p className={styles.status}>{copy.loading}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{copy.retry}</button></p> : null}
      {!loading && !services.length ? <p className={styles.empty}>{copy.empty}</p> : null}

      {visibleServices.length ? <div className={styles.serviceGrid}>
        {visibleServices.map((service) => <article className={styles.serviceCard} key={service.id}>
          <div className={styles.serviceHead}>
            <div><small>{service.status}</small><h3>{service.name}</h3></div>
          </div>
          <ProviderServiceReachControl serviceId={service.id} serviceName={service.name} />
        </article>)}
      </div> : null}

      {services.length > MAX_DASHBOARD_SERVICES ? <Link href="/provider/services" className={styles.moreLink}>{copy.more} →</Link> : null}
    </Card>
  </section>;
}
