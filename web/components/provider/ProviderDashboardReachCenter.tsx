'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  const { t } = useIdentityWorkspaceTranslations();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/services', { cache: 'no-store' });
      const body = await response.json() as { services?: Service[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.reach.loadServicesFallback'));
      setServices(body.services ?? []);
    } catch (cause) {
      setServices([]);
      setError(cause instanceof Error ? cause.message : t('provider.reach.loadFallback'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [t]);

  const visibleServices = services.slice(0, MAX_DASHBOARD_SERVICES);

  return <section id="provider-service-reach" className={styles.center} aria-label={t('provider.reach.controlsLabel')}>
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t('provider.reach.eyebrow')}</span>
          <h2>{t('provider.reach.title')}</h2>
          <p>{t('provider.reach.intro')}</p>
        </div>
        <Link href="/provider/services" className={styles.secondaryLink}>{t('provider.reach.manage')}</Link>
      </div>

      {loading ? <p className={styles.status}>{t('provider.reach.loading')}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{t('provider.reach.retry')}</button></p> : null}
      {!loading && !services.length ? <p className={styles.empty}>{t('provider.reach.empty')}</p> : null}

      {visibleServices.length ? <div className={styles.serviceGrid}>
        {visibleServices.map((service) => <article className={styles.serviceCard} key={service.id}>
          <div className={styles.serviceHead}>
            <div><small>{service.status === 'active' ? t('provider.identity.active') : service.status === 'paused' ? t('provider.identity.paused') : t('provider.reach.draft')}</small><h3>{service.name}</h3></div>
          </div>
          <ProviderServiceReachControl serviceId={service.id} serviceName={service.name} />
        </article>)}
      </div> : null}

      {services.length > MAX_DASHBOARD_SERVICES ? <Link href="/provider/services" className={styles.moreLink}>{t('provider.reach.more')} →</Link> : null}
    </Card>
  </section>;
}
