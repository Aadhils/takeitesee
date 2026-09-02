import { LegalSignupForm } from '../../components/auth/LegalSignupForm';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  return <LegalSignupForm returnTo={params.returnTo ?? null} />;
}
