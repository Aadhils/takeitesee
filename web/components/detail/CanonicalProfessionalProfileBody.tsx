import type { ReactNode } from 'react';
import PublicProfileJumpNav from './PublicProfileJumpNav';
import styles from './CanonicalProfessionalProfileBody.module.css';

export default function CanonicalProfessionalProfileBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>
    <PublicProfileJumpNav kind="professional" />
    {children}
  </div>;
}
