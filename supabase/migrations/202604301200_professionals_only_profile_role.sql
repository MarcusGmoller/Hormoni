-- Book-konsultation må kun vise rigtige gynækologer: fjern rækker hvor profilen ikke er professional.
-- Forhindrer fremover at non-professionals får række i public.professionals.

delete from public.professionals p
using public.profiles pr
where p.user_id = pr.id
  and pr.role is distinct from 'professional';

create or replace function public.professionals_enforce_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles pr
    where pr.id = new.user_id and pr.role = 'professional'
  ) then
    raise exception 'professionals.user_id must reference profiles.role = professional';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_professionals_profile_role on public.professionals;
create trigger trg_professionals_profile_role
  before insert or update on public.professionals
  for each row
  execute function public.professionals_enforce_profile_role();
