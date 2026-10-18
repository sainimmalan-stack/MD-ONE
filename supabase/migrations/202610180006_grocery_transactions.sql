begin;
-- All stock and order writes execute in one PostgreSQL transaction under caller identity.
alter table public.order_items add column product_name text;
update public.order_items i set product_name=p.name from public.products p where p.id=i.product_id;
alter table public.order_items alter column product_name set not null;
create table private.grocery_receipts(user_id uuid not null,request_key uuid not null,batch_id uuid not null references public.inventory_batches(id),primary key(user_id,request_key));
alter table private.grocery_receipts enable row level security;
revoke all on private.grocery_receipts from public,anon,authenticated;
create index inventory_available on public.inventory_batches(product_id,expires_at) where quantity>0;
create index orders_slot on public.orders(slot_id,status);

create function public.grocery_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return jsonb_build_object('operator',private.staff_role(array['warehouse','platform']),
 'flats',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'label',f.label,'project',p.name,'enabled',s.groceries)) from public.flats f join public.projects p on p.id=f.project_id join public.project_services s on s.project_id=p.id where exists(select 1 from public.memberships m where m.flat_id=f.id and m.user_id=auth.uid() and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()))),'[]'::jsonb));
end;$$;
create function public.grocery_catalog() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'unit',p.unit,'price',p.price_paise,'stock',coalesce((select sum(b.quantity) from public.inventory_batches b where b.product_id=p.id and b.expires_at>now()),0)) order by p.category,p.name) from public.products p where p.active),'[]'::jsonb);
end;$$;
create function public.grocery_slots() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'starts',s.starts_at,'ends',s.ends_at,'available',s.capacity-(select count(*) from public.orders o where o.slot_id=s.id and o.status not in ('cancelled','returned'))) order by s.starts_at),'[]'::jsonb) from public.delivery_slots s where auth.uid() is not null and s.starts_at>now() and s.capacity>(select count(*) from public.orders o where o.slot_id=s.id and o.status not in ('cancelled','returned'));
$$;
create function public.grocery_checkout(p_flat uuid,p_slot uuid,p_items jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_hash text; v_old private.idempotency; v_slot public.delivery_slots; v_product public.products; v_item record; v_batch record; v_qty integer; v_take integer; v_total integer:=0; v_id uuid:=gen_random_uuid(); v_response jsonb;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 if p_key is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Invalid basket'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x->'qty')<>'number' or not coalesce((x->>'qty') ~ '^[0-9]+$',false) or (x->>'qty')::numeric not between 1 and 20 or not coalesce((x->>'id') ~ '^[0-9a-fA-F-]{36}$',false)) then raise exception 'Invalid basket quantity'; end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'id') from jsonb_array_elements(p_items) x) then raise exception 'Duplicate product'; end if;
 select md5(jsonb_build_object('flat',p_flat,'slot',p_slot,'items',(select jsonb_agg(x order by x->>'id') from jsonb_array_elements(p_items) x))::text) into v_hash;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text||p_key::text,0));
 select * into v_old from private.idempotency where user_id=v_user and key=p_key::text;
 if found then if v_old.request_hash<>v_hash then raise exception 'Checkout key already used for another basket'; end if; return v_old.response; end if;
 if not exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id join public.project_services s on s.project_id=f.project_id where m.flat_id=p_flat and m.user_id=v_user and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()) and s.groceries) then raise exception 'Grocery delivery is not enabled for your verified flat'; end if;
 select * into v_slot from public.delivery_slots where id=p_slot for update;
 if not found or v_slot.starts_at<=now() or v_slot.capacity<=(select count(*) from public.orders where slot_id=p_slot and status not in ('cancelled','returned')) then raise exception 'Delivery slot is full or unavailable'; end if;
 -- Product row locks are taken in a consistent order, shared by receiving and cancellation.
 perform p.id from public.products p where p.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x) order by p.id for update;
 insert into public.orders(id,user_id,flat_id,slot_id,subtotal_paise,delivery_paise,total_paise) values(v_id,v_user,p_flat,p_slot,0,0,0);
 for v_item in select (x->>'id')::uuid id,(x->>'qty')::integer qty from jsonb_array_elements(p_items) x order by (x->>'id')::uuid loop
  select * into v_product from public.products where id=v_item.id and active;
  if not found or v_product.price_paise<=0 then raise exception 'Product unavailable'; end if;
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
create function public.grocery_order_status(p_order uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders; v_operator boolean:=private.staff_role(array['warehouse','platform']);
begin
 select * into v_order from public.orders where id=p_order for update;
 if not found or auth.uid() is null or not(v_operator or v_order.user_id=auth.uid()) then raise exception 'Order unavailable'; end if;
 if p_status=v_order.status then return; end if;
 if p_status='cancelled' then
  if v_order.status<>'placed' then raise exception 'Only placed orders can be cancelled'; end if;
  perform p.id from public.products p join public.order_items i on i.product_id=p.id where i.order_id=p_order order by p.id for update of p;
  update public.inventory_batches b set quantity=b.quantity+ob.quantity from private.order_batches ob where ob.batch_id=b.id and ob.order_id=p_order;
  update public.orders set status='cancelled',payment_state='cancelled' where id=p_order;
 else
  if not v_operator then raise exception 'Warehouse access required'; end if;
  if not ((v_order.status='placed' and p_status='picking') or (v_order.status='picking' and p_status='packed') or (v_order.status='packed' and p_status='out_for_delivery') or (v_order.status='out_for_delivery' and p_status='delivered')) then raise exception 'Invalid order status change'; end if;
  update public.orders set status=p_status,payment_state=case when p_status='delivered' then 'cod_collected' else payment_state end where id=p_order;
 end if;
 insert into private.audit(actor_id,action,target_id) values(auth.uid(),'grocery.order.'||p_status,p_order);
end;$$;
create function public.grocery_receive(p_name text,p_category text,p_unit text,p_price integer,p_cost integer,p_quantity integer,p_expiry timestamptz,p_supplier text,p_key uuid,p_product uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_product uuid:=p_product; v_batch uuid;
begin
 if not private.staff_role(array['warehouse','platform']) then raise exception 'Warehouse access required'; end if;
 if p_key is null or p_quantity not between 1 and 100000 or p_price not between 1 and 10000000 or p_cost not between 0 and 10000000 or p_expiry<=now() or length(trim(p_name)) not between 1 and 120 or length(trim(p_category)) not between 1 and 60 or length(trim(p_unit)) not between 1 and 60 or length(trim(p_supplier)) not between 1 and 200 then raise exception 'Check product and stock details'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select batch_id into v_batch from private.grocery_receipts where user_id=auth.uid() and request_key=p_key;
 if found then return v_batch; end if;
 if v_product is null then
 insert into public.products(name,category,unit,price_paise) values(trim(p_name),trim(p_category),trim(p_unit),p_price) returning id into v_product;
 else
 perform id from public.products where id=v_product for update;
 if not found then raise exception 'Product unavailable'; end if;
 update public.products set name=trim(p_name),category=trim(p_category),unit=trim(p_unit),price_paise=p_price,active=true where id=v_product;
 end if;
 insert into public.inventory_batches(product_id,supplier,quantity,cost_paise,expires_at) values(v_product,trim(p_supplier),p_quantity,p_cost,p_expiry) returning id into v_batch;
 insert into public.grocery_assortment values(v_product,p_category,'stocked') on conflict(product_id) do update set launch_state='stocked';
 insert into private.grocery_receipts values(auth.uid(),p_key,v_batch);
 insert into private.audit(actor_id,action,target_id) values(auth.uid(),'grocery.stock.received',v_batch);
 return v_batch;
end;$$;
create function public.grocery_open_slot(p_start timestamptz,p_end timestamptz,p_capacity integer) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.staff_role(array['warehouse','platform']) then raise exception 'Warehouse access required'; end if;
 if p_start<=now() or p_end<=p_start or p_end>p_start+interval '8 hours' or p_capacity not between 1 and 100 then raise exception 'Check slot times and delivery capacity'; end if;
 insert into public.delivery_slots(starts_at,ends_at,capacity) values(p_start,p_end,p_capacity) returning id into v_id;
 return v_id;
end;$$;
-- Owners are appointed separately. No signup receives staff access automatically.
create function public.grocery_enable_project(p_project uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.staff_role(array['platform']) then raise exception 'Platform access required'; end if;
 update public.project_services set groceries=p_enabled where project_id=p_project;
 insert into private.audit(actor_id,action,target_id) values(auth.uid(),'grocery.coverage.'||p_enabled::text,p_project);
end;$$;
create function public.review_residence(p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.residence_requests; f uuid;
begin
 if not private.staff_role(array['platform']) then raise exception 'Platform access required'; end if;
 select * into r from public.residence_requests where id=p_request for update;
 if not found or r.status<>'pending' then raise exception 'Request unavailable'; end if;
 if p_approve then
 insert into public.flats(project_id,label) values(r.project_id,r.flat_label) on conflict(project_id,label) do update set label=excluded.label returning id into f;
 insert into public.memberships(user_id,flat_id,kind,status) values(r.user_id,f,r.kind,'approved') on conflict(user_id,flat_id,kind) do update set status='approved',move_in=now(),move_out=null;
 if r.kind='owner' then insert into public.ownership values(r.user_id,f) on conflict do nothing; end if;
 end if;
 update public.residence_requests set status=case when p_approve then 'approved' else 'rejected' end where id=r.id;
 insert into private.audit(actor_id,action,target_id) values(auth.uid(),'residence.reviewed',r.id);
end;$$;
create policy platform_residence_review on public.residence_requests for select to authenticated using(private.staff_role(array['platform']));
-- Restrict function access explicitly (Postgres defaults to PUBLIC execution).
revoke all on function public.grocery_context(),public.grocery_catalog(),public.grocery_slots(),public.grocery_checkout(uuid,uuid,jsonb,uuid),public.grocery_order_status(uuid,text),public.grocery_receive(text,text,text,integer,integer,integer,timestamptz,text,uuid,uuid),public.grocery_open_slot(timestamptz,timestamptz,integer),public.grocery_enable_project(uuid,boolean),public.review_residence(uuid,boolean) from public,anon;
grant execute on function public.grocery_context(),public.grocery_catalog(),public.grocery_slots(),public.grocery_checkout(uuid,uuid,jsonb,uuid),public.grocery_order_status(uuid,text),public.grocery_receive(text,text,text,integer,integer,integer,timestamptz,text,uuid,uuid),public.grocery_open_slot(timestamptz,timestamptz,integer),public.grocery_enable_project(uuid,boolean),public.review_residence(uuid,boolean) to authenticated;
commit;
