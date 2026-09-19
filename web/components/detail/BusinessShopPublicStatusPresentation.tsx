'use client';

import { Badge, Card } from '../ui/primitives';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
import styles from './BusinessShopPublicStatusPresentation.module.css';

type BusinessShopState = 'open' | 'closed';

export default function BusinessShopPublicStatusPresentation({ shopState }: { shopState: BusinessShopState }) {
  const { t } = usePublicProviderTranslations();
  const open = shopState === 'open';

  return <div className={`container ${styles.shell}`}>
    <Card className={styles.statusCard}>
      <div className={styles.copy}>
        <span className="eyebrow">{t('publicProvider.businessShopStatus.storefront')}</span>
        <strong className={styles.title}>{open
          ? t('publicProvider.businessShopStatus.openTitle')
          : t('publicProvider.businessShopStatus.closedTitle')}</strong>
        <p className={`summary-note ${styles.note}`}>{t('publicProvider.businessShopStatus.note')}</p>
      </div>
      <Badge tone={open ? 'success' : 'neutral'}>{open
        ? t('publicProvider.businessShopStatus.openBadge')
        : t('publicProvider.businessShopStatus.closedBadge')}</Badge>
    </Card>
  </div>;
}
