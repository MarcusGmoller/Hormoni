alter table public.user_health_condition_logs
  add column if not exists symptom_scores jsonb not null default '{}'::jsonb;
