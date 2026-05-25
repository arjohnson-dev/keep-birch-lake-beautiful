alter table public.orders
alter column stripe_checkout_session_id drop not null;

alter table public.order_items
alter column stripe_price_id drop not null;
