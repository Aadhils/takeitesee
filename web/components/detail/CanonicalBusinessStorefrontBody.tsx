import type { ReactNode } from 'react';
import styles from './CanonicalBusinessStorefrontBody.module.css';

export default function CanonicalBusinessStorefrontBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
