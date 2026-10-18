-- Protect financial corrections/advance allocation as well as payment retries.
begin;
create table private.project_mutation_replays(user_id uuid references auth.users(id),request_key text,project_id uuid references public.projects(id),fingerprint text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_key));
alter table private.project_mutation_replays enable row level security;
revoke all on private.project_mutation_replays from public,anon,authenticated;
alter function public.project_api(text,text,jsonb,jsonb) rename to project_api_internal;
revoke all on function public.project_api_internal(text,text,jsonb,jsonb) from public,anon,authenticated;
create function public.project_api(p_route text,p_method text default 'GET',b jsonb default '{}',query jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$declare parts text[]:=string_to_array(p_route,'/');k text;fingerprint text;old private.project_mutation_replays;res jsonb;pid uuid;begin
 if auth.uid() is null then raise exception 'Sign in';end if;
 if p_method='POST' and parts[1]='my-project' and parts[3] in ('adjustments','apply-credit','expenses','payments','pay-expense','cash') then
 pid:=parts[2]::uuid;k:=private.op_text(b->>'key',100);if length(k)<10 then raise exception 'Missing financial request key';end if;
 if not private.project_relationship(auth.uid(),pid) then raise exception 'Verified project relationship required';end if;
 if parts[3]<>'payments' and not private.project_committee(pid) then raise exception 'Active committee appointment required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||k,71));
 fingerprint:=encode(sha256(convert_to(p_route||b::text,'UTF8')),'hex');select * into old from private.project_mutation_replays r where r.user_id=auth.uid() and r.request_key=k;
 if found then if old.fingerprint<>fingerprint or old.project_id<>pid then raise exception 'Retry differs from original financial record';end if;return old.result;end if;
 res:=public.project_api_internal(p_route,p_method,b,query);insert into private.project_mutation_replays values(auth.uid(),k,pid,fingerprint,res,now());return res;
 end if;return public.project_api_internal(p_route,p_method,b,query);end;$$;
revoke all on function public.project_api(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.project_api(text,text,jsonb,jsonb) to authenticated;
commit;
