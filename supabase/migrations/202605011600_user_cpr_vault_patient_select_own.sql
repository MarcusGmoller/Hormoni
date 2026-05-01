-- user_cpr_vault: Tillad den loggede bruger at SELECT egen række.
--
-- Baggrund:
-- - INSERT/UPDATE-politikkerne (cpr_patient_write_own / cpr_patient_update_own) er fine:
--   WITH CHECK / USING: (user_id = auth.uid()) OR is_admin().
-- - Politikken "cpr_no_client_select" har USING (false) og er PERMISSIVE, så den giver aldrig
--   adgang (kun støj). Patienter har ellers ingen SELECT, der matcher egen user_id.
-- - Når PostgREST/Supabase returnerer den indsatte/opdaterede række (return=representation),
--   anvendes SELECT-RLS på resultatet. Uden en SELECT-politik for egen række kan det give
--   RLS-relaterede fejl i klienten, selvom selve skrivningen er ment til at være tilladt.
--
-- Sikkerhed: Brugeren kan kun læse sin egen vault-række som authenticated; samme CPR sendes
-- allerede fra klienten ved onboarding.

begin;

drop policy if exists "cpr_no_client_select" on public.user_cpr_vault;

create policy "cpr_patient_select_own"
  on public.user_cpr_vault
  for select
  to authenticated
  using (user_id = auth.uid());

commit;
