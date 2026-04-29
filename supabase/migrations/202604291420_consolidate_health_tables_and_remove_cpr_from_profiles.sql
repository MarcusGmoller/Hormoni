begin;

-- 1) Ensure target log table has needed columns
alter table if exists public.user_health_condition_logs
  add column if not exists health_conditions text[] not null default '{}',
  add column if not exists notes text,
  add column if not exists symptom_scores jsonb not null default '{}'::jsonb;

-- 2) Migrate from legacy health-intake schema into unified log table (if any rows exist)
insert into public.user_health_condition_logs (user_id, health_conditions, notes, symptom_scores, created_at)
select
  i.user_id,
  coalesce(array_agg(distinct co.label) filter (where co.label is not null), '{}') as health_conditions,
  nullif(trim(concat_ws(E'\n', i.medications, i.other_notes)), '') as notes,
  '{}'::jsonb as symptom_scores,
  coalesce(i.created_at, now()) as created_at
from public.user_health_intake i
left join public.user_conditions uc on uc.user_id = i.user_id
left join public.condition_options co on co.id = uc.condition_id
group by i.user_id, i.medications, i.other_notes, i.created_at
on conflict do nothing;

-- 3) Backfill from profiles into logs if profile has intake-like data and no similar log already
insert into public.user_health_condition_logs (user_id, health_conditions, notes, symptom_scores, created_at)
select
  p.id as user_id,
  coalesce(p.health_conditions, '{}') as health_conditions,
  nullif(trim(concat_ws(E'\n', p.medications, p.additional_notes)), '') as notes,
  '{}'::jsonb as symptom_scores,
  coalesce(p.profile_completed_at, p.created_at, now()) as created_at
from public.profiles p
where (
  coalesce(array_length(p.health_conditions, 1), 0) > 0
  or coalesce(nullif(trim(p.medications), ''), null) is not null
  or coalesce(nullif(trim(p.additional_notes), ''), null) is not null
)
and not exists (
  select 1
  from public.user_health_condition_logs l
  where l.user_id = p.id
);

-- 4) Keep CPR separate: remove raw CPR from profiles
alter table public.profiles
  drop column if exists cpr_number;

-- 5) Remove deprecated/unused split health tables (now consolidated)
drop table if exists public.user_symptoms cascade;
drop table if exists public.user_conditions cascade;
drop table if exists public.user_health_intake cascade;
drop table if exists public.symptom_options cascade;
drop table if exists public.condition_options cascade;

commit;
