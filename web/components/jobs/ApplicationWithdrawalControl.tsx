'use client';

import { useState } from 'react';
import styles from './JobMarketplace.module.css';

type ApplicationWithdrawalControlProps = {
  applicationId: string;
  saving: boolean;
  tamil: boolean;
  onConfirm: (applicationId: string) => void;
};

export function ApplicationWithdrawalControl({ applicationId, saving, tamil, onConfirm }: ApplicationWithdrawalControlProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        className={`${styles.button} ${styles.danger}`}
        disabled={saving}
        type="button"
        onClick={() => setConfirming(true)}
      >
        {tamil ? 'விண்ணப்பத்தை திரும்பப் பெற' : 'Withdraw'}
      </button>
    );
  }

  return (
    <>
      <span className={styles.muted}>
        {tamil
          ? 'இந்த விண்ணப்பத்தை திரும்பப் பெற்றால் அது முடிவுற்றதாகும்; செயலில் உள்ள interview-களும் ரத்து செய்யப்படும்.'
          : 'Withdrawing ends this application. Any active interview will also be cancelled.'}
      </span>
      <button
        className={`${styles.button} ${styles.secondary}`}
        disabled={saving}
        type="button"
        onClick={() => setConfirming(false)}
      >
        {tamil ? 'விண்ணப்பத்தை வைத்திரு' : 'Keep application'}
      </button>
      <button
        className={`${styles.button} ${styles.danger}`}
        disabled={saving}
        type="button"
        onClick={() => onConfirm(applicationId)}
      >
        {saving ? (tamil ? 'திரும்பப் பெறுகிறது…' : 'Withdrawing…') : (tamil ? 'திரும்பப் பெற உறுதி செய்' : 'Confirm withdrawal')}
      </button>
    </>
  );
}
