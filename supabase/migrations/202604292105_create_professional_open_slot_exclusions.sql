create table if not exists public.professional_open_slot_exclusions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (professional_id, slot_date, start_time, end_time)
);

alter table public.professional_open_slot_exclusions enable row level security;

drop policy if exists "professionals_select_own_open_slot_exclusions" on public.professional_open_slot_exclusions;
create policy "professionals_select_own_open_slot_exclusions"
on public.professional_open_slot_exclusions
for select
to authenticated
using (professional_id = auth.uid());

drop policy if exists "professionals_insert_own_open_slot_exclusions" on public.professional_open_slot_exclusions;
create policy "professionals_insert_own_open_slot_exclusions"
on public.professional_open_slot_exclusions
for insert
to authenticated
with check (professional_id = auth.uid());

drop policy if exists "professionals_delete_own_open_slot_exclusions" on public.professional_open_slot_exclusions;
create policy "professionals_delete_own_open_slot_exclusions"
on public.professional_open_slot_exclusions
for delete
to authenticated
using (professional_id = auth.uid());
