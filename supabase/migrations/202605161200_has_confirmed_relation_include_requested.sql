-- Tillad klinisk samtale når patient har booket (requested) eller bekræftet (confirmed) tid hos behandleren.
create or replace function public.has_confirmed_relation(p_patient uuid, p_doctor uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.appointments a
    where a.user_id = p_patient
      and a.professional_id = p_doctor
      and a.status in ('confirmed', 'requested')
  );
$$;
