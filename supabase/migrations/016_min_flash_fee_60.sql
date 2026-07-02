-- ค่าจัดส่ง Flash ขั้นต่ำ 60 บาท: ยกเรตในตาราง shipping_rates ที่ต่ำกว่า 60 ให้เป็น 60
-- (เก็บค่าที่สูงกว่า 60 ไว้เหมือนเดิม)
update public.shops
set shipping_rates = jsonb_set(
  shipping_rates,
  '{brackets}',
  (
    select jsonb_agg(
      case
        when (b->>'fee')::numeric < 60 then jsonb_set(b, '{fee}', to_jsonb(60))
        else b
      end
      order by (b->>'max')::numeric
    )
    from jsonb_array_elements(shipping_rates->'brackets') b
  )
)
where shipping_rates ? 'brackets';
