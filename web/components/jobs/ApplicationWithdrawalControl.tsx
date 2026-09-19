'use client';

import { useState } from 'react';
import { useProviderJobMarketplaceTranslations } from '../i18n/ProviderJobMarketplaceTranslations';
import styles from './JobMarketplace.module.css';

type ApplicationWithdrawalControlProps = {
  applicationId: string;
  saving: boolean;
  onConfirm: (applicationId: string) => void;
};

export function ApplicationWithdrawalControl({ applicationId, saving, onConfirm }: ApplicationWithdrawalControlProps) {
  const { t } = useProviderJobMarketplaceTranslations();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        className={`${styles.button} ${styles.danger}`}
        disabled={saving}
        type="button"
        onClick={() => setConfirming(true)}
      >
        {t('providerJobMarketplace.withdraw.open')}
      </button>
    );
  }

  return (
    <>
      <span className={styles.muted}>
        {t('providerJobMarketplace.withdraw.warning')}
      </span>
      <button
        className={`${styles.button} ${styles.secondary}`}
        disabled={saving}
        type="button"
        onClick={() => setConfirming(false)}
      >
        {t('providerJobMarketplace.withdraw.keep')}
      </button>
      <button
        className={`${styles.button} ${styles.danger}`}
        disabled={saving}
        type="button"
        onClick={() => onConfirm(applicationId)}
      >
        {saving ? t('providerJobMarketplace.withdraw.progress') : t('providerJobMarketplace.withdraw.confirm')}
      </button>
    </>
  );
}
