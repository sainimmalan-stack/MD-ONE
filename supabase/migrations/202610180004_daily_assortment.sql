-- Storefront metadata is separate from operator demand targets and buying costs.
-- No proposed product, supplier, price, stock or warehouse coverage is seeded in production.
begin;
create table public.grocery_assortment(product_id uuid primary key references public.products(id),store_group text not null,launch_state text not null default 'planned' check(launch_state in ('planned','stocked')));
alter table public.grocery_assortment enable row level security;
revoke all on public.grocery_assortment from anon,authenticated;
grant select on public.grocery_assortment to authenticated;
create policy resident_assortment on public.grocery_assortment for select to authenticated using(private.active_resident((select auth.uid())) or private.staff_role(array['warehouse','platform']));
create table private.grocery_demand_plan(product_id uuid primary key references public.products(id),assumed_price_paise integer not null check(assumed_price_paise>0),monthly_units integer not null check(monthly_units>0),opening_days integer not null check(opening_days between 1 and 10),storage_notes text not null,updated_at timestamptz not null default now());
alter table private.grocery_demand_plan enable row level security;
revoke all on private.grocery_demand_plan from anon,authenticated;
grant select on private.grocery_demand_plan to authenticated;
create policy operator_demand_plan on private.grocery_demand_plan for select to authenticated using(private.staff_role(array['warehouse','platform']));
-- Privileged receiving/checkout RPCs must verify stocked state, confirmed selling/buying
-- prices, fresh batches, service coverage and dispatch capacity. No client write grants.
-- The 76-SKU local demand plan is illustrative; map approved supplier SKUs explicitly.
commit;
