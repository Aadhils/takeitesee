import PublicProviderIdentityLayout from '../../../components/detail/PublicProviderIdentityLayout';

export default async function ProfessionalPublicIdentityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  return <PublicProviderIdentityLayout kind="professional" providerId={providerId}>{children}</PublicProviderIdentityLayout>;
}
