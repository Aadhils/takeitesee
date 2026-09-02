drop policy if exists "customers read own platform support requests" on public.platform_support_requests;
drop policy if exists "customers submit own platform support requests" on public.platform_support_requests;

create policy "customers read own platform support requests"
  on public.platform_support_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_super_admin());

create policy "customers submit own platform support requests"
  on public.platform_support_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
