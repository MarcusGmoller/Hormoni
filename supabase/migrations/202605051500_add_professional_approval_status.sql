alter table public.professionals
  add column if not exists approval_status text not null default 'pending';

alter table public.professionals
  add column if not exists approved_at timestamptz;

alter table public.professionals
  drop constraint if exists professionals_approval_status_check;

alter table public.professionals
  add constraint professionals_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));
