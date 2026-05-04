create or replace function public.is_authenticated_user()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated';
$$;

drop policy if exists "Authenticated users can view orders" on public.orders;
drop policy if exists "Authenticated users can update orders" on public.orders;
drop policy if exists "Authenticated users can view order items" on public.order_items;
drop policy if exists "Admins can view orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can view order items" on public.order_items;

create policy "Authenticated users can view orders"
on public.orders
for select
to authenticated
using ((select public.is_authenticated_user()));

create policy "Authenticated users can update orders"
on public.orders
for update
to authenticated
using ((select public.is_authenticated_user()))
with check ((select public.is_authenticated_user()));

create policy "Authenticated users can view order items"
on public.order_items
for select
to authenticated
using ((select public.is_authenticated_user()));
