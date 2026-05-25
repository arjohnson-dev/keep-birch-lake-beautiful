drop policy if exists "Authenticated users can delete order items" on public.order_items;

create policy "Authenticated users can delete order items"
on public.order_items
for delete
to authenticated
using ((select public.is_authenticated_user()));
