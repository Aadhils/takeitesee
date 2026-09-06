import type { Metadata } from 'next';
import { PasswordRecoveryBoundary } from '../../components/auth/PasswordRecoveryBoundary';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <PasswordRecoveryBoundary />;
}
