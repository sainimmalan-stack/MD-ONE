-- Social/community foundation. No private flat numbers or resident records seeded.
begin;
alter table private.staff drop constraint if exists staff_role_check;
alter table private.staff add constraint staff_role_check check(role in ('association','warehouse','delivery','support','platform','services','technician'));
create table public.social_profiles(user_id uuid primary key references auth.users(id),bio text not null default '' check(length(bio)<=300),occupation text not null default '' check(length(occupation)<=80),contact text not null default '' check(length(contact)<=100),contact_visibility text not null default 'friends' check(contact_visibility in ('private','friends','community')),avatar_key text,locked boolean not null default true,discoverable boolean not null default false,network_visible boolean not null default false,updated_at timestamptz not null default now());
create table public.friendships(id uuid primary key default gen_random_uuid(),sender_id uuid not null references auth.users(id),recipient_id uuid not null references auth.users(id),status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(sender_id<>recipient_id));
create unique index friendship_unique_pair on public.friendships(least(sender_id,recipient_id),greatest(sender_id,recipient_id));
create table public.blocks(user_id uuid references auth.users(id),target_id uuid references auth.users(id),created_at timestamptz not null default now(),primary key(user_id,target_id),check(user_id<>target_id));
alter table public.posts add column visibility text not null default 'project' check(visibility in ('project','friends','network'));
alter table public.posts add column image_key text;
create table public.post_likes(post_id uuid references public.posts(id) on delete cascade,user_id uuid references auth.users(id),primary key(post_id,user_id));
create table public.post_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,user_id uuid not null references auth.users(id),body text not null check(length(body) between 1 and 500),created_at timestamptz not null default now());
create table private.social_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users(id),target_kind text not null check(target_kind in ('profile','post')),target_id uuid not null,reason text not null,state text not null default 'open',created_at timestamptz not null default now());
create table public.service_catalog(id text primary key,name text not null,description text not null);
create table public.technicians(id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id),name text not null,trade text not null references public.service_catalog(id),on_shift boolean not null default false);
create table public.service_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),flat_id uuid not null references public.flats(id),category_id text not null references public.service_catalog(id),description text not null check(length(description) between 1 and 1500),preferred_visit text not null,priority text not null default 'routine' check(priority in ('routine','priority')),status text not null default 'requested' check(status in ('requested','assigned','en_route','in_progress','completed','cancelled')),technician_id uuid references public.technicians(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index one_active_specialist_job on public.service_requests(technician_id) where status in ('assigned','en_route','in_progress');
create table public.service_history(id uuid primary key default gen_random_uuid(),request_id uuid not null references public.service_requests(id),actor_id uuid references auth.users(id),status text not null,note text not null default '',created_at timestamptz not null default now());
create function private.active_resident(uid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.memberships m where m.user_id=uid and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()));$$;
create function private.are_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.blocks where (user_id=a and target_id=b) or (user_id=b and target_id=a));$$;
create function private.are_friends(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.friendships where status='accepted' and ((sender_id=a and recipient_id=b) or (sender_id=b and recipient_id=a))) and not private.are_blocked(a,b);$$;
create function private.can_discover_profile(target uuid) returns boolean language sql stable security definer set search_path='' as $$select private.active_resident((select auth.uid())) and private.active_resident(target) and not private.are_blocked((select auth.uid()),target) and ((select auth.uid())=target or private.are_friends((select auth.uid()),target) or exists(select 1 from public.social_profiles p where p.user_id=target and p.discoverable and (p.network_visible or exists(select 1 from public.memberships a join public.flats fa on fa.id=a.flat_id join public.flats fb on fb.project_id=fa.project_id join public.memberships b on b.flat_id=fb.id where a.user_id=(select auth.uid()) and b.user_id=target and a.status='approved' and b.status='approved' and a.move_in<=now() and b.move_in<=now() and (a.move_out is null or a.move_out>now()) and (b.move_out is null or b.move_out>now())))));$$;
create function public.resident_profile(target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare p public.social_profiles; full_access boolean; friends boolean;begin
 if not private.can_discover_profile(target) then raise exception 'Profile unavailable';end if;
 select * into p from public.social_profiles where user_id=target;
 friends:=private.are_friends((select auth.uid()),target);full_access:=not p.locked or friends or (select auth.uid())=target;
 return jsonb_build_object('id',target,'name',(select display_name from public.profiles where id=target),'locked',p.locked,'bio',case when full_access then p.bio else '' end,'occupation',case when full_access then p.occupation else '' end,'contact',case when full_access and ((select auth.uid())=target or p.contact_visibility='community' or (p.contact_visibility='friends' and friends)) then p.contact else '' end,'avatar_key',case when full_access then p.avatar_key else null end);
end;$$;
create function private.post_is_visible(post_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.posts p left join public.social_profiles sp on sp.user_id=p.user_id where p.id=post_id and p.status='published' and private.active_resident((select auth.uid())) and not private.are_blocked((select auth.uid()),p.user_id) and (p.user_id=(select auth.uid()) or (private.active_resident(p.user_id) and (not coalesce(sp.locked,true) or private.are_friends((select auth.uid()),p.user_id)) and ((p.visibility='project' and private.active_project(p.project_id)) or (p.visibility='friends' and private.are_friends((select auth.uid()),p.user_id)) or (p.visibility='network' and sp.network_visible))) or (exists(select 1 from private.staff st where st.user_id=p.user_id and st.role='association') and private.active_project(p.project_id))));$$;
-- Keep government IDs/vault objects completely separate from social image storage.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('resident-social','resident-social',false,400000,array['image/jpeg','image/png']) on conflict(id) do nothing;
-- Image downloads require server-issued URLs AFTER profile/post authorization.

alter table public.social_profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.service_catalog enable row level security;
alter table public.technicians enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_history enable row level security;
revoke all on public.social_profiles,public.friendships,public.blocks,public.post_likes,public.post_comments,public.service_catalog,public.technicians,public.service_requests,public.service_history from anon,authenticated;
grant select,insert,update on public.social_profiles to authenticated;
grant select on public.friendships,public.blocks,public.service_catalog,public.technicians,public.service_requests,public.service_history to authenticated;
grant select,insert,delete on public.post_likes to authenticated;
grant select,insert on public.post_comments,public.service_requests to authenticated;
create policy own_social_profile on public.social_profiles for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
-- No bulk raw-profile read policy: the redacting resident_profile RPC is required.
create policy my_connections on public.friendships for select to authenticated using((sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and private.active_resident((select auth.uid())));
create policy my_blocks on public.blocks for select to authenticated using(user_id=(select auth.uid()));
drop policy visible_posts on public.posts;
create policy visible_posts on public.posts for select to authenticated using(private.post_is_visible(id));
drop policy create_post on public.posts;
create policy create_post on public.posts for insert to authenticated with check(user_id=(select auth.uid()) and status='published' and private.active_project(project_id) and (visibility<>'network' or exists(select 1 from public.social_profiles sp where sp.user_id=(select auth.uid()) and sp.network_visible)));
create policy visible_likes on public.post_likes for select to authenticated using(private.post_is_visible(post_id));
create policy my_like on public.post_likes for insert to authenticated with check(user_id=(select auth.uid()) and private.post_is_visible(post_id));
create policy remove_my_like on public.post_likes for delete to authenticated using(user_id=(select auth.uid()));
create policy visible_comments on public.post_comments for select to authenticated using(private.post_is_visible(post_id) and not private.are_blocked((select auth.uid()),user_id));
create policy my_comment on public.post_comments for insert to authenticated with check(user_id=(select auth.uid()) and private.post_is_visible(post_id));
create policy service_catalog_index on public.service_catalog for select to authenticated using(true);
create policy staff_technicians on public.technicians for select to authenticated using(user_id=(select auth.uid()) or private.staff_role(array['services','platform']));
create policy my_service_requests on public.service_requests for select to authenticated using(user_id=(select auth.uid()) or private.staff_role(array['services','platform']) or technician_id in(select id from public.technicians where user_id=(select auth.uid())));
create policy request_for_my_home on public.service_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='requested' and technician_id is null and exists(select 1 from public.memberships m where m.flat_id=service_requests.flat_id and m.user_id=(select auth.uid()) and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now())));
create policy my_service_history on public.service_history for select to authenticated using(exists(select 1 from public.service_requests r where r.id=request_id));
revoke all on all functions in schema private from public,anon;
revoke all on function public.resident_profile(uuid) from public,anon;
grant execute on all functions in schema private to authenticated;
grant execute on function public.resident_profile(uuid) to authenticated;
-- Friendship request/decision/block RPCs, dispatch RPCs, moderation, signed social
-- image reads and owner profile joins still require production adapter implementation.
insert into public.service_catalog values('plumbing','Plumbing','Leaks, fittings and water lines'),('electrical','Electrical','Switches, wiring and lights'),('tiles','Tiles & stone','Repairs, retiling and finishing'),('painting','Painting','Interior and exterior painting'),('carpentry','Carpentry','Doors, cabinets and repairs'),('cleaning','Deep cleaning','A reset for your space'),('waterproofing','Waterproofing','Damp walls, seepage and sealing'),('ac','AC care','Servicing, installation and repairs');
alter table private.social_reports enable row level security;
commit;
