create table if not exists public.anonymized_health_logs (
  id uuid primary key default gen_random_uuid(),
  anon_subject_id uuid not null,
  created_at timestamptz not null,
  symptom_scores jsonb not null,
  health_conditions text[] not null default '{}',
  notes text,
  deleted_at timestamptz not null default now()
);

create table if not exists public.anonymized_treatment_history (
  id uuid primary key default gen_random_uuid(),
  anon_subject_id uuid not null,
  record_type text not null check (record_type in ('appointment', 'prescription')),
  treatment_at timestamptz not null,
  payload jsonb not null,
  deleted_at timestamptz not null default now()
);
