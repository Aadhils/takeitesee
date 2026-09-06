import PublicProviderIdentityLayout from '../../../components/detail/PublicProviderIdentityLayout';

export default async function BusinessPublicIdentityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  return <PublicProviderIdentityLayout kind="business" providerId={providerId}>{children}</PublicProviderIdentityLayout>;
}
