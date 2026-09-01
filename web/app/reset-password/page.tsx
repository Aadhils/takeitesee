import type { Metadata } from 'next';
import { ResetPasswordForm } from '../../components/auth/AuthForms';

export const metadata: Metadata = {
  title: 'Reset password | TakeItEsee',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
