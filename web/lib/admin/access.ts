import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../supabase/server';

export type AdminAccess = {
  authUserId: string;
  platformUserId: string;
  role: 'admin' | 'super_admin';
  isSuperAdmin: boolean;
};

export async function requireAdminAccess(options?: { superAdminOnly?: boolean }): Promise<AdminAccess> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect('/login?next=/super-admin');

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (userError || !user || !['admin', 'super_admin'].includes(user.role)) redirect('/');

  const isSuperAdmin = user.role === 'super_admin';
  if (options?.superAdminOnly && !isSuperAdmin) redirect('/');

  if (!isSuperAdmin) {
    const { data: membership, error: membershipError } = await supabase
      .from('admin_memberships')
      .select('id, active')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();
    if (membershipError || !membership) redirect('/');
  }

  return {
    authUserId: authData.user.id,
    platformUserId: user.id,
    role: user.role as 'admin' | 'super_admin',
    isSuperAdmin,
  };
}
