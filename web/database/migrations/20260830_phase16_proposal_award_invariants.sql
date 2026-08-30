-- Enforce accepted-proposal/requirement consistency at the database boundary.
alter table public.customer_requirements drop constraint if exists customer_requirements_award_state_check;
alter table public.customer_requirements
  add constraint customer_requirements_award_state_check
  check (
    (status in ('open','paused') and accepted_proposal_id is null and awarded_at is null)
    or (status='awarded' and accepted_proposal_id is not null and awarded_at is not null)
    or (status in ('fulfilled','cancelled'))
  );

create or replace function public.guard_requirement_award_link()
returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.accepted_proposal_id is not null then
    if not exists(
      select 1 from public.requirement_proposals p
      where p.id=new.accepted_proposal_id
        and p.requirement_id=new.id
        and p.status='accepted'
    ) then
      raise exception 'Accepted proposal must belong to this requirement and be accepted.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_requirement_award_link() from public,anon,authenticated;

drop trigger if exists customer_requirements_guard_award_link on public.customer_requirements;
create trigger customer_requirements_guard_award_link
before insert or update of accepted_proposal_id,status,awarded_at on public.customer_requirements
for each row execute function public.guard_requirement_award_link();
