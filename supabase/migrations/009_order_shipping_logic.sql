-- create_order_from_cart: คิดค่าส่งตามกฎ + validate + เก็บเบอร์/ที่อยู่
-- กฎค่าส่ง:
--   Flash Express : 60 + (จำนวนชิ้นรวม - 1) * 10
--   ขนส่งเอกชน    : เฉพาะสินค้ากระสอบ ขั้นต่ำ 15 กระสอบ, ค่าส่งต้นทาง 60/กระสอบ
--   รับเอง        : ยอดสินค้าขั้นต่ำ 5,000 บาท, ค่าส่ง 0
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
  v_method text;
  v_total_qty integer := 0;
  v_sack_qty integer := 0;
  v_nonsack_qty integer := 0;
  v_shipping numeric(12,2) := 0;
  v_grand numeric(12,2) := 0;
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
    customer_phone, customer_address, pay_method, note, tax_required, tax_info, total
  )
  values (
    v_shop.id, v_order_no,
    nullif(payload->>'line_user_id', ''),
    nullif(payload->>'line_display_name', ''),
    nullif(payload->>'customer_name', ''),
    nullif(payload->>'customer_phone', ''),
    nullif(payload->>'customer_address', ''),
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
    v_total_qty := v_total_qty + v_qty;
    if v_product.is_sack then
      v_sack_qty := v_sack_qty + v_qty;
    else
      v_nonsack_qty := v_nonsack_qty + v_qty;
    end if;

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

  -- คิดค่าส่ง + validate ตามวิธีจัดส่ง
  v_method := coalesce(payload->>'shipping_method', '');
  if v_method like 'จัดส่งขนส่งเอกชน%' then
    if v_nonsack_qty > 0 then
      delete from public.orders where id = v_order_id;
      return jsonb_build_object('ok', false, 'error', 'ขนส่งเอกชนรับเฉพาะสินค้ากระสอบเท่านั้น');
    end if;
    if v_sack_qty < 15 then
      delete from public.orders where id = v_order_id;
      return jsonb_build_object('ok', false, 'error', 'ขนส่งเอกชนสั่งขั้นต่ำ 15 กระสอบ');
    end if;
    v_shipping := v_sack_qty * 60;
  elsif v_method = 'รับสินค้าด้วยตัวเอง' then
    if v_total < 5000 then
      delete from public.orders where id = v_order_id;
      return jsonb_build_object('ok', false, 'error', 'รับสินค้าเองสั่งขั้นต่ำ 5,000 บาท');
    end if;
    v_shipping := 0;
  else
    v_shipping := 60 + greatest(v_total_qty - 1, 0) * 10;
  end if;

  v_grand := v_total + v_shipping;
  update public.orders set total = v_grand, shipping_fee = v_shipping where id = v_order_id;

  if nullif(payload->>'line_user_id', '') is not null then
    insert into public.members (shop_id, line_user_id, display_name, picture_url, total_spent)
    values (
      v_shop.id, payload->>'line_user_id',
      nullif(payload->>'line_display_name', ''),
      nullif(payload->>'line_picture_url', ''),
      v_grand
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
    'ค่าสินค้า ฿' || trim(to_char(v_total, 'FM999999990.00')) || E'\n' ||
    'ค่าจัดส่ง ฿' || trim(to_char(v_shipping, 'FM999999990.00')) || E'\n' ||
    'ยอดรวม ฿' || trim(to_char(v_grand, 'FM999999990.00')) || E'\n' ||
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
    'subtotal', v_total,
    'shipping_fee', v_shipping,
    'total', v_grand,
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


-- get_member: เพิ่ม last_contact (ชื่อ/เบอร์/ที่อยู่ จากออเดอร์ล่าสุด) สำหรับ autofill
create or replace function public.get_member(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_member public.members%rowtype;
  v_history jsonb;
  v_last public.orders%rowtype;
begin
  if nullif(payload->>'line_user_id', '') is null then
    return jsonb_build_object('ok', false, 'error', 'ต้องเปิดผ่าน LINE');
  end if;

  select * into v_shop from public.shops
   where slug = payload->>'shop_slug' and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ไม่พบร้านค้านี้');
  end if;

  select * into v_member from public.members
   where shop_id = v_shop.id and line_user_id = payload->>'line_user_id';

  select * into v_last from public.orders
   where shop_id = v_shop.id and line_user_id = payload->>'line_user_id'
     and (customer_phone is not null or customer_address is not null or customer_name is not null)
   order by created_at desc limit 1;

  select coalesce(jsonb_agg(h.j order by h.created_at desc), '[]'::jsonb)
    into v_history
  from (
    select ord.created_at,
      jsonb_build_object(
        'date', ord.order_no,
        'status', ord.status,
        'total', ord.total,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', oi.product_name, 'pack', oi.pack, 'qty', oi.qty, 'price', oi.price
          ))
          from public.order_items oi where oi.order_id = ord.id
        ), '[]'::jsonb)
      ) as j
    from public.orders ord
    where ord.shop_id = v_shop.id
      and ord.line_user_id = payload->>'line_user_id'
    order by ord.created_at desc
    limit 10
  ) h;

  return jsonb_build_object(
    'ok', true,
    'member', case when v_member.id is null then null else jsonb_build_object(
      'display_name', v_member.display_name,
      'points', v_member.points,
      'total_spent', v_member.total_spent,
      'tier', v_member.tier
    ) end,
    'last_contact', case when v_last.id is null then null else jsonb_build_object(
      'name', v_last.customer_name,
      'phone', v_last.customer_phone,
      'address', v_last.customer_address
    ) end,
    'history', v_history
  );
end;
$$;

grant execute on function public.create_order_from_cart(jsonb) to anon, authenticated;
grant execute on function public.get_member(jsonb) to anon, authenticated;
