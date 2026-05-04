create extension if not exists pg_net with schema extensions;

create or replace function public.enqueue_sheets_sync()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  record_id text;
  payload jsonb;
  function_url text := 'https://llihmmwtuktnhpjphbbi.supabase.co/functions/v1/sheets-sync';
begin
  if tg_table_name not in ('orders', 'order_items') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    record_id := old.id::text;
    payload := jsonb_build_object(
      'table', tg_table_name,
      'operation', tg_op,
      'old_record', jsonb_build_object('id', record_id)
    );
  else
    record_id := new.id::text;
    payload := jsonb_build_object(
      'table', tg_table_name,
      'operation', tg_op,
      'record', jsonb_build_object('id', record_id)
    );
  end if;

  if record_id is null or length(record_id) = 0 then
    raise warning 'sheets-sync trigger skipped: missing id (% %)', tg_table_name, tg_op;
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := function_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := payload
  );

  return coalesce(new, old);
exception
  when others then
    raise warning 'sheets-sync trigger failed (% %, id=%): %', tg_table_name, tg_op, record_id, sqlerrm;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_orders_sheets_sync on public.orders;
create trigger trg_orders_sheets_sync
after insert or update or delete on public.orders
for each row
execute function public.enqueue_sheets_sync();

drop trigger if exists trg_order_items_sheets_sync on public.order_items;
create trigger trg_order_items_sheets_sync
after insert or update or delete on public.order_items
for each row
execute function public.enqueue_sheets_sync();;
