-- ค่าส่ง Flash คิดตามน้ำหนัก: เพิ่มน้ำหนักต่อสินค้า + ตารางช่วงน้ำหนัก/ราคาในร้าน
alter table public.products
  add column if not exists weight_kg numeric(8,2) not null default 1;

alter table public.shops
  add column if not exists shipping_rates jsonb;

-- เรตเริ่มต้น (ปรับได้ในหน้าแอดมิน) — brackets: ถ้าน้ำหนักรวม <= max ใช้ fee นั้น
-- ถ้าเกิน max สูงสุด: fee สูงสุด + (กก.ส่วนเกินปัดขึ้น) * over_per_kg
update public.shops
   set shipping_rates = '{
     "brackets": [
       {"max": 1,  "fee": 40},
       {"max": 3,  "fee": 55},
       {"max": 5,  "fee": 70},
       {"max": 10, "fee": 110},
       {"max": 15, "fee": 180},
       {"max": 20, "fee": 250},
       {"max": 25, "fee": 300}
     ],
     "over_per_kg": 15
   }'::jsonb
 where shipping_rates is null;
