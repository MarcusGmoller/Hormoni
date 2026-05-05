-- Gør det muligt at have række i public.professionals selvom profiles.role stadig er 'user'
-- (klienten må ikke opgradere rolle når DB kun tillader admin at ændre role).
-- Idempotent: sikrer at et projekt der aldrig fik 202605051510 stadig virker.

drop trigger if exists trg_professionals_profile_role on public.professionals;
drop trigger if exists trg_professional_requires_role on public.professionals;
drop function if exists public.professionals_enforce_profile_role();
drop function if exists public.professional_requires_role();
