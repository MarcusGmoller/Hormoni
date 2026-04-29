-- Align profiles.subscription_tier with public.plans(id).

create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name)
values
  ('free', 'Free'),
  ('pro', 'Pro')
on conflict (id) do nothing;

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

update public.profiles
set subscription_tier = 'free'
where subscription_tier = 'starter';

update public.profiles
set subscription_tier = 'pro'
where subscription_tier in ('plus', 'premium');

update public.profiles p
set subscription_tier = 'free'
where not exists (
  select 1 from public.plans pl where pl.id = p.subscription_tier
);

alter table public.profiles
  alter column subscription_tier set default 'free';

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_fkey;

alter table public.profiles
  add constraint profiles_subscription_tier_fkey
  foreign key (subscription_tier)
  references public.plans (id)
  on update cascade
  on delete restrict;

drop policy if exists plans_select_authenticated on public.plans;

create policy plans_select_authenticated
on public.plans
for select
to authenticated
using (true);
