alter table public.profiles
  add column if not exists cpr_number text,
  add column if not exists symptoms text[] not null default '{}',
  add column if not exists health_conditions text[] not null default '{}',
  add column if not exists medications text,
  add column if not exists additional_notes text,
  add column if not exists profile_completed boolean not null default false;
