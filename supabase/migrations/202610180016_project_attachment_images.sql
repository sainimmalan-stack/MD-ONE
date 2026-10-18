-- Raster uploads are stored as bounded RGB pixels, never as user-supplied executable files.
-- PDFs remain private/quarantined until a real scanner is integrated.
begin;
alter table private.project_attachment_data add column width integer;
alter table private.project_attachment_data add column height integer;
create function public.project_image_attachment(p_project uuid,p_name text,p_width integer,p_height integer,p_pixels text,p_redacted boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$declare id uuid:=gen_random_uuid();begin
 if auth.uid() is null or not private.project_relationship(auth.uid(),p_project) then raise exception 'Verified project relationship required';end if;
 if p_width is null or p_height is null or p_width not between 1 and 1024 or p_height not between 1 and 1024 or length(p_pixels)>4194304 or octet_length(decode(p_pixels,'base64'))<>p_width*p_height*3 then raise exception 'Invalid RGB image';end if;
 if (select count(*) from public.project_attachments where owner_id=auth.uid() and project_id=p_project)>=500 then raise exception 'Attachment limit reached';end if;
 insert into public.project_attachments(id,project_id,owner_id,name,mime,object_key,visibility,scan_state) values(id,p_project,auth.uid(),private.op_text(p_name,150),'image/jpeg','private-rgb/'||id,case when p_redacted and private.project_committee(p_project) then 'redacted' else 'private' end,'clean');
 insert into private.project_attachment_data values(id,p_pixels,p_width,p_height);return jsonb_build_object('id',id,'name',p_name,'scan_state','clean');end;$$;
create function public.project_image_pixels(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare a public.project_attachments;res jsonb;begin
 select * into a from public.project_attachments where id=p_id;if not found then raise exception 'Attachment unavailable';end if;
 -- Reuse project scope, ownership and publication authorization from the download contract.
 res:=public.project_api('my-project/'||a.project_id||'/attachments/'||p_id);
 return res||jsonb_build_object('width',(select width from private.project_attachment_data where id=p_id),'height',(select height from private.project_attachment_data where id=p_id));end;$$;
revoke all on function public.project_image_attachment(uuid,text,integer,integer,text,boolean),public.project_image_pixels(uuid) from public,anon;
grant execute on function public.project_image_attachment(uuid,text,integer,integer,text,boolean),public.project_image_pixels(uuid) to authenticated;
commit;
