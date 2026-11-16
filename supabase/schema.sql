-- RefSite 1.0 — run once in Supabase > SQL Editor.
-- One private library per explicitly provisioned account.
-- No service_role key is needed by this application.

create table if not exists public.refsite_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"version":1,"revision":0,"folders":[{"id":"uncategory","name":"Uncategory","parentId":null,"order":0},{"id":"product","name":"Product Design","parentId":null,"order":1},{"id":"ui-inspo","name":"UI Inspo","parentId":"product","order":0},{"id":"ui-resource","name":"UI Resource","parentId":"product","order":1},{"id":"learning","name":"Learning","parentId":"product","order":2},{"id":"visual","name":"Visual Design","parentId":null,"order":2},{"id":"font","name":"Font","parentId":"visual","order":0},{"id":"color","name":"Color","parentId":"visual","order":1},{"id":"development","name":"Development","parentId":null,"order":3},{"id":"dev-tools","name":"Tools & Libraries","parentId":"development","order":0}],"resources":[]}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint valid_library_object check (
    jsonb_typeof(data) = 'object'
    and data->>'version' = '1'
    and jsonb_typeof(data->'folders') = 'array'
    and jsonb_typeof(data->'resources') = 'array'
  )
);

alter table public.refsite_libraries enable row level security;
revoke all on public.refsite_libraries from anon, authenticated;
grant select on public.refsite_libraries to authenticated;
grant update (data, revision) on public.refsite_libraries to authenticated;

drop policy if exists "Read own library" on public.refsite_libraries;
create policy "Read own library" on public.refsite_libraries
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Update own library" on public.refsite_libraries;
create policy "Update own library" on public.refsite_libraries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.refsite_touch_library()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists refsite_library_updated on public.refsite_libraries;
create trigger refsite_library_updated
  before update on public.refsite_libraries
  for each row execute function public.refsite_touch_library();

-- NEXT: Create your user under Authentication > Users > Add user.
-- Then replace YOUR_EMAIL@example.com and run this separately:
--
-- insert into public.refsite_libraries (user_id)
-- select id from auth.users where lower(email) = lower('YOUR_EMAIL@example.com')
-- on conflict (user_id) do nothing;
--
-- Verify exactly your account was provisioned:
-- select u.email, l.revision
-- from public.refsite_libraries l join auth.users u on u.id = l.user_id;
