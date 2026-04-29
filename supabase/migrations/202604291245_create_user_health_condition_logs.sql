create table if not exists public.user_health_condition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  health_conditions text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.user_health_condition_logs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_health_condition_logs'
      and policyname = 'users_select_own_health_logs'
  ) then
    create policy users_select_own_health_logs
      on public.user_health_condition_logs
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_health_condition_logs'
      and policyname = 'users_insert_own_health_logs'
  ) then
    create policy users_insert_own_health_logs
      on public.user_health_condition_logs
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
