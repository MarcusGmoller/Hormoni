alter table public.profiles
  add column if not exists gender text,
  add column if not exists payment_method text,
  add column if not exists payment_status text;
