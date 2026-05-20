alter table public.orders
add column if not exists shipping_amount integer not null default 0 check (shipping_amount >= 0),
add column if not exists shipping_method text,
add column if not exists shipping_fulfillment_method text;

with derived_shipping as (
  select
    id,
    case
      when raw_checkout_session #>> '{shipping_cost,amount_total}' ~ '^[0-9]+$'
        then (raw_checkout_session #>> '{shipping_cost,amount_total}')::integer
      else 0
    end as amount_total,
    case
      when jsonb_typeof(raw_checkout_session #> '{shipping_cost,shipping_rate}') = 'object'
        then nullif(raw_checkout_session #>> '{shipping_cost,shipping_rate,display_name}', '')
      when raw_checkout_session #>> '{shipping_cost,amount_total}' ~ '^[1-9][0-9]*$'
        then 'Ship order'
      when raw_checkout_session -> 'shipping_details' is not null
        and raw_checkout_session -> 'shipping_details' <> 'null'::jsonb
        then 'Local drop-off'
      else null
    end as method,
    case
      when jsonb_typeof(raw_checkout_session #> '{shipping_cost,shipping_rate}') = 'object'
        then nullif(raw_checkout_session #>> '{shipping_cost,shipping_rate,metadata,fulfillment_method}', '')
      when raw_checkout_session #>> '{shipping_cost,amount_total}' ~ '^[1-9][0-9]*$'
        then 'manual_shipping'
      when raw_checkout_session -> 'shipping_details' is not null
        and raw_checkout_session -> 'shipping_details' <> 'null'::jsonb
        then 'local_dropoff'
      else null
    end as fulfillment_method
  from public.orders
  where raw_checkout_session is not null
)
update public.orders as orders
set
  shipping_amount = derived_shipping.amount_total,
  shipping_method = coalesce(orders.shipping_method, derived_shipping.method),
  shipping_fulfillment_method = coalesce(
    orders.shipping_fulfillment_method,
    derived_shipping.fulfillment_method
  )
from derived_shipping
where orders.id = derived_shipping.id;
