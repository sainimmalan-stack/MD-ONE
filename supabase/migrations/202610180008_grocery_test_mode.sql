begin;
-- Test fulfilment remains private to operators and never records a real payment.
alter table public.products add column is_test boolean not null default false;
alter table public.products add column price_status text not null default 'confirmed' check(price_status in ('pilot','confirmed'));
alter table public.products add column art_key text;
alter table public.flats add column is_test boolean not null default false;
alter table public.delivery_slots add column is_test boolean not null default false;
alter table public.orders add column is_test boolean not null default false;
alter table public.orders drop constraint orders_payment_state_check;
alter table public.orders add constraint orders_payment_state_check check(payment_state in ('cod_due','cod_collected','awaiting_capture','captured','partially_refunded','refunded','cancelled','test_no_payment'));
alter table public.orders add constraint test_payment_isolation check((is_test and payment_state in ('test_no_payment','cancelled')) or (not is_test and payment_state<>'test_no_payment'));
drop policy active_catalog on public.products;
create policy active_catalog on public.products for select to authenticated using(active and (not is_test or private.staff_role(array['warehouse','platform'])));
drop policy slot_index on public.delivery_slots;
create policy slot_index on public.delivery_slots for select to authenticated using(starts_at>now() and (not is_test or private.staff_role(array['warehouse','platform'])));
create table public.order_events(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),status text not null,created_at timestamptz not null default now(),unique(order_id,status));
alter table public.order_events enable row level security;
revoke all on public.order_events from public,anon,authenticated;
grant select on public.order_events to authenticated;
create policy visible_order_events on public.order_events for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
create function private.record_order_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status then insert into public.order_events(order_id,status) values(new.id,new.status) on conflict do nothing; end if;
 return new;
end;$$;
revoke all on function private.record_order_event() from public,anon,authenticated;
create trigger record_order_event after insert or update of status on public.orders for each row execute function private.record_order_event();
insert into public.order_events(order_id,status,created_at) select id,status,created_at from public.orders on conflict do nothing;
create or replace function public.grocery_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return jsonb_build_object('operator',private.staff_role(array['warehouse','platform']),
 'flats',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'label',f.label,'is_test',f.is_test,'project',p.name,'enabled',(s.groceries or (f.is_test and private.staff_role(array['warehouse','platform']))))) from public.flats f join public.projects p on p.id=f.project_id join public.project_services s on s.project_id=p.id where (not f.is_test or private.staff_role(array['warehouse','platform'])) and exists(select 1 from public.memberships m where m.flat_id=f.id and m.user_id=auth.uid() and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()))),'[]'::jsonb));
end;$$;

create or replace function public.grocery_catalog() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'unit',p.unit,'price',p.price_paise,'price_status',p.price_status,'art_key',p.art_key,'is_test',p.is_test,'stock',coalesce((select sum(b.quantity) from public.inventory_batches b where b.product_id=p.id and b.expires_at>now()),0)) order by p.category,p.name) from public.products p where p.active and (not p.is_test or private.staff_role(array['warehouse','platform']))),'[]'::jsonb);
end;$$;

create or replace function public.grocery_slots() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'is_test',s.is_test,'starts',s.starts_at,'ends',s.ends_at,'available',s.capacity-(select count(*) from public.orders o where o.slot_id=s.id and o.status not in ('cancelled','returned'))) order by s.starts_at),'[]'::jsonb) from public.delivery_slots s where auth.uid() is not null and (not s.is_test or private.staff_role(array['warehouse','platform'])) and s.starts_at>now() and s.capacity>(select count(*) from public.orders o where o.slot_id=s.id and o.status not in ('cancelled','returned'));
$$;

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
 if not exists(select 1 from public.memberships m join public.flats f on f.id=m.flat_id join public.project_services s on s.project_id=f.project_id where m.flat_id=p_flat and m.user_id=v_user and m.status='approved' and m.move_in<=now() and (m.move_out is null or m.move_out>now()) and (s.groceries or (f.is_test and private.staff_role(array['warehouse','platform'])))) then raise exception 'Grocery delivery is not enabled for your verified flat'; end if;
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

create or replace function public.grocery_order_status(p_order uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
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
  update public.orders set status=p_status,payment_state=case when p_status='delivered' and not v_order.is_test then 'cod_collected' else payment_state end where id=p_order;
 end if;
 insert into private.audit(actor_id,action,target_id) values(auth.uid(),'grocery.order.'||p_status,p_order);
end;$$;

create or replace function public.grocery_receive(p_name text,p_category text,p_unit text,p_price integer,p_cost integer,p_quantity integer,p_expiry timestamptz,p_supplier text,p_key uuid,p_product uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
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
 update public.products set name=trim(p_name),category=trim(p_category),unit=trim(p_unit),price_paise=p_price,price_status='confirmed',active=true where id=v_product;
 end if;
 insert into public.inventory_batches(product_id,supplier,quantity,cost_paise,expires_at) values(v_product,trim(p_supplier),p_quantity,p_cost,p_expiry) returning id into v_batch;
 insert into public.grocery_assortment values(v_product,p_category,'stocked') on conflict(product_id) do update set launch_state='stocked';
 insert into private.grocery_receipts values(auth.uid(),p_key,v_batch);
 insert into private.audit(actor_id,action,target_id) values(auth.uid(),'grocery.stock.received',v_batch);
 return v_batch;
end;$$;
commit;
