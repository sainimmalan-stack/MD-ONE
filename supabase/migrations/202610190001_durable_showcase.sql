-- Synthetic preview state only. This function never reads or writes resident/domain tables.
begin;
create table if not exists private.showcase_config (
  singleton boolean primary key default true check(singleton),
  key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$')
);
create table if not exists private.showcase_snapshots (
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  payload text check(octet_length(payload)<=4000000),
  revision integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  touched_at timestamptz not null default clock_timestamp(),
  lease_id uuid,
  lease_until timestamptz
);
revoke all on private.showcase_config,private.showcase_snapshots from public,anon,authenticated;
alter table private.showcase_config enable row level security;
alter table private.showcase_snapshots enable row level security;
create or replace function public.showcase_snapshot(
 p_action text,p_key text,p_hash text,p_lease uuid default null,p_revision integer default null,p_payload text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot_row private.showcase_snapshots; lease uuid; at_time timestamptz:=clock_timestamp();
begin
 if p_key is null or length(p_key)<>64 or not exists(select 1 from private.showcase_config where key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then
  raise exception 'Demo storage authorization failed' using errcode='42501';
 end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid demo key';end if;
 if p_action='create' then
  -- A transaction lock bounds concurrent creation across all application workers.
  perform pg_advisory_xact_lock(1947,20261019);
  delete from private.showcase_snapshots where touched_at<at_time-interval '30 minutes' or created_at<at_time-interval '2 hours';
  if (select count(*) from private.showcase_snapshots)>=64 then raise exception 'Demo is busy';end if;
  insert into private.showcase_snapshots(token_hash) values(p_hash) on conflict do nothing;
 end if;
 select * into snapshot_row from private.showcase_snapshots where token_hash=p_hash for update;
 if not found then return jsonb_build_object('status','missing');end if;
 if snapshot_row.touched_at<at_time-interval '30 minutes' or snapshot_row.created_at<at_time-interval '2 hours' then
  delete from private.showcase_snapshots where token_hash=p_hash;return jsonb_build_object('status','missing');
 end if;
 if p_action='reset' then delete from private.showcase_snapshots where token_hash=p_hash;return jsonb_build_object('status','ok');end if;
 if p_action in ('acquire','create') then
  if snapshot_row.lease_id is not null and snapshot_row.lease_until>at_time then return jsonb_build_object('status','busy');end if;
  lease:=gen_random_uuid();
  update private.showcase_snapshots set lease_id=lease,lease_until=at_time+interval '90 seconds' where token_hash=p_hash;
  return jsonb_build_object('status','ok','lease',lease,'revision',snapshot_row.revision,'payload',snapshot_row.payload);
 end if;
 if snapshot_row.lease_id is distinct from p_lease or p_lease is null or snapshot_row.revision is distinct from p_revision or snapshot_row.lease_until<=at_time then
  return jsonb_build_object('status','stale');
 end if;
 if p_action='release' then
  if snapshot_row.payload is null then delete from private.showcase_snapshots where token_hash=p_hash;
  else update private.showcase_snapshots set lease_id=null,lease_until=null where token_hash=p_hash;end if;
  return jsonb_build_object('status','ok');
 end if;
 if p_action='commit' then
  if p_payload is null or octet_length(p_payload)>4000000 then raise exception 'Demo snapshot exceeds capacity';end if;
  update private.showcase_snapshots set payload=p_payload,revision=revision+1,touched_at=at_time,lease_id=null,lease_until=null where token_hash=p_hash;
  return jsonb_build_object('status','ok');
 end if;
 raise exception 'Unknown demo storage action';
end $$;
revoke all on function public.showcase_snapshot(text,text,text,uuid,integer,text) from public,anon,authenticated;
-- p_key is a dedicated server-only capability, checked before any row lookup.
-- A normal anon or authenticated API key without that capability cannot use this RPC.
grant execute on function public.showcase_snapshot(text,text,text,uuid,integer,text) to anon,authenticated;
commit;
