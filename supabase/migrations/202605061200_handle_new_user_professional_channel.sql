-- Synk auth.users → profiles ved oprettelse: gynækolog via user_metadata.registration_channel
-- search_path for sikkerhed (linter)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when coalesce(new.raw_user_meta_data->>'registration_channel', '') = 'professional'
        then 'professional'::public.user_role
      else 'user'::public.user_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
