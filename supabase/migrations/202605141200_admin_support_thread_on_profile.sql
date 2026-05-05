-- Admin-support: én tråd pr. ikke-admin-profil, oprettes automatisk ved profil-oprettelse.
-- Velkomstbesked fra administrationen (sender = admin).

-- conversations.kind
alter table public.conversations
  add column if not exists kind text not null default 'clinical';

alter table public.conversations
  drop constraint if exists conversations_kind_check;

alter table public.conversations
  add constraint conversations_kind_check check (kind in ('clinical', 'admin'));

create unique index if not exists conversations_one_admin_support_per_patient
  on public.conversations (patient_id)
  where kind = 'admin';

-- messages: conversation-baserede beskeder (hvis recipient_id stadig findes fra legacy)
alter table public.messages
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;

alter table public.messages
  alter column recipient_id drop not null;

-- Deltagere må læse egne samtaler
drop policy if exists conv_select_participants on public.conversations;

create policy conv_select_participants
  on public.conversations
  for select
  to authenticated
  using (
    auth.uid() = patient_id
    or auth.uid() = doctor_id
    or public.is_admin()
  );

-- Klient: bruger må oprette admin-tråd (fallback hvis trigger kørte før admin fandtes)
drop policy if exists conv_insert_admin_support on public.conversations;

create policy conv_insert_admin_support
  on public.conversations
  for insert
  to authenticated
  with check (
    kind = 'admin'
    and patient_id = auth.uid()
    and exists (
      select 1
      from public.profiles a
      where a.id = doctor_id
        and a.role = 'admin'::public.user_role
    )
  );

create or replace function public.profiles_create_admin_support_thread()
returns trigger
language plpgsql
security definer
set search_path to public
set row_security to off
as $$
declare
  v_admin_id uuid;
  v_conv_id uuid;
  v_welcome text := 'Hej fra Hormoni. Her kan du skrive til administrationen, hvis du oplever problemer med platformen, din konto eller har andre praktiske spørgsmål. Vi bestræber os på at svare hurtigst muligt på hverdage.';
begin
  if new.role = 'admin'::public.user_role then
    return new;
  end if;

  select p.id
  into v_admin_id
  from public.profiles p
  where p.role = 'admin'::public.user_role
  order by p.id
  limit 1;

  if v_admin_id is null then
    return new;
  end if;

  insert into public.conversations (patient_id, doctor_id, kind, created_from_appointment_id)
  select new.id, v_admin_id, 'admin', null
  where not exists (
    select 1
    from public.conversations c
    where c.patient_id = new.id
      and c.kind = 'admin'
  )
  returning id into v_conv_id;

  if v_conv_id is null then
    select c.id
    into v_conv_id
    from public.conversations c
    where c.patient_id = new.id
      and c.kind = 'admin'
    limit 1;
  end if;

  if v_conv_id is not null then
    if not exists (select 1 from public.messages m where m.conversation_id = v_conv_id) then
      insert into public.messages (conversation_id, sender_id, body, recipient_id)
      values (v_conv_id, v_admin_id, v_welcome, new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_admin_support_thread_trigger on public.profiles;

create trigger profiles_admin_support_thread_trigger
  after insert on public.profiles
  for each row
  execute function public.profiles_create_admin_support_thread();

-- Eksisterende profiler (ikke admin) uden admin-tråd
do $$
declare
  v_admin_id uuid;
  v_welcome text := 'Hej fra Hormoni. Her kan du skrive til administrationen, hvis du oplever problemer med platformen, din konto eller har andre praktiske spørgsmål. Vi bestræber os på at svare hurtigst muligt på hverdage.';
  r record;
  v_conv_id uuid;
begin
  select p.id
  into v_admin_id
  from public.profiles p
  where p.role = 'admin'::public.user_role
  order by p.id
  limit 1;

  if v_admin_id is null then
    return;
  end if;

  for r in
    select pr.id as uid
    from public.profiles pr
    where pr.role is distinct from 'admin'::public.user_role
      and not exists (
        select 1
        from public.conversations c
        where c.patient_id = pr.id
          and c.kind = 'admin'
      )
  loop
    v_conv_id := null;
    insert into public.conversations (patient_id, doctor_id, kind, created_from_appointment_id)
    select r.uid, v_admin_id, 'admin', null
    where not exists (
      select 1
      from public.conversations c2
      where c2.patient_id = r.uid
        and c2.kind = 'admin'
    )
    returning id into v_conv_id;

    if v_conv_id is null then
      select c.id
      into v_conv_id
      from public.conversations c
      where c.patient_id = r.uid
        and c.kind = 'admin'
      limit 1;
    end if;

    if v_conv_id is not null and not exists (select 1 from public.messages m where m.conversation_id = v_conv_id) then
      insert into public.messages (conversation_id, sender_id, body, recipient_id)
      values (v_conv_id, v_admin_id, v_welcome, r.uid);
    end if;
  end loop;
end $$;
