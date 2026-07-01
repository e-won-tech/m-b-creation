-- ข้อมูลการชำระเงินของร้าน (QR/พร้อมเพย์, เลขบัญชี, ชื่อบัญชี, ธนาคาร)
alter table public.shops
  add column if not exists payment_bank text,
    add column if not exists payment_account_no text,
      add column if not exists payment_account_name text,
        add column if not exists payment_image_url text,
          add column if not exists payment_image_public_id text,
            add column if not exists payment_note text;
            