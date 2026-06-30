create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  shop_name text not null,
  tagline text,
  logo_url text,
  logo_public_id text,
  liff_id text,
  theme jsonb not null default '{}'::jsonb,
  contact_line_url text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_admins (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  unique(shop_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  category_name text,
  name text not null,
  pack text,
  price numeric(12,2) not null default 0 check (price >= 0),
  description text,
  icon_name text not null default 'package',
  image_url text,
  image_public_id text,
  image2_url text,
  image2_public_id text,
  stock integer check (stock is null or stock >= 0),
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_no text,
  line_user_id text,
  line_display_name text,
  customer_name text,
  pay_method text,
  note text,
  tax_required boolean not null default false,
  tax_info text,
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'waiting_payment', 'paid', 'packing', 'shipped', 'completed', 'cancelled')),
  line_message_sent boolean not null default false,
  points_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, order_no)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  pack text,
  qty integer not null check (qty > 0),
  price numeric(12,2) not null check (price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  line_user_id text not null,
  display_name text,
  picture_url text,
  points integer not null default 0 check (points >= 0),
  total_spent numeric(12,2) not null default 0 check (total_spent >= 0),
  tier text not null default 'ทั่วไป' check (tier in ('ทั่วไป', 'เงิน', 'ทอง', 'แพลทินัม')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, line_user_id)
);

create table if not exists public.member_point_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_shop_active on public.products(shop_id, active);
create index if not exists idx_products_shop_featured on public.products(shop_id, featured);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_categories_shop_active on public.categories(shop_id, active);
create index if not exists idx_orders_shop_created on public.orders(shop_id, created_at desc);
create index if not exists idx_orders_shop_status on public.orders(shop_id, status);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_members_shop_line on public.members(shop_id, line_user_id);
create index if not exists idx_shop_admins_user on public.shop_admins(user_id);
create index if not exists idx_audit_logs_shop_created on public.audit_logs(shop_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_shops_updated_at on public.shops;
create trigger set_shops_updated_at before update on public.shops for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

drop trigger if exists set_members_updated_at on public.members;
create trigger set_members_updated_at before update on public.members for each row execute function public.set_updated_at();

create or replace function public.is_shop_admin(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_admins sa
    where sa.shop_id = target_shop_id
      and sa.user_id = auth.uid()
  );
$$;

create or replace function public.is_shop_owner_or_admin(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_admins sa
    where sa.shop_id = target_shop_id
      and sa.user_id = auth.uid()
      and sa.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_shop_owner(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_admins sa
    where sa.shop_id = target_shop_id
      and sa.user_id = auth.uid()
      and sa.role = 'owner'
  );
$$;

create or replace function public.generate_order_no(target_shop_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_prefix text;
  v_today text := to_char(now(), 'YYYYMMDD');
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

  return v_prefix || v_today || lpad(v_running::text, 4, '0');
end;
$$;

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
begin
  select *
    into v_shop
    from public.shops
   where slug = payload->>'shop_slug'
     and is_active = true;

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
    v_shop.id,
    v_order_no,
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

    select *
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and shop_id = v_shop.id
       and active = true
     for update;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'สินค้าในตะกร้าหมดหรือถูกปิดการขายแล้ว');
    end if;

    if v_product.stock is not null and v_product.stock < v_qty then
      return jsonb_build_object('ok', false, 'error', 'สินค้า ' || v_product.name || ' คงเหลือ ' || v_product.stock || ' ชิ้น ไม่พอสำหรับจำนวนที่สั่ง');
    end if;

    v_subtotal := v_product.price * v_qty;
    v_total := v_total + v_subtotal;

    insert into public.order_items (
      shop_id, order_id, product_id, product_name, pack, qty, price, subtotal
    )
    values (
      v_shop.id, v_order_id, v_product.id, v_product.name, v_product.pack, v_qty, v_product.price, v_subtotal
    );

    if v_product.stock is not null then
      update public.products
         set stock = stock - v_qty
       where id = v_product.id;
    end if;

    v_lines := array_append(v_lines, v_index || '. ' || v_product.name || E'\n   ' || coalesce(v_product.pack, '') || E'\n   ' || v_qty || ' x ฿' || trim(to_char(v_product.price, 'FM999999990.00')) || ' = ฿' || trim(to_char(v_subtotal, 'FM999999990.00')));
    v_index := v_index + 1;
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  if nullif(payload->>'line_user_id', '') is not null then
    insert into public.members (shop_id, line_user_id, display_name, picture_url, total_spent)
    values (
      v_shop.id,
      payload->>'line_user_id',
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

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'total', v_total,
    'message',
      'คำสั่งซื้อใหม่ - ' || v_shop.shop_name || E'\n' ||
      'เลขออเดอร์: ' || v_order_no || E'\n' ||
      '━━━━━━━━━━━━━━━' || E'\n' ||
      array_to_string(v_lines, E'\n') || E'\n' ||
      '━━━━━━━━━━━━━━━' || E'\n' ||
      'ยอดรวม ฿' || trim(to_char(v_total, 'FM999999990.00')) || E'\n' ||
      'ชำระเงิน: ' || coalesce(payload->>'pay_method', '-') || E'\n' ||
      case when nullif(payload->>'customer_name', '') is not null then 'ผู้สั่ง: ' || payload->>'customer_name' || E'\n' else '' end ||
      case when nullif(payload->>'note', '') is not null then 'หมายเหตุ: ' || payload->>'note' || E'\n' else '' end ||
      'ถ้าแอดมินยืนยันยอดรวมแล้วแจ้งกลับด้วย'
  );
exception
  when others then
    if v_order_id is not null then
      delete from public.orders where id = v_order_id;
    end if;
    return jsonb_build_object('ok', false, 'error', 'สร้างออเดอร์ไม่สำเร็จ');
end;
$$;

create or replace function public.award_points_for_completed_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_points integer;
begin
  if new.status = 'completed' and old.status is distinct from new.status and new.points_awarded = false and new.line_user_id is not null then
    select * into v_member
      from public.members
     where shop_id = new.shop_id
       and line_user_id = new.line_user_id
     for update;

    if found then
      v_points := floor(new.total / 100);
      if v_points > 0 then
        update public.members
           set points = points + v_points,
               tier = case
                 when total_spent >= 50000 then 'แพลทินัม'
                 when total_spent >= 20000 then 'ทอง'
                 when total_spent >= 5000 then 'เงิน'
                 else tier
               end
         where id = v_member.id;

        insert into public.member_point_logs (shop_id, member_id, order_id, points, reason)
        values (new.shop_id, v_member.id, new.id, v_points, 'order_completed');
      end if;

      new.points_awarded := true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists award_points_for_completed_order on public.orders;
create trigger award_points_for_completed_order
before update on public.orders
for each row execute function public.award_points_for_completed_order();

alter table public.shops enable row level security;
alter table public.shop_admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.members enable row level security;
alter table public.member_point_logs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "public read active shops" on public.shops;
create policy "public read active shops" on public.shops for select using (is_active = true or public.is_shop_admin(id));

drop policy if exists "admins update own shops" on public.shops;
create policy "admins update own shops" on public.shops for update using (public.is_shop_owner_or_admin(id)) with check (public.is_shop_owner_or_admin(id));

drop policy if exists "admins read own access" on public.shop_admins;
create policy "admins read own access" on public.shop_admins for select using (user_id = auth.uid() or public.is_shop_owner(shop_id));

drop policy if exists "owners manage shop admins" on public.shop_admins;
create policy "owners manage shop admins" on public.shop_admins for all using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories for select using (active = true and exists (select 1 from public.shops s where s.id = shop_id and s.is_active = true) or public.is_shop_admin(shop_id));

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all using (public.is_shop_owner_or_admin(shop_id)) with check (public.is_shop_owner_or_admin(shop_id));

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select using (active = true and exists (select 1 from public.shops s where s.id = shop_id and s.is_active = true) or public.is_shop_admin(shop_id));

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all using (public.is_shop_owner_or_admin(shop_id)) with check (public.is_shop_owner_or_admin(shop_id));

drop policy if exists "admins read own orders" on public.orders;
create policy "admins read own orders" on public.orders for select using (public.is_shop_admin(shop_id));

drop policy if exists "admins update own orders" on public.orders;
create policy "admins update own orders" on public.orders for update using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

drop policy if exists "admins read own order items" on public.order_items;
create policy "admins read own order items" on public.order_items for select using (public.is_shop_admin(shop_id));

drop policy if exists "admins read own members" on public.members;
create policy "admins read own members" on public.members for select using (public.is_shop_admin(shop_id));

drop policy if exists "admins update own members" on public.members;
create policy "admins update own members" on public.members for update using (public.is_shop_owner_or_admin(shop_id)) with check (public.is_shop_owner_or_admin(shop_id));

drop policy if exists "admins read own point logs" on public.member_point_logs;
create policy "admins read own point logs" on public.member_point_logs for select using (public.is_shop_admin(shop_id));

drop policy if exists "admins insert own point logs" on public.member_point_logs;
create policy "admins insert own point logs" on public.member_point_logs for insert with check (public.is_shop_owner_or_admin(shop_id));

drop policy if exists "admins read own audit logs" on public.audit_logs;
create policy "admins read own audit logs" on public.audit_logs for select using (public.is_shop_admin(shop_id));

drop policy if exists "admins insert own audit logs" on public.audit_logs;
create policy "admins insert own audit logs" on public.audit_logs for insert with check (public.is_shop_admin(shop_id));

grant execute on function public.create_order_from_cart(jsonb) to anon, authenticated;
grant execute on function public.is_shop_admin(uuid) to authenticated;
grant execute on function public.is_shop_owner_or_admin(uuid) to authenticated;
grant execute on function public.is_shop_owner(uuid) to authenticated;
