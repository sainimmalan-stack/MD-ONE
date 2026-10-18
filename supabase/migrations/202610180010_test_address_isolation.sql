begin;
-- Operator test addresses do not confer real residence or community privileges.
create or replace function private.active_project(p uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id where not f.is_test and m.user_id=(select auth.uid()) and f.project_id=p and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()));$$;
create or replace function private.active_resident(uid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id where not f.is_test and m.user_id=uid and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()));$$;
create policy operator_only_test_flats on public.flats as restrictive for select to authenticated using(not is_test or private.staff_role(array['warehouse','platform']));
create policy operator_only_test_orders on public.orders as restrictive for select to authenticated using(not is_test or private.staff_role(array['warehouse','platform']));
update public.memberships m set status='expired',move_out=now() from public.flats f where f.id=m.flat_id and f.is_test and m.status='approved';
create or replace function public.grocery_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return jsonb_build_object('operator',private.staff_role(array['warehouse','platform']),
 'flats',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'label',f.label,'is_test',f.is_test,'project',p.name,'enabled',(s.groceries or f.is_test))) from public.flats f join public.projects p on p.id=f.project_id join public.project_services s on s.project_id=p.id where (f.is_test and private.staff_role(array['warehouse','platform'])) or (not f.is_test and exists(select 1 from public.memberships m where m.flat_id=f.id and m.user_id=auth.uid() and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now())))),'[]'::jsonb));
end;$$;
create or replace function public.grocery_checkout(p_flat uuid,p_slot uuid,p_items jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_hash text; v_old private.idempotency; v_slot public.delivery_slots; v_product public.products; v_item record; v_batch record; v_qty integer; v_take integer; v_total integer:=0; v_id uuid:=gen_random_uuid(); v_response jsonb; v_test boolean;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 if p_key is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Invalid basket'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x->'qty')<>'number' or not coalesce((x->>'qty') ~ '^[0-9]+$',false) or (x->>'qty')::numeric not between 1 and 20 or not coalesce((x->>'id') ~ '^[0-9a-fA-F-]{36}$',false)) then raise exception 'Invalid basket quantity'; end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'id') from jsonb_array_elements(p_items) x) then raise exception 'Duplicate product'; end if;
 select md5(jsonb_build_object('flat',p_flat,'slot',p_slot,'items',(select jsonb_agg(x order by x->>'id') from jsonb_array_elements(p_items) x))::text) into v_hash;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text||p_key::text,0));
 select * into v_old from private.idempotency where user_id=v_user and key=p_key::text;
 if found then if v_old.request_hash<>v_hash then raise exception 'Checkout key already used for another basket'; end if; return v_old.response; end if;
 select is_test into v_test from public.flats where id=p_flat;
 if v_test and not private.staff_role(array['warehouse','platform']) then raise exception 'Test checkout is restricted to operators'; end if;
 if not v_test and not exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id join public.project_services s on s.project_id=f.project_id where m.flat_id=p_flat and m.user_id=v_user and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()) and (s.groceries or (f.is_test and private.staff_role(array['warehouse','platform'])))) then raise exception 'Grocery delivery is not enabled for your verified flat'; end if;
 select * into v_slot from public.delivery_slots where id=p_slot for update;
 if not found or v_slot.starts_at<=now() or v_slot.capacity<=(select count(*) from public.orders where slot_id=p_slot and status not in ('cancelled','returned')) then raise exception 'Delivery slot is full or unavailable'; end if;
 if v_slot.is_test is distinct from v_test then raise exception 'Choose a matching test or live delivery slot'; end if;
 -- Product row locks are taken in a consistent order, shared by receiving and cancellation.
 perform p.id from public.products p where p.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x) order by p.id for update;
 insert into public.orders(id,user_id,flat_id,slot_id,subtotal_paise,delivery_paise,total_paise,is_test,payment_state) values(v_id,v_user,p_flat,p_slot,0,0,0,v_test,case when v_test then 'test_no_payment' else 'cod_due' end);
 for v_item in select (x->>'id')::uuid id,(x->>'qty')::integer qty from jsonb_array_elements(p_items) x order by (x->>'id')::uuid loop
  select * into v_product from public.products where id=v_item.id and active;
  if not found or v_product.price_paise<=0 then raise exception 'Product unavailable'; end if;
  if v_product.is_test is distinct from v_test then raise exception 'Test and live products cannot be mixed'; end if;
  if not v_test and v_product.price_status<>'confirmed' then raise exception 'Selling price is awaiting confirmation'; end if;
  v_qty:=v_item.qty;
  for v_batch in select * from public.inventory_batches where product_id=v_item.id and quantity>0 and expires_at>v_slot.ends_at order by expires_at,id for update loop
   v_take:=least(v_qty,v_batch.quantity);
   update public.inventory_batches set quantity=quantity-v_take where id=v_batch.id;
   insert into private.order_batches values(v_id,v_batch.id,v_take);
   v_qty:=v_qty-v_take; exit when v_qty=0;
  end loop;
  if v_qty>0 then raise exception 'Insufficient fresh stock for %',v_product.name; end if;
  insert into public.order_items(order_id,product_id,quantity,unit_price_paise,product_name) values(v_id,v_item.id,v_item.qty,v_product.price_paise,v_product.name);
  v_total:=v_total+v_product.price_paise*v_item.qty;
 end loop;
 update public.orders set subtotal_paise=v_total,total_paise=v_total where id=v_id;
 v_response:=jsonb_build_object('id',v_id,'total',v_total);
 insert into private.idempotency values(v_user,p_key::text,v_hash,v_response);
 insert into private.audit(actor_id,action,target_id) values(v_user,'grocery.order.placed',v_id);
 return v_response;
end;$$;
commit;
