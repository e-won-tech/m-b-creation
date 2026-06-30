-- ตัวจริงสำหรับ production: ปิด DEBUG (ไม่โชว์ SQLERRM ดิบให้ client)
create or replace function public.create_order_from_cart(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_order_id uuid;
  v_order_no text;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_subtotal numeric(12,2);
  v_member_id uuid;
  v_lines text[] := array[]::text[];
  v_index integer := 1;
  v_message text;
begin
  select * into v_shop from public.shops
   where slug = payload->>'shop_slug' and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ไม่พบร้านค้านี้');
  end if;

  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    return jsonb_build_object('ok', false, 'error', 'ตะกร้าต้องไม่ว่าง');
  end if;

  v_order_no := public.generate_order_no(v_shop.id);

  insert into public.orders (
    shop_id, order_no, line_user_id, line_display_name, customer_name,
    pay_method, note, tax_required, tax_info, total
  )
  values (
    v_shop.id, v_order_no,
    nullif(payload->>'line_user_id', ''),
    nullif(payload->>'line_display_name', ''),
    nullif(payload->>'customer_name', ''),
    nullif(payload->>'pay_method', ''),
    nullif(payload->>'note', ''),
    coalesce((payload->>'tax_required')::boolean, false),
    nullif(payload->>'tax_info', ''),
    0
  )
  returning id into v_order_id;

  foreach v_item in array array(select jsonb_array_elements(payload->'items'))
  loop
    v_qty := nullif(v_item->>'qty', '')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid qty';
    end if;

    select * into v_product from public.products
     where id = (v_item->>'product_id')::uuid and shop_id = v_shop.id and active = true
     for update;
    if not found then
      delete from public.orders where id = v_order_id;
      return jsonb_build_object('ok', false, 'error', 'สินค้าในตะกร้าหมดหรือถูกปิดการขายแล้ว');
    end if;

    if v_product.stock is not null and v_product.stock < v_qty then
      delete from public.orders where id = v_order_id;
      return jsonb_build_object('ok', false, 'error', 'สินค้า ' || v_product.name || ' คงเหลือ ' || v_product.stock || ' ชิ้น ไม่พอสำหรับจำนวนที่สั่ง');
    end if;

    v_subtotal := v_product.price * v_qty;
    v_total := v_total + v_subtotal;

    insert into public.order_items (shop_id, order_id, product_id, product_name, pack, qty, price, subtotal)
    values (v_shop.id, v_order_id, v_product.id, v_product.name, v_product.pack, v_qty, v_product.price, v_subtotal);

    if v_product.stock is not null then
      update public.products set stock = stock - v_qty where id = v_product.id;
    end if;

    v_lines := array_append(
      v_lines,
      v_index::text || '. ' || v_product.name || E'\n   ' || coalesce(v_product.pack, '') || E'\n   ' ||
      v_qty::text || ' x ฿' || trim(to_char(v_product.price, 'FM999999990.00')) || ' = ฿' || trim(to_char(v_subtotal, 'FM999999990.00'))
    );
    v_index := v_index + 1;
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  if nullif(payload->>'line_user_id', '') is not null then
    insert into public.members (shop_id, line_user_id, display_name, picture_url, total_spent)
    values (
      v_shop.id, payload->>'line_user_id',
      nullif(payload->>'line_display_name', ''),
      nullif(payload->>'line_picture_url', ''),
      v_total
    )
    on conflict (shop_id, line_user_id)
    do update set
      display_name = coalesce(excluded.display_name, public.members.display_name),
      picture_url = coalesce(excluded.picture_url, public.members.picture_url),
      total_spent = public.members.total_spent + excluded.total_spent,
      updated_at = now()
    returning id into v_member_id;
  end if;

  v_message :=
    'คำสั่งซื้อใหม่ - ' || v_shop.shop_name || E'\n' ||
    'เลขออเดอร์: ' || v_order_no || E'\n' ||
    '━━━━━━━━━━━━━━━' || E'\n' ||
    array_to_string(v_lines, E'\n') || E'\n' ||
    '━━━━━━━━━━━━━━━' || E'\n' ||
    'ยอดรวม ฿' || trim(to_char(v_total, 'FM999999990.00')) || E'\n' ||
    'ชำระเงิน: ' || coalesce(payload->>'pay_method', '-') || E'\n';

  if nullif(payload->>'customer_name', '') is not null then
    v_message := v_message || 'ผู้สั่ง: ' || (payload->>'customer_name') || E'\n';
  end if;
  if nullif(payload->>'note', '') is not null then
    v_message := v_message || 'หมายเหตุ: ' || (payload->>'note') || E'\n';
  end if;
  v_message := v_message || 'ถ้าแอดมินยืนยันยอดรวมแล้วแจ้งกลับด้วย';

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'total', v_total,
    'message', v_message
  );
exception
  when others then
    if v_order_id is not null then
      delete from public.orders where id = v_order_id;
    end if;
    return jsonb_build_object('ok', false, 'error', 'สร้างออเดอร์ไม่สำเร็จ');
end;
$$;

-- ลบข้อมูลทดสอบที่เกิดระหว่าง debug (ออเดอร์/สมาชิกทดสอบของวันนี้) แล้วคืนสต็อก
delete from public.members
 where shop_id = (select id from public.shops where slug = 'demo-shop')
   and line_user_id = 'Utest123';

delete from public.orders
 where shop_id = (select id from public.shops where slug = 'demo-shop')
   and created_at >= date_trunc('day', now());

-- คืนสต็อกกาแฟโคลด์บรูว์ที่ถูกหักจากการทดสอบ
update public.products set stock = 9
 where id = 'e1c74e31-dd19-445a-b582-d67cc2feb757';
