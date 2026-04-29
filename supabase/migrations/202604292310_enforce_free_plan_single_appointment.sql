-- Free plan: at most one appointment with status requested or confirmed per user.

create or replace function public.enforce_free_plan_appointment_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tier text;
  existing int;
begin
  select coalesce(p.subscription_tier, 'free')
  into tier
  from public.profiles p
  where p.id = new.user_id
  for share;

  if tier is null then
    tier := 'free';
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

drop trigger if exists appointments_enforce_free_plan_limit on public.appointments;

create trigger appointments_enforce_free_plan_limit
before insert on public.appointments
for each row
execute function public.enforce_free_plan_appointment_limit();
