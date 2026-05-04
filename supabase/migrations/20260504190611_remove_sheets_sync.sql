drop trigger if exists trg_orders_sheets_sync on public.orders;

drop trigger if exists trg_order_items_sheets_sync on public.order_items;

drop function if exists public.enqueue_sheets_sync();
