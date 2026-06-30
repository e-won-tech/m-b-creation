# LIFF Shop Template

เว็บร้านค้าแบบ mobile-first สำหรับเปิดผ่าน LINE LIFF มีระบบสินค้า ตะกร้า ตรวจยอดกับ API, fallback คัดลอกออเดอร์, สมาชิก, ประวัติสั่งซื้อ และสั่งซื้อซ้ำ โดยแยกข้อมูลร้านไว้ที่ `js/config.js`

## วิธีเปลี่ยนชื่อร้าน

เปิด `js/config.js` แล้วแก้ค่า:

```js
shopName: "ชื่อร้านของคุณ",
shopTagline: "ข้อความสั้นใต้ชื่อร้าน"
```

## วิธีเปลี่ยนโลโก้

ถ้ามีไฟล์โลโก้ ให้วางไว้ใน `assets/logo.png` แล้วตั้งค่า:

```js
logoUrl: "assets/logo.png"
```

ถ้าใช้ URL รูปภาพ ให้ใส่ URL ตรง `logoUrl` ได้เลย ถ้าเว้นว่าง ระบบจะแสดง `logoFallback`

## วิธีเปลี่ยนธีมสี

เลือก preset ใน `js/config.js`:

```js
themePreset: "mbGreen"
```

ค่าที่มีให้ใช้คือ `greenOrange`, `mbGreen`, `blueClean`, `purpleSoft`

ถ้าต้องการสีเฉพาะร้าน ให้ใส่ object ใน `SHOP_CONFIG.theme` แทน `null` โดยใช้ key เช่น `bg`, `card`, `primary`, `accent`, `line`, `radius`

## วิธีเปลี่ยน LIFF ID

แก้ค่า:

```js
liffId: "LIFF_ID_ของร้าน"
```

ถ้าเว้นว่าง เว็บยังเปิดทดสอบใน browser ได้ แต่ฟีเจอร์ส่งข้อความเข้าแชทและแชร์ผ่าน LINE จะใช้ไม่ได้

## วิธีเปลี่ยน API URL

ใช้ 2 ส่วนนี้:

```js
productsApiUrl: "https://your-worker.workers.dev/products",
apiBaseUrl: "https://your-worker.workers.dev"
```

ระบบจะเรียก `POST /order/verify`, `POST /order/save`, `GET /member?uid=...` และ `POST /member/join` จาก `apiBaseUrl`

## วิธีใช้ Google Sheet CSV

นำลิงก์ CSV publish ของ Google Sheet มาใส่:

```js
sheetCsvUrl: "https://docs.google.com/spreadsheets/d/.../pub?output=csv"
```

หัวตารางรองรับทั้งไทยและอังกฤษ เช่น `name`, `ชื่อสินค้า`, `price`, `ราคา`, `stock`, `สต็อก`

## วิธีเพิ่มสินค้า

ช่วงทดสอบสามารถแก้ `FALLBACK_PRODUCTS` ใน `js/config.js` ได้ทันที ข้อมูลสินค้าแนะนำ:

```js
{
  id: 1,
  cat: "หมวดหมู่",
  name: "ชื่อสินค้า",
  pack: "ขนาดบรรจุ",
  price: 100,
  icon: "package",
  image: "https://...",
  image2: "https://...",
  desc: "รายละเอียดสินค้า",
  stock: 10,
  featured: true,
  active: true
}
```

## วิธี deploy

อัปโหลดทั้งโฟลเดอร์ขึ้น static hosting เช่น Cloudflare Pages, Netlify, Vercel, Firebase Hosting หรือ hosting ทั่วไป แล้วนำ URL ที่ได้ไปตั้งใน LINE LIFF endpoint URL

## ข้อควรระวังเรื่อง LINE LIFF

การส่งออเดอร์เข้าแชทต้องเปิดผ่าน LINE client และอยู่ในบริบทแชท เช่น `utou`, `room`, หรือ `group` ถ้าส่งไม่ได้ ระบบจะแสดงข้อความสรุปและปุ่มคัดลอกเพื่อไม่ให้ข้อมูลออเดอร์หาย

ราคาจากหน้าเว็บไม่ควรถูกใช้เป็นยอดจริงโดยไม่ตรวจสอบ ฝั่ง production ควรเปิด `apiBaseUrl` และทำ `/order/verify` เพื่อตรวจราคาและสต็อกบน server ก่อนส่งออเดอร์เสมอ

## ระบบข้อมูล Supabase

โปรเจกต์มี data layer สำหรับ Supabase เพิ่มแล้ว ดูรายละเอียด migration, RLS, seed, service layer, import/export และ backup ได้ที่ `README_DATA.md`

## หน้าแอดมิน

เปิดหน้าแอดมินได้ที่:

```txt
http://127.0.0.1:8000/admin.html
```

หลัง deploy ให้ใช้ URL ประมาณ:

```txt
https://your-domain.com/admin.html
```

หน้าแอดมินใช้ Supabase Auth และสิทธิ์จากตาราง `shop_admins` ก่อนใช้งานให้ตั้งค่า `useSupabase`, `supabaseUrl`, `supabaseAnonKey` และ `shopSlug` ใน `js/config.js`
