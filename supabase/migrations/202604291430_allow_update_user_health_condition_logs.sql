do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_health_condition_logs'
      and policyname = 'users_update_own_health_logs'
  ) then
    create policy users_update_own_health_logs
      on public.user_health_condition_logs
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
