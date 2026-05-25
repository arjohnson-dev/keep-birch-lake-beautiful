drop policy if exists "Authenticated users can insert orders" on public.orders;
drop policy if exists "Authenticated users can insert order items" on public.order_items;

create policy "Authenticated users can insert orders"
on public.orders
for insert
to authenticated
with check ((select public.is_authenticated_user()));

create policy "Authenticated users can insert order items"
on public.order_items
for insert
to authenticated
with check ((select public.is_authenticated_user()));
