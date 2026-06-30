# Data Layer / Supabase

ชุดนี้เพิ่มฐานข้อมูลและ service layer สำหรับเว็บร้านค้า LINE LIFF แบบหลายร้าน โดยใช้ `shop_id` แยกข้อมูลทุกตารางที่เป็นข้อมูลของร้าน

## ไฟล์ที่เกี่ยวข้อง

- `supabase/migrations/001_init.sql` สร้าง schema, index, trigger, RLS policies และ RPC สร้างออเดอร์
- `supabase/seed.sql` ข้อมูลทดสอบร้าน `demo-shop`
- `js/services/*.js` service layer สำหรับ Supabase, สินค้า, ออเดอร์, สมาชิก, แอดมิน และอัปโหลดรูป
- `js/config.js` ตั้งค่า Supabase แบบ opt-in

## วิธีเปิดใช้ Supabase

แก้ `js/config.js`:

```js
useSupabase: true,
supabaseUrl: "https://YOUR_PROJECT.supabase.co",
supabaseAnonKey: "YOUR_ANON_KEY",
shopSlug: "demo-shop"
```

ห้ามใส่ `service_role` key ใน frontend เด็ดขาด ใช้ได้เฉพาะ `anon` key เท่านั้น

## URL หน้าแอดมิน

ในเครื่องนี้เปิดได้ที่:

```txt
http://127.0.0.1:8000/admin.html
```

หน้าแอดมินรองรับ:

- Login ด้วย Supabase Auth
- ตรวจสิทธิ์จาก `shop_admins`
- แก้ชื่อร้าน, tagline, logo URL, LIFF ID และ theme JSON
- เพิ่ม/แก้/ซ่อนสินค้า
- ดูออเดอร์และอัปเดตสถานะ
- ดูสมาชิก คะแนน และยอดซื้อสะสม

## วิธีรัน migration และ seed

ใน Supabase SQL editor ให้รัน:

1. `supabase/migrations/001_init.sql`
2. `supabase/seed.sql`

หรือถ้าใช้ Supabase CLI ให้คัดลอกไฟล์ migration เข้า project แล้วรัน migration ตาม workflow ของทีม

## โครงสร้างข้อมูลหลัก

ตารางที่มีข้อมูลของร้านจะมี `shop_id`:

- `categories`
- `products`
- `orders`
- `order_items`
- `members`
- `member_point_logs`
- `audit_logs`

ตาราง `shops` ใช้ `slug` สำหรับ URL ร้าน เช่น `demo-shop`

## RLS / Security

เปิด Row Level Security ทุกตารางใน migration แล้ว

ลูกค้าทั่วไปอ่านได้เฉพาะ:

- `shops` ที่ `is_active = true`
- `categories` ที่ `active = true`
- `products` ที่ `active = true`

แอดมินอ่าน/แก้ไขได้เฉพาะร้านที่มี row ใน `shop_admins`

ออเดอร์ไม่ให้ลูกค้าอ่านรวมทั้งร้าน การสร้างออเดอร์ให้ผ่าน RPC:

```sql
public.create_order_from_cart(payload jsonb)
```

RPC จะคำนวณราคาจากฐานข้อมูลเอง ไม่ใช้ราคาที่ส่งจาก client

## การสร้างออเดอร์

Frontend เรียกผ่าน:

```js
ShopServices.orderService.createOrderFromCart(payload)
```

Payload ใช้ `product_id` และ `qty` เท่านั้นในรายการสินค้า:

```js
{
  shop_slug: "demo-shop",
  line_user_id: "Uxxxx",
  line_display_name: "Customer",
  customer_name: "คุณส้ม",
  pay_method: "โอนเงิน",
  note: "จัดส่งที่...",
  tax_required: false,
  tax_info: "",
  items: [
    { product_id: "uuid", qty: 2 }
  ]
}
```

RPC จะ:

- ตรวจร้านว่ายัง active
- ตรวจสินค้าว่าเป็นของร้านและ active
- ตรวจ stock
- snapshot ชื่อสินค้า ขนาด ราคา ลง `order_items`
- หัก stock ถ้า `stock` ไม่ใช่ `null`
- สร้าง/อัปเดตสมาชิกถ้ามี LINE user id
- ส่ง `message` กลับให้ LIFF ส่งเข้า LINE

## Stock

- `stock = null` ไม่จำกัดจำนวน
- `stock = 0` สินค้าหมด
- `stock > 0` จำนวนคงเหลือจริง

## คะแนนสมาชิก

Migration มี trigger เพิ่มคะแนนเมื่อ order เปลี่ยนสถานะเป็น `completed`

ค่าเริ่มต้น:

```txt
ทุก 100 บาท = 1 คะแนน
```

มี log ใน `member_point_logs`

## Import / Export Products

Export:

```js
const csv = await ShopServices.productService.exportProductsCsv(shopId);
```

Import:

```js
await ShopServices.productService.importProductsCsv(shopId, csv, {
  mode: "upsertByName"
});
```

CSV columns:

```txt
category_name,name,pack,price,description,icon_name,image_url,image2_url,stock,featured,active,sort_order
```

หมายเหตุ: โปรเจกต์นี้ใช้ `icon_name` แทน `emoji` เพื่อให้ UI ใช้ SVG icon ทั้งหมด

## Export Orders / Members

Orders:

```js
const orders = await ShopServices.orderService.loadOrders(shopId, {
  from: "2026-06-01",
  to: "2026-06-30"
});
const csv = ShopServices.orderService.ordersToCsv(orders);
```

Members:

```js
const members = await ShopServices.memberService.loadMembers(shopId);
const csv = ShopServices.memberService.membersToCsv(members);
```

## Cloudinary

ตั้งค่า unsigned upload preset ใน `js/config.js`:

```js
cloudinary: {
  cloudName: "YOUR_CLOUD_NAME",
  unsignedUploadPreset: "YOUR_UNSIGNED_PRESET"
}
```

Frontend อัปโหลดได้ด้วย unsigned preset เท่านั้น ห้ามใส่ Cloudinary API secret ใน frontend

การลบรูป Cloudinary ต้องทำผ่าน server หรือ edge function ที่เชื่อถือได้

## Backup / Data Safety

ควร backup อย่างน้อย:

- Export products CSV ก่อน import ทุกครั้ง
- Export orders CSV ตามช่วงวันที่
- Export members CSV เป็นรอบ ๆ

สำหรับ production ควรเปิด Supabase scheduled backup หรือ backup ผ่าน `pg_dump`

## Loading / Empty / Error State

หน้าร้านยังมี fallback เดิม:

- โหลดร้านไม่สำเร็จ ใช้ config ในไฟล์
- โหลดสินค้าไม่สำเร็จ ใช้ fallback products
- ไม่มีสินค้า แสดง empty state
- error ดิบถูก `console.error()` และแสดงข้อความไทยแบบสั้นให้ผู้ใช้

## Checklist

- [x] ทุก table ที่เกี่ยวกับร้านมี `shop_id`
- [x] เปิด RLS ทุก table
- [x] มี policy แยกลูกค้า/แอดมิน
- [x] แอดมินร้านหนึ่งดูข้อมูลร้านอื่นไม่ได้ผ่าน policy
- [x] หน้าร้านดึงเฉพาะสินค้า active เมื่อเปิด `useSupabase`
- [x] ระบบสั่งซื้อคำนวณราคาจาก database ผ่าน RPC
- [x] มี `order_items` snapshot ราคา ณ วันที่ซื้อ
- [x] stock ไม่ติดลบ
- [x] มี error handling ใน service layer
- [x] มี seed data
- [x] ไม่มี service role key ใน frontend
- [x] ไม่มี Cloudinary API secret ใน frontend
