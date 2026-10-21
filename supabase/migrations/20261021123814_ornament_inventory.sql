create table public.shop_inventory (
  lookup_key text primary key,
  stock_limit integer not null check (stock_limit >= 0)
);
insert into public.shop_inventory values ('ornament', 25);

create table public.shop_inventory_reservations (
  session_id text primary key,
  lookup_key text not null references public.shop_inventory(lookup_key),
  quantity integer not null check (quantity > 0),
  status text not null default 'held' check (status in ('held', 'sold', 'released')),
  created_at timestamptz not null default now()
);
create index shop_inventory_reservations_active
  on public.shop_inventory_reservations(lookup_key) where status <> 'released';
alter table public.shop_inventory enable row level security;
alter table public.shop_inventory_reservations enable row level security;
revoke all on public.shop_inventory, public.shop_inventory_reservations from anon, authenticated;
grant all on public.shop_inventory, public.shop_inventory_reservations to service_role;

-- Invoker functions are usable only by the server's service role.
create function public.shop_inventory_available(item_lookup_key text)
returns integer language sql stable security invoker set search_path = '' as $$
  select greatest(0, i.stock_limit - coalesce((
    select sum(r.quantity)::integer from public.shop_inventory_reservations r
    where r.lookup_key = i.lookup_key and r.status <> 'released'
  ), 0) - coalesce((
    -- Include existing and manual paid orders without counting a reserved
    -- Stripe checkout twice when its order webhook arrives.
    select sum(oi.quantity)::integer
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.lookup_key = i.lookup_key and o.paid = true
      and not exists (
        select 1 from public.shop_inventory_reservations r
        where r.session_id = o.stripe_checkout_session_id and r.lookup_key = i.lookup_key
          and r.status <> 'released'
      )
  ), 0)) from public.shop_inventory i where i.lookup_key = item_lookup_key;
$$;

create function public.reserve_shop_inventory(
  item_lookup_key text, checkout_session_id text, requested_quantity integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare existing public.shop_inventory_reservations;
begin
  if requested_quantity is null or requested_quantity < 1 then
    raise exception 'Invalid inventory quantity';
  end if;
  -- Serialize purchases of this item across all server instances.
  perform 1 from public.shop_inventory where lookup_key = item_lookup_key for update;
  if not found then raise exception 'Unknown inventory item'; end if;
  select * into existing from public.shop_inventory_reservations where session_id = checkout_session_id;
  if found then
    return existing.lookup_key = item_lookup_key and existing.quantity = requested_quantity
      and existing.status <> 'released';
  end if;
  if public.shop_inventory_available(item_lookup_key) < requested_quantity then return false; end if;
  insert into public.shop_inventory_reservations(session_id, lookup_key, quantity)
    values (checkout_session_id, item_lookup_key, requested_quantity);
  return true;
end;
$$;
revoke all on function public.shop_inventory_available(text) from public, anon, authenticated;
revoke all on function public.reserve_shop_inventory(text, text, integer) from public, anon, authenticated;
grant execute on function public.shop_inventory_available(text) to service_role;
grant execute on function public.reserve_shop_inventory(text, text, integer) to service_role;
