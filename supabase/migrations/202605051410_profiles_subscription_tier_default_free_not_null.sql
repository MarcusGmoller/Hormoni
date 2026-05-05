update public.profiles
set subscription_tier = 'free'
where subscription_tier is null;

alter table public.profiles
  alter column subscription_tier set default 'free';

alter table public.profiles
  alter column subscription_tier set not null;
