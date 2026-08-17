import { LoginForm } from '../../components/auth/AuthForms';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  return <LoginForm returnTo={params.returnTo ?? null} />;
}
