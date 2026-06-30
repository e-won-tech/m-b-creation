-- รองรับค่าส่งตามกฎ + เก็บที่อยู่/เบอร์เพื่อ autofill ครั้งถัดไป
alter table public.products
  add column if not exists is_sack boolean not null default false;

alter table public.orders
  add column if not exists shipping_fee numeric(12,2) not null default 0,
  add column if not exists customer_phone text,
  add column if not exists customer_address text;
