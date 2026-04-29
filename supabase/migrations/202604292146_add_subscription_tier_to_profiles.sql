alter table public.profiles
  add column if not exists subscription_tier text not null default 'starter';

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('starter', 'plus', 'premium'));
