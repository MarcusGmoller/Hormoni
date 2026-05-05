-- Tidligere Pro-kunder på Free skal ikke have "én gratis konsultation" (intro på free).
-- has_ever_subscribed_pro sættes true når subscription_tier bliver betalende plan, og nulstilles ikke ved nedgradering.

alter table public.profiles
  add column if not exists has_ever_subscribed_pro boolean not null default false;

comment on column public.profiles.has_ever_subscribed_pro is
  'True når brugeren mindst én gang har haft betalende plan (pro/plus/premium). Free-intro-booking gælder ikke.';

-- Eksisterende betalende profiler
update public.profiles
set has_ever_subscribed_pro = true
where coalesce(subscription_tier, '') in ('pro', 'plus', 'premium');

create or replace function public.profiles_mark_ever_pro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.subscription_tier, '') in ('pro', 'plus', 'premium') then
    new.has_ever_subscribed_pro := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_mark_ever_pro_trigger on public.profiles;

create trigger profiles_mark_ever_pro_trigger
before insert or update on public.profiles
for each row
execute function public.profiles_mark_ever_pro();

create or replace function public.enforce_free_plan_appointment_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tier text;
  ever_pro boolean;
  existing int;
begin
  select
    coalesce(p.subscription_tier, 'free'),
    coalesce(p.has_ever_subscribed_pro, false)
  into tier, ever_pro
  from public.profiles p
  where p.id = new.user_id
  for share;

  if tier is null then
    tier := 'free';
  end if;

  if tier = 'starter' then
    tier := 'free';
  elsif tier in ('plus', 'premium') then
    tier := 'pro';
  end if;

  if tier = 'free' and ever_pro then
    raise exception
      'Som tidligere betalende kunde har du ikke adgang til gratis konsultation på Free. Opgrader til Pro for at booke nye tider.';
  end if;

  if tier = 'free' then
    select count(*)::int
    into existing
    from public.appointments a
    where a.user_id = new.user_id
      and a.status in ('requested', 'confirmed');

    if existing >= 1 then
      raise exception
        'Med gratis abonnement kan du kun booke én konsultation ad gangen. Opgrader til Pro eller aflys din nuværende tid først.';
    end if;
  end if;

  return new;
end;
$$;
