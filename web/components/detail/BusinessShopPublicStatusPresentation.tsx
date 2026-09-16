'use client';

import { Badge, Card } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './BusinessShopPublicStatusPresentation.module.css';

type BusinessShopState = 'open' | 'closed';

export default function BusinessShopPublicStatusPresentation({ shopState }: { shopState: BusinessShopState }) {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const open = shopState === 'open';

  return <div className={`container ${styles.shell}`}>
    <Card className={styles.statusCard}>
      <div className={styles.copy}>
        <span className="eyebrow">{tamil ? 'Business storefront' : 'Business storefront'}</span>
        <strong className={styles.title}>{open
          ? (tamil ? 'இந்த Shop தற்போது Open' : 'This shop is currently open')
          : (tamil ? 'இந்த Shop தற்போது Closed' : 'This shop is currently closed')}</strong>
        <p className={`summary-note ${styles.note}`}>{tamil
          ? 'Shop Open/Closed என்பது Business storefront signal. Provider Available/Busy மற்றும் service booking schedule தனித்தனியாகவே செயல்படும்.'
          : 'Shop Open/Closed is a Business storefront signal. Provider Available/Busy and each service booking schedule remain separate.'}</p>
      </div>
      <Badge tone={open ? 'success' : 'neutral'}>{open ? 'Shop Open' : 'Shop Closed'}</Badge>
    </Card>
  </div>;
}
