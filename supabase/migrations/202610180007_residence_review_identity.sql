begin;
create function public.residence_review_queue() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.staff_role(array['platform']) then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'project_id',r.project_id,'flat_label',r.flat_label,'kind',r.kind,'email',u.email,'name',p.display_name) order by r.created_at) from public.residence_requests r join auth.users u on u.id=r.user_id join public.profiles p on p.id=r.user_id where r.status='pending'),'[]'::jsonb);
end;$$;
revoke all on function public.residence_review_queue() from public,anon;
grant execute on function public.residence_review_queue() to authenticated;
commit;
