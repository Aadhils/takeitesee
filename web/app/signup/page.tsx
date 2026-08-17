import { SignupForm } from '../../components/auth/AuthForms';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  return <SignupForm returnTo={params.returnTo ?? null} />;
}