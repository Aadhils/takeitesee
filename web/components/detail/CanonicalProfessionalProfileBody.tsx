import type { ReactNode } from 'react';
import styles from './CanonicalProfessionalProfileBody.module.css';

export default function CanonicalProfessionalProfileBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
