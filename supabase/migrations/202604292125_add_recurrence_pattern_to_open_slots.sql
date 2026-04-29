alter table public.professional_open_slots
add column if not exists recurrence_pattern text;

create index if not exists professional_open_slots_recurrence_pattern_idx
on public.professional_open_slots (professional_id, recurrence_pattern);
