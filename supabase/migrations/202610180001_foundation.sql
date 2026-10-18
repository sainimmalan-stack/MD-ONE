-- Production foundation, not the running demo adapter. Apply to a fresh Supabase
-- project in staging and run the RLS suite before enabling production traffic.
begin;
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text not null default 'Resident',created_at timestamptz not null default now());
create table private.staff(user_id uuid primary key references auth.users(id),role text not null check(role in ('association','warehouse','delivery','support','platform')),project_id uuid);
create table public.projects(id uuid primary key default gen_random_uuid(),name text not null unique,status text not null check(status in ('completed','ongoing')),source_url text not null,verified_at date not null);
create table public.project_services(project_id uuid primary key references public.projects(id),groceries boolean not null default false,carpool boolean not null default false,maintenance boolean not null default false);
create table public.flats(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),label text not null,unique(project_id,label));
create table public.ownership(user_id uuid not null references auth.users(id),flat_id uuid not null references public.flats(id),primary key(user_id,flat_id));
create table public.memberships(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),flat_id uuid not null references public.flats(id),kind text not null check(kind in ('owner','tenant','household')),status text not null default 'pending' check(status in ('pending','approved','rejected','expired')),move_in timestamptz not null default now(),move_out timestamptz,unique(user_id,flat_id,kind),check(move_out is null or move_out>=move_in));
create table public.preferences(user_id uuid primary key references auth.users(id),language text not null default 'en' check(language in ('en','te')),notifications boolean not null default true,network boolean not null default false);
create function private.active_project(p uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id where m.user_id=(select auth.uid()) and f.project_id=p and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()));$$;
create function private.staff_role(roles text[]) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.staff s where s.user_id=(select auth.uid()) and s.role=any(roles));$$;
create function private.manages_project(p uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.staff s where s.user_id=(select auth.uid()) and s.role='association' and s.project_id=p);$$;
create function private.network_enabled() returns boolean language sql stable security definer set search_path='' as $$select coalesce((select network from public.preferences where user_id=(select auth.uid())),false);$$;
create table public.products(id uuid primary key default gen_random_uuid(),name text not null,category text not null,unit text not null,price_paise integer not null check(price_paise>=0),active boolean not null default true);
create table public.inventory_batches(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id),supplier text not null,quantity integer not null check(quantity>=0),cost_paise integer not null check(cost_paise>=0),expires_at timestamptz not null);
create table public.riders(id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id),bike_code text unique not null,on_shift boolean not null default false,charging boolean not null default false,range_km integer not null default 0 check(range_km>=0));
create table public.delivery_slots(id uuid primary key default gen_random_uuid(),starts_at timestamptz not null,ends_at timestamptz not null,capacity integer not null check(capacity>=0),check(ends_at>starts_at));
create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),flat_id uuid not null references public.flats(id),status text not null default 'placed' check(status in ('placed','picking','packed','out_for_delivery','delivered','cancelled','returned')),payment_state text not null default 'cod_due' check(payment_state in ('cod_due','cod_collected','awaiting_capture','captured','partially_refunded','refunded','cancelled')),slot_id uuid not null references public.delivery_slots(id),rider_id uuid references public.riders(id),subtotal_paise integer not null,delivery_paise integer not null,total_paise integer not null,created_at timestamptz not null default now());
create table public.order_items(order_id uuid references public.orders(id),product_id uuid references public.products(id),quantity integer not null check(quantity>0),unit_price_paise integer not null,primary key(order_id,product_id));
create table private.order_batches(order_id uuid references public.orders(id),batch_id uuid references public.inventory_batches(id),quantity integer not null check(quantity>0),primary key(order_id,batch_id));
create table private.idempotency(user_id uuid not null,key text not null,request_hash text not null,response jsonb not null,primary key(user_id,key));
create table private.payment_events(provider text not null,event_id text not null,payload_hash text not null,processed_at timestamptz not null default now(),primary key(provider,event_id));
create table private.refunds(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),provider_ref text unique,amount_paise integer not null check(amount_paise>0),status text not null check(status in ('pending','processed','failed')));
create table public.rides(id uuid primary key default gen_random_uuid(),driver_id uuid not null references auth.users(id),project_id uuid not null references public.projects(id),pickup_area text not null,destination_area text not null,departure timestamptz not null,seats integer not null check(seats between 0 and 6),contribution_paise integer not null default 0 check(contribution_paise>=0),status text not null default 'open' check(status in ('open','cancelled','completed')));
create table public.ride_requests(id uuid primary key default gen_random_uuid(),ride_id uuid not null references public.rides(id),user_id uuid not null references auth.users(id),status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),unique(ride_id,user_id));
create table public.events(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects(id),title text not null,starts_at timestamptz not null,place text not null,description text not null,capacity integer not null check(capacity>0));
create table public.rsvps(event_id uuid references public.events(id),user_id uuid references auth.users(id),volunteer boolean not null default false,primary key(event_id,user_id));
create table public.posts(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),user_id uuid not null references auth.users(id),body text not null check(length(body) between 1 and 1500),status text not null default 'published' check(status in ('published','hidden')),created_at timestamptz not null default now());
create table public.expenses(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),description text not null,category text not null,amount_paise bigint not null check(amount_paise>0),kind text not null check(kind in ('income','expense')),spent_on date not null);
create table public.loans(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),title text not null,principal_paise bigint not null check(principal_paise>0),annual_rate numeric not null check(annual_rate between 0 and 100),months integer not null check(months between 1 and 600),due_day integer not null check(due_day between 1 and 28));
create table public.loan_payments(id uuid primary key default gen_random_uuid(),loan_id uuid not null references public.loans(id),user_id uuid not null references auth.users(id),period date not null,amount_paise bigint not null check(amount_paise>0),verification text not null default 'user_marked' check(verification in ('user_marked','bank_verified')),unique(loan_id,period));
create table public.documents(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),object_key text not null unique,name text not null,folder text not null,mime text not null,scan_state text not null default 'quarantined' check(scan_state in ('quarantined','clean','rejected')),created_at timestamptz not null default now());
create table public.document_shares(id uuid primary key default gen_random_uuid(),document_id uuid not null references public.documents(id) on delete cascade,owner_id uuid not null references auth.users(id),recipient_id uuid not null references auth.users(id),expires_at timestamptz not null,revoked boolean not null default false);
create table public.tickets(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),project_id uuid not null references public.projects(id),category text not null,description text not null,status text not null default 'open' check(status in ('open','in_progress','resolved')),created_at timestamptz not null default now());
create table private.audit(id uuid primary key default gen_random_uuid(),actor_id uuid,action text not null,target_id uuid,at timestamptz not null default now());
create table private.jobs(id uuid primary key default gen_random_uuid(),kind text not null,payload jsonb not null,run_after timestamptz not null default now(),state text not null default 'pending',attempts integer not null default 0,lease_until timestamptz);

-- Deny by default, including to authenticated users. Explicitly grant only needed operations.
do $$declare t record;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t.tablename);end loop;end$$;
revoke all on all tables in schema public from anon,authenticated;
grant usage on schema private to authenticated;
grant select on public.profiles,public.projects,public.project_services,public.flats,public.ownership,public.memberships,public.products,public.orders,public.order_items,public.riders,public.delivery_slots,public.rides,public.ride_requests,public.events,public.rsvps,public.documents,public.document_shares to authenticated;
grant select,insert,update,delete on public.expenses,public.loans,public.preferences to authenticated;
grant select,insert on public.posts,public.tickets to authenticated;
grant select,insert,update on public.loan_payments to authenticated;
grant update(display_name) on public.profiles to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy edit_own_name on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy project_index on public.projects for select to authenticated using(true);
create policy service_index on public.project_services for select to authenticated using(true);
create policy my_flat on public.flats for select to authenticated using(private.active_project(project_id) or exists(select 1 from public.ownership o where o.flat_id=id and o.user_id=(select auth.uid())) or private.manages_project(project_id));
create policy own_ownership on public.ownership for select to authenticated using(user_id=(select auth.uid()));
create policy own_membership on public.memberships for select to authenticated using(user_id=(select auth.uid()));
create policy own_preferences on public.preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy active_catalog on public.products for select to authenticated using(active);
create policy my_orders on public.orders for select to authenticated using(user_id=(select auth.uid()) or private.staff_role(array['warehouse','platform']) or rider_id in(select id from public.riders where user_id=(select auth.uid())));
create policy own_rider on public.riders for select to authenticated using(user_id=(select auth.uid()) or private.staff_role(array['warehouse','platform']));
create policy visible_items on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
create policy slot_index on public.delivery_slots for select to authenticated using(starts_at>now());
create policy eligible_rides on public.rides for select to authenticated using(status='open' and departure>now() and exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id join public.project_services s on s.project_id=f.project_id where m.user_id=(select auth.uid()) and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()) and s.carpool));
create policy own_ride_requests on public.ride_requests for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.rides r where r.id=ride_id and r.driver_id=(select auth.uid())));
create policy visible_events on public.events for select to authenticated using((project_id is not null and private.active_project(project_id)) or (project_id is null and private.network_enabled() and exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()))));
create policy my_rsvp on public.rsvps for select to authenticated using(user_id=(select auth.uid()));
create policy visible_posts on public.posts for select to authenticated using(status='published' and private.active_project(project_id));
create policy create_post on public.posts for insert to authenticated with check(user_id=(select auth.uid()) and status='published' and private.active_project(project_id));
create policy my_expenses on public.expenses for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy my_loans on public.loans for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy my_loan_payments on public.loan_payments for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and verification='user_marked' and exists(select 1 from public.loans l where l.id=loan_id and l.user_id=(select auth.uid())));
create policy own_document_metadata on public.documents for select to authenticated using(user_id=(select auth.uid()));
create policy own_share_metadata on public.document_shares for select to authenticated using(owner_id=(select auth.uid()) or (recipient_id=(select auth.uid()) and not revoked and expires_at>now()));
create policy own_tickets on public.tickets for select to authenticated using(user_id=(select auth.uid()) or private.manages_project(project_id));
create policy create_ticket on public.tickets for insert to authenticated with check(user_id=(select auth.uid()) and private.active_project(project_id) and status='open');

-- Privileged writes intentionally have no client policy. Server RPCs must validate
-- identity and scope before changing inventory, memberships, orders, scans or roles.
create function public.accept_ride_request(request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare q public.ride_requests; r public.rides;begin
 select * into q from public.ride_requests where id=request_id;
 if not found then raise exception 'Request unavailable';end if;
 select * into r from public.rides where id=q.ride_id for update;
 if r.driver_id is distinct from (select auth.uid()) or r.status<>'open' or r.departure<=now() or not private.active_project(r.project_id) then raise exception 'Not authorized';end if;
 select * into q from public.ride_requests where id=request_id for update;
 if q.status<>'pending' or r.seats<1 then raise exception 'No seat available';end if;
 if not exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id join public.project_services s on s.project_id=f.project_id where m.user_id=q.user_id and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()) and s.carpool) then raise exception 'Residence inactive';end if;
 update public.rides set seats=seats-1 where id=r.id;
 update public.ride_requests set status='accepted' where id=q.id;
 insert into private.audit(actor_id,action,target_id) values((select auth.uid()),'ride.accepted',r.id);
end;$$;
create function public.join_event(event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.events; n integer;begin
 if (select auth.uid()) is null then raise exception 'Sign in required';end if;
 select * into e from public.events where id=event_id for update;
 if not found or e.starts_at<=now() then raise exception 'Event unavailable';end if;
 if not ((e.project_id is not null and private.active_project(e.project_id)) or (e.project_id is null and private.network_enabled() and exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now())))) then raise exception 'Not authorized';end if;
 if exists(select 1 from public.rsvps rv where rv.event_id=e.id and rv.user_id=(select auth.uid())) then return;end if;
 select count(*) into n from public.rsvps rv where rv.event_id=e.id;
 if n>=e.capacity then raise exception 'Event is full';end if;
 insert into public.rsvps(event_id,user_id) values(e.id,(select auth.uid()));
end;$$;
revoke all on all functions in schema private from public,anon;
revoke all on function public.accept_ride_request(uuid),public.join_event(uuid) from public,anon;
grant execute on all functions in schema private to authenticated;
grant execute on function public.accept_ride_request(uuid),public.join_event(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('resident-vault','resident-vault',false,5242880,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
-- No storage.objects read/write policy: signed server operations only after
-- membership-independent personal ownership, step-up, clean scan and share checks.

insert into public.projects(name,status,source_url,verified_at) select 'My Dream '||name,case when ord<=13 then 'completed' else 'ongoing' end,'https://mydreamprojects.in/projects','2026-10-18'::date from unnest(array['Nest','Casa','Avasa','Skylark','Glenmore','Hillock','Summit','Griffin','Selene','Atlantis','Perch','Solace','Zenith','Aurelia','Elysium','Aura','Echelon','Vale','Ivy']) with ordinality as x(name,ord);
insert into public.project_services(project_id) select id from public.projects;
-- No production flats, residents, service coverage or riders are invented.
commit;
