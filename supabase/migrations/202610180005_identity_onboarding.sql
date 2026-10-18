begin;
create table public.residence_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 project_id uuid not null references public.projects(id),
 flat_label text not null check(flat_label ~ '^[0-9]{2,5}$'),
 kind text not null check(kind in ('owner','tenant','household')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 unique(user_id,project_id,flat_label)
);
alter table public.residence_requests enable row level security;
revoke all on public.residence_requests from anon,authenticated;
grant select,insert on public.residence_requests to authenticated;
create policy my_request on public.residence_requests for select to authenticated using(user_id=(select auth.uid()));
create policy submit_request on public.residence_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
create function private.create_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id) values(new.id) on conflict do nothing;
 insert into public.preferences(user_id) values(new.id) on conflict do nothing;
 insert into public.social_profiles(user_id) values(new.id) on conflict do nothing;
 return new;
end;$$;
revoke all on function private.create_identity() from public,anon,authenticated;
create trigger create_md_one_identity after insert on auth.users for each row execute function private.create_identity();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
insert into public.preferences(user_id) select id from auth.users on conflict do nothing;
insert into public.social_profiles(user_id) select id from auth.users on conflict do nothing;
commit;
