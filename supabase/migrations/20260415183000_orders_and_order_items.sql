create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'order_status'
      and n.nspname = 'public'
  ) then
    create type public.order_status as enum (
      'pending',
      'paid',
      'in_progress',
      'fulfilled',
      'canceled',
      'refunded'
    );
  end if;
end
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,

  customer_email text,
  customer_name text,

  currency text not null,
  subtotal_amount integer not null check (subtotal_amount >= 0),
  total_amount integer not null check (total_amount >= 0),

  status public.order_status not null default 'paid',
  notes text,
  raw_checkout_session jsonb
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),

  lookup_key text not null,
  stripe_price_id text not null,

  product_name text not null,
  category text not null,
  garment text not null,
  design text not null,
  size text,

  quantity integer not null check (quantity > 0),
  unit_amount integer not null check (unit_amount >= 0),
  line_total integer not null check (line_total >= 0)
);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_session_id on public.orders(stripe_checkout_session_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_lookup_key on public.order_items(lookup_key);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;

create trigger trg_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
