alter table public.orders
add column if not exists payment_status text not null default 'unpaid'
check (payment_status in ('unpaid', 'partial_payment', 'paid'));

update public.orders
set payment_status = case
  when paid then 'paid'
  else 'unpaid'
end;
