alter table public.profiles
  alter column subscription_tier drop not null;

alter table public.profiles
  alter column subscription_tier drop default;
