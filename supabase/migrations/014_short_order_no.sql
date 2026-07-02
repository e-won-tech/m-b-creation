-- เลขออเดอร์สั้นลง: prefix(2) + YYMMDD(6) + running(3)  เช่น DE260702003
create or replace function public.generate_order_no(target_shop_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_prefix text;
  v_today text := to_char(now(), 'YYMMDD');
  v_running integer;
begin
  select slug into v_slug from public.shops where id = target_shop_id;
  v_prefix := upper(left(regexp_replace(coalesce(v_slug, 'SHOP'), '[^a-zA-Z0-9]', '', 'g'), 2));
  if length(v_prefix) < 2 then
    v_prefix := 'SH';
  end if;

  select count(*) + 1
    into v_running
    from public.orders
   where shop_id = target_shop_id
     and created_at >= date_trunc('day', now())
     and created_at < date_trunc('day', now()) + interval '1 day';

  return v_prefix || v_today || lpad(v_running::text, 3, '0');
end;
$$;
