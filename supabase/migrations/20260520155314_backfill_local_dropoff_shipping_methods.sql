with merchandise_orders as (
  select orders.id
  from public.orders
  where orders.shipping_amount = 0
    and (
      orders.shipping_method is null
      or btrim(lower(orders.shipping_method)) in ('', 'not selected')
    )
    and exists (
      select 1
      from public.order_items
      where order_items.order_id = orders.id
        and order_items.category <> 'donation'
    )
)
update public.orders as orders
set
  shipping_method = 'Local drop-off',
  shipping_fulfillment_method = 'local_dropoff'
from merchandise_orders
where orders.id = merchandise_orders.id;
