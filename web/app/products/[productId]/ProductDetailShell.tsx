'use client';

import Link from 'next/link';
import { usePublicProviderTranslations } from '../../../components/i18n/PublicProviderTranslations';
import ProductShareAction from '../../../components/detail/ProductShareAction';
import SavedProductAction from '../../../components/detail/SavedProductAction';
import styles from './ProductDetailPage.module.css';

export default function ProductDetailShell({
  productId,
  productName,
  businessId,
  businessName,
  businessLocation,
  description,
  storefrontHref,
}: {
  productId: string;
  productName: string;
  businessId: string;
  businessName: string | null;
  businessLocation: string | null;
  description: string | null;
  storefrontHref: string;
}) {
  const { t } = usePublicProviderTranslations();
  const displayBusinessName = businessName || t('publicProvider.profile.verifiedBusiness');
  const descriptionCopy = description || t('publicProvider.productDetail.descriptionFallback').replace('{businessName}', displayBusinessName);

  return <>
    <div className={`container ${styles.topBar}`}>
      <Link href="/products" className="button button-quiet">← {t('publicProvider.productDetail.browseProducts')}</Link>
      <div className={styles.actionCluster}>
        <SavedProductAction productId={productId} />
        <ProductShareAction productId={productId} productName={productName} businessName={displayBusinessName} />
      </div>
    </div>
    <section className={`container page-intro ${styles.intro}`}>
      <span className="eyebrow">{t('publicProvider.productDetail.eyebrow')}</span>
      <h1>{productName}</h1>
      <p className={styles.description}>{descriptionCopy}</p>
      <p className={styles.sellerLine}>
        <span>{t('publicProvider.productDetail.soldBy')}</span>
        <Link href={`/businesses/${encodeURIComponent(businessId)}`}>{displayBusinessName}</Link>
        {businessLocation ? <>
          <span className={styles.separator} aria-hidden="true">·</span>
          <span>{businessLocation}</span>
        </> : null}
      </p>
      <div className={styles.ctaRow}>
        <Link href={storefrontHref} className="button button-secondary">{t('publicProvider.productDetail.viewStorefront')}</Link>
        <Link href="/products" className="button button-quiet">{t('publicProvider.productDetail.backMarketplace')}</Link>
      </div>
    </section>
  </>;
}
