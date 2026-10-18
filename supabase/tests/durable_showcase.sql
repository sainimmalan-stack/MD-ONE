-- All fixtures and the temporary test capability roll back; real records are not used.
begin;
insert into private.showcase_config(singleton,key_hash) values(true,encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex'))
on conflict(singleton) do update set key_hash=excluded.key_hash;
do $$
declare first_lease jsonb; second_lease jsonb; result jsonb; denied boolean:=false; h text:=repeat('b',64);
begin
 begin perform public.showcase_snapshot('acquire','wrong',h);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Missing demo capability was accepted';end if;
 if has_table_privilege('anon','private.showcase_snapshots','select') or has_table_privilege('authenticated','private.showcase_config','select') then raise exception 'Private demo tables exposed';end if;
 first_lease:=public.showcase_snapshot('create',repeat('a',64),h);
 if first_lease->>'status'<>'ok' then raise exception 'Create failed';end if;
 result:=public.showcase_snapshot('acquire',repeat('a',64),h);
 if result->>'status'<>'busy' then raise exception 'Concurrent worker acquired active lease';end if;
 result:=public.showcase_snapshot('commit',repeat('a',64),h,(first_lease->>'lease')::uuid,0,'SYNTHETIC SEALED FIXTURE');
 if result->>'status'<>'ok' then raise exception 'Commit failed';end if;
 second_lease:=public.showcase_snapshot('acquire',repeat('a',64),h);
 if second_lease->>'payload'<>'SYNTHETIC SEALED FIXTURE' or second_lease->>'revision'<>'1' then raise exception 'Snapshot was not preserved';end if;
 result:=public.showcase_snapshot('commit',repeat('a',64),h,(first_lease->>'lease')::uuid,0,'STALE');
 if result->>'status'<>'stale' then raise exception 'Old worker overwrote state';end if;
 perform public.showcase_snapshot('release',repeat('a',64),h,(second_lease->>'lease')::uuid,1);
 perform public.showcase_snapshot('reset',repeat('a',64),h);
 result:=public.showcase_snapshot('commit',repeat('a',64),h,(second_lease->>'lease')::uuid,1,'RESURRECTED');
 if result->>'status'<>'missing' then raise exception 'Reset state was resurrected';end if;
 first_lease:=public.showcase_snapshot('create',repeat('a',64),h);
 update private.showcase_snapshots set lease_until=clock_timestamp()-interval '1 second' where token_hash=h;
 second_lease:=public.showcase_snapshot('acquire',repeat('a',64),h);
 if second_lease->>'status'<>'ok' or first_lease->>'lease'=second_lease->>'lease' then raise exception 'Expired lease was not reclaimed';end if;
 update private.showcase_snapshots set touched_at=clock_timestamp()-interval '31 minutes' where token_hash=h;
 result:=public.showcase_snapshot('acquire',repeat('a',64),h);
 if result->>'status'<>'missing' then raise exception 'Idle expiry failed';end if;
end $$;
rollback;
select 'PASS: capability, isolation, leases, revisions, crash recovery, reset and expiry' as result;
