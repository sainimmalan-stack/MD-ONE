-- Defense in depth: an authorized reference cannot relabel another user's media.
begin;
create or replace function public.community_media_get(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare m private.community_media;begin
 select * into m from private.community_media where id=p_id;
 if not found or auth.uid() is null then raise exception 'Photo unavailable';end if;
 if m.user_id<>auth.uid() and not (
 exists(select 1 from public.social_profiles s where s.user_id=m.user_id and s.avatar_key=p_id::text and private.can_discover_profile(s.user_id) and (not s.locked or private.are_friends(auth.uid(),s.user_id))) or
 exists(select 1 from public.posts p where p.user_id=m.user_id and p.image_key=p_id::text and private.post_is_visible(p.id)) or
 exists(select 1 from public.exchange_listings l where l.user_id=m.user_id and l.photo_keys ? p_id::text and private.exchange_visible(l.id)) or
 exists(select 1 from public.home_listings l where l.user_id=m.user_id and l.photos ? p_id::text and private.home_visible(l.id))
 ) then raise exception 'Photo unavailable';end if;
 return jsonb_build_object('mime',m.mime,'content',m.content);end;$$;
commit;
