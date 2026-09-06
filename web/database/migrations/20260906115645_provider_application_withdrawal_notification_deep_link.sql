create or replace function public.withdraw_provider_application(target_application_id uuid)
returns public.provider_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.provider_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  update public.provider_applications
  set status='withdrawn',updated_at=now()
  where id=target_application_id and applicant_user_id=auth.uid() and status='pending'
  returning * into app;

  if app.id is null then raise exception 'Pending provider application was not found.'; end if;

  insert into public.provider_application_events(application_id,actor_user_id,actor_type,event_type,note)
  values(app.id,auth.uid(),'applicant','withdrawn','Applicant withdrew the provider onboarding request.');

  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(auth.uid(),'provider_application_withdrawn','Provider application withdrawn','Your provider application has been withdrawn.','/provider/onboarding');

  return app;
end;
$$;
