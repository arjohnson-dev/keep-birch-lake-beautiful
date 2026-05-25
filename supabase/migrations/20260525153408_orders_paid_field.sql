alter table public.orders
add column if not exists paid boolean not null default false;

update public.orders
set paid = true
where stripe_payment_intent_id is not null
  and status not in ('pending', 'canceled', 'refunded');
