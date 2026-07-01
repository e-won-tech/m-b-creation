-- อนุญาตให้เจ้าของ/แอดมินร้านลบออเดอร์ได้ (order_items ลบตามด้วย FK cascade)
drop policy if exists "admins delete own orders" on public.orders;
create policy "admins delete own orders" on public.orders
  for delete using (public.is_shop_owner_or_admin(shop_id));
