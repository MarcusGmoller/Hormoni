do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_conversation_counterpart'
  ) then
    create policy profiles_select_conversation_counterpart
      on public.profiles
      for select
      using (
        (id = auth.uid())
        or is_admin()
        or exists (
          select 1
          from public.conversations c
          where (c.patient_id = auth.uid() and c.doctor_id = profiles.id)
             or (c.doctor_id = auth.uid() and c.patient_id = profiles.id)
        )
      );
  end if;
end $$;
