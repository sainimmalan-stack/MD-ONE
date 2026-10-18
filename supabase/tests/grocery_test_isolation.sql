begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000061','grocery-test-61@example.invalid'),('00000000-0000-4000-8000-000000000062','grocery-test-62@example.invalid');
insert into private.staff(user_id,role) values('00000000-0000-4000-8000-000000000061','platform');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000061',true);
do $$
declare f uuid; p uuid; s uuid; o uuid; rejected boolean; live_product uuid;
begin
 insert into public.flats(project_id,label,is_test) select id,'99997',true from public.projects limit 1 returning id into f;
 -- Test checkout must work through operator permissions without a real residence.
 if private.active_resident(auth.uid()) then raise exception 'Test operator gained real resident access';end if;
 insert into public.products(name,category,unit,price_paise,is_test,price_status) values('TEST ISOLATION','Dairy & eggs','1 pack',9900,true,'pilot') returning id into p;
 insert into public.inventory_batches(product_id,supplier,quantity,cost_paise,expires_at) values(p,'TEST ONLY',2,0,now()+interval '30 days');
 insert into public.delivery_slots(starts_at,ends_at,capacity,is_test) values(now()+interval '1 day',now()+interval '1 day 1 hour',2,true) returning id into s;
 select (public.grocery_checkout(f,s,jsonb_build_array(jsonb_build_object('id',p,'qty',1)),gen_random_uuid())->>'id')::uuid into o;
 if not (select is_test and payment_state='test_no_payment' from public.orders where id=o) then raise exception 'Test order payment isolation failed'; end if;
 perform public.grocery_order_status(o,'picking');perform public.grocery_order_status(o,'packed');perform public.grocery_order_status(o,'out_for_delivery');perform public.grocery_order_status(o,'delivered');
 if (select payment_state from public.orders where id=o)<>'test_no_payment' then raise exception 'Test delivery recorded a real payment';end if;
 if (select count(*) from public.order_events where order_id=o)<>5 then raise exception 'Incomplete fulfilment timeline';end if;
 insert into public.products(name,category,unit,price_paise,is_test) values('LIVE ISOLATION','Dairy & eggs','1 pack',9900,false) returning id into live_product;
 rejected:=false;
 begin perform public.grocery_checkout(f,s,jsonb_build_array(jsonb_build_object('id',live_product,'qty',1)),gen_random_uuid());exception when others then rejected:=true;end;
 if not rejected then raise exception 'Test and live stock mixed';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000062',true);
 if exists(select 1 from jsonb_array_elements(public.grocery_catalog()) x where (x->>'is_test')::boolean) then raise exception 'Non-operator saw test catalogue';end if;
 if exists(select 1 from jsonb_array_elements(public.grocery_slots()) x where (x->>'is_test')::boolean) then raise exception 'Non-operator saw test delivery slots';end if;
end;$$;
set local role authenticated;
do $$begin
 if exists(select 1 from public.products where is_test) then raise exception 'RLS exposed test products';end if;
 if exists(select 1 from public.delivery_slots where is_test) then raise exception 'RLS exposed test slots';end if;
end;$$;
reset role;
select 'PASS: test checkout/delivery, no-payment state, 5-event timeline, mixed-stock rejection, operator-only catalogue/slots' as result;
rollback;
