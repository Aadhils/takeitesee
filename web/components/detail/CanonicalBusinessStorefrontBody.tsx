import type { ReactNode } from 'react';
import PublicProfileJumpNav from './PublicProfileJumpNav';
import styles from './CanonicalBusinessStorefrontBody.module.css';

export default function CanonicalBusinessStorefrontBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>
    <PublicProfileJumpNav kind="business" />
    {children}
  </div>;
}
