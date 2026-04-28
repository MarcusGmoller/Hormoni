create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_recipient_id_idx on public.messages (recipient_id);
create index if not exists messages_appointment_id_idx on public.messages (appointment_id);
create index if not exists messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

create policy "Users can view own messages"
on public.messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send own messages"
on public.messages
for insert
to authenticated
with check (auth.uid() = sender_id);

create policy "Users can mark own received messages as read"
on public.messages
for update
to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);
