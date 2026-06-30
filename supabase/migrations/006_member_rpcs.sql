-- RPC ฝั่งลูกค้า (storefront) สำหรับระบบสมาชิกผ่าน Supabase แทน external API
-- ลูกค้าอ่าน members/orders ของตัวเองไม่ได้ตรงๆ เพราะ RLS — จึงผ่าน security definer RPC

-- สมัคร/อัปเดตสมาชิกจาก LINE user
create or replace function public.join_member(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_member public.members%rowtype;
begin
  if nullif(payload->>'line_user_id', '') is null then
    return jsonb_build_object('ok', false, 'error', 'ต้องเปิดผ่าน LINE เพื่อสมัครสมาชิก');
  end if;

  select * into v_shop from public.shops
   where slug = payload->>'shop_slug' and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ไม่พบร้านค้านี้');
  end if;

  insert into public.members (shop_id, line_user_id, display_name, picture_url)
  values (
    v_shop.id, payload->>'line_user_id',
    nullif(payload->>'display_name', ''),
    nullif(payload->>'picture_url', '')
  )
  on conflict (shop_id, line_user_id) do update set
    display_name = coalesce(excluded.display_name, public.members.display_name),
    picture_url = coalesce(excluded.picture_url, public.members.picture_url),
    updated_at = now()
  returning * into v_member;

  return jsonb_build_object('ok', true, 'member', jsonb_build_object(
    'display_name', v_member.display_name,
    'points', v_member.points,
    'total_spent', v_member.total_spent,
    'tier', v_member.tier
  ));
end;
$$;

-- ดึงข้อมูลสมาชิก + ประวัติสั่งซื้อ 10 รายการล่าสุด
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
    'history', v_history
  );
end;
$$;

grant execute on function public.join_member(jsonb) to anon, authenticated;
grant execute on function public.get_member(jsonb) to anon, authenticated;
