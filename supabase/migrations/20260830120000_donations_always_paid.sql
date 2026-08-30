create or replace function public.set_order_paid_if_donation(order_id_to_check uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if order_id_to_check is null then
    return;
  end if;

  if exists (
    select 1
    from public.order_items
    where order_items.order_id = order_id_to_check
      and order_items.category = 'donation'
  ) then
    update public.orders
    set
      paid = true,
      payment_status = 'paid'
    where orders.id = order_id_to_check
      and (
        orders.paid is distinct from true
        or orders.payment_status is distinct from 'paid'
      );
  end if;
end;
$$;

create or replace function public.keep_donation_order_paid_from_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.set_order_paid_if_donation(new.order_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform public.set_order_paid_if_donation(old.order_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.keep_donation_order_paid_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.order_items
    where order_items.order_id = new.id
      and order_items.category = 'donation'
  ) then
    new.paid := true;
    new.payment_status := 'paid';
  end if;

  return new;
end;
$$;

update public.orders
set
  paid = true,
  payment_status = 'paid'
where exists (
  select 1
  from public.order_items
  where order_items.order_id = orders.id
    and order_items.category = 'donation'
)
and (
  orders.paid is distinct from true
  or orders.payment_status is distinct from 'paid'
);

drop trigger if exists trg_keep_donation_order_paid_from_items on public.order_items;

create trigger trg_keep_donation_order_paid_from_items
after insert or update or delete on public.order_items
for each row
execute function public.keep_donation_order_paid_from_items();

drop trigger if exists trg_keep_donation_order_paid_from_order on public.orders;

create trigger trg_keep_donation_order_paid_from_order
before update of paid, payment_status on public.orders
for each row
execute function public.keep_donation_order_paid_from_order();
