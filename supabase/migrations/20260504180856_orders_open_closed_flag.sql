alter table public.orders
add column if not exists is_closed boolean not null default false;

update public.orders
set is_closed = true
where status in ('fulfilled', 'canceled', 'refunded');

create index if not exists idx_orders_is_closed on public.orders(is_closed, created_at desc);
