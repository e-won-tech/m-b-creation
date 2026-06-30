-- เพิ่มช่อง "อัตราการใช้" แยกจากรายละเอียดสินค้า
alter table public.products
  add column if not exists usage_rate text;
