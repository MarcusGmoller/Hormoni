-- Bruges i RLS-politikker (profiles, professionals, appointments, ...).
-- SECURITY DEFINER + row_security off: undgår rekursion når policies på profiles kalder is_admin().
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
  );
$$;

grant execute on function public.is_admin() to authenticated;
