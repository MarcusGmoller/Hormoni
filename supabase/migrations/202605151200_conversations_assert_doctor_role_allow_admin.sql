-- conversations: kliniske tråde har doctor_id = professional; administration (kind = admin) har doctor_id = admin.
-- Eksisterende assert_doctor_role() blokerede admin-support.

create or replace function public.assert_doctor_role()
returns trigger
language plpgsql
as $$
declare
  v_role public.user_role;
begin
  select role into v_role
  from public.profiles
  where id = new.doctor_id;

  if coalesce(new.kind, 'clinical'::text) = 'admin' then
    if v_role is distinct from 'admin'::public.user_role then
      raise exception 'For administrationssamtaler skal doctor_id være en profil med role=admin';
    end if;
  else
    if v_role is distinct from 'professional'::public.user_role then
      raise exception 'doctor_id must reference a profile with role=professional';
    end if;
  end if;

  return new;
end;
$$;
