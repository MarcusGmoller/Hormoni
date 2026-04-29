do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='profiles_select_public_professionals'
  ) then
    create policy profiles_select_public_professionals
      on public.profiles
      for select
      using (
        exists (
          select 1
          from public.professionals pr
          where pr.user_id = profiles.id
            and pr.public_profile = true
        )
      );
  end if;
end $$;
