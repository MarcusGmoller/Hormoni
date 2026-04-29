alter table public.appointments
  add column if not exists google_meet_url text,
  add column if not exists meet_open_at timestamptz;
