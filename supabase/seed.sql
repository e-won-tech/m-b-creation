insert into public.shops (slug, shop_name, tagline, liff_id, theme)
values (
  'demo-shop',
  'M&B CREATION',
  'สินค้าคุณภาพ พร้อมบริการผ่าน LINE',
  'YOUR_LIFF_ID',
  '{
    "bg":"#F3F8F0",
    "card":"#FFFFFF",
    "ink":"#1F2A1F",
    "muted":"#71806E",
    "primary":"#3B9344",
    "primaryDark":"#287034",
    "accent":"#8BC34A",
    "accentDark":"#6FA832",
    "line":"#DCEAD6",
    "soft":"#F8FCF6",
    "radius":"18px"
  }'::jsonb
)
on conflict (slug) do update set
  shop_name = excluded.shop_name,
  tagline = excluded.tagline,
  theme = excluded.theme,
  updated_at = now();

with demo_shop as (
  select id from public.shops where slug = 'demo-shop'
)
insert into public.categories (shop_id, name, sort_order, active)
select id, 'เครื่องดื่ม', 10, true from demo_shop
union all select id, 'เบเกอรี่', 20, true from demo_shop
union all select id, 'ของฝาก', 30, true from demo_shop
on conflict (shop_id, name) do update set
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

with demo_shop as (
  select id from public.shops where slug = 'demo-shop'
),
cats as (
  select id, shop_id, name from public.categories where shop_id = (select id from demo_shop)
)
insert into public.products (
  shop_id, category_id, category_name, name, pack, price, description,
  icon_name, stock, featured, active, sort_order
)
select shop_id, id, name, 'ชาเขียวมัทฉะพรีเมียม', 'ขวด 250 ml', 89, 'ชาเขียวหอมละมุน เหมาะสำหรับดื่มเย็นหรือจัดชุดของฝาก', 'cup', 12, true, true, 10 from cats where name = 'เครื่องดื่ม'
union all
select shop_id, id, name, 'กาแฟโคลด์บรูว์', 'ขวด 300 ml', 95, 'กาแฟสกัดเย็น รสกลม นุ่ม ไม่เปรี้ยว', 'coffee', 9, false, true, 20 from cats where name = 'เครื่องดื่ม'
union all
select shop_id, id, name, 'คุกกี้เนยสด', 'กล่อง 12 ชิ้น', 159, 'คุกกี้อบใหม่ เนยหอม เนื้อร่วนกำลังดี', 'cookie', 5, true, true, 30 from cats where name = 'เบเกอรี่'
union all
select shop_id, id, name, 'บราวนี่ดาร์กช็อก', 'กล่อง 6 ชิ้น', 180, 'บราวนี่เข้มข้น เนื้อหนึบ ใช้ดาร์กช็อกโกแลตแท้', 'chocolate', 3, false, true, 40 from cats where name = 'เบเกอรี่'
union all
select shop_id, id, name, 'ถุงผ้าแคนวาสลายร้าน', '1 ใบ', 120, 'ถุงผ้าหนา ใช้ซ้ำได้ เหมาะกับการช้อปประจำวัน', 'bag', 18, true, true, 50 from cats where name = 'ของฝาก'
union all
select shop_id, id, name, 'เซ็ตของขวัญมินิ', '1 เซ็ต', 299, 'รวมสินค้าขายดีในกล่องของขวัญ พร้อมการ์ดข้อความ', 'gift', 0, true, true, 60 from cats where name = 'ของฝาก';
