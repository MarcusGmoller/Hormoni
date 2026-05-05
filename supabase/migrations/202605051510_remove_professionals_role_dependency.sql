drop trigger if exists trg_professionals_profile_role on public.professionals;
drop trigger if exists trg_professional_requires_role on public.professionals;

drop function if exists public.professionals_enforce_profile_role();
drop function if exists public.professional_requires_role();
