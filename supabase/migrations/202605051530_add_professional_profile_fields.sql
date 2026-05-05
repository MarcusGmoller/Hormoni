alter table public.professionals
  add column if not exists professional_name text;

alter table public.professionals
  add column if not exists payment_information text;
