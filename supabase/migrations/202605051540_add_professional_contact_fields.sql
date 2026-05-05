alter table public.professionals
  add column if not exists professional_email text;

alter table public.professionals
  add column if not exists professional_phone text;
