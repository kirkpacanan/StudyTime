-- Fix: ensure auth.users insert trigger can create profiles/settings even with RLS
-- (Supabase runs this on account signup; failures here mean the user isn't persisted in `public.*`.)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  set row_security = off;

  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Student')
  );

  insert into public.user_settings (user_id, settings)
  values (new.id, '{}'::jsonb);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

