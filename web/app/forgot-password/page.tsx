import type { Metadata } from 'next';
import { ForgotPasswordForm } from '../../components/auth/AuthForms';

export const metadata: Metadata = {
  title: 'Forgot password | TakeItEsee',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
