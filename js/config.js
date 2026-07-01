const SHOP_CONFIG = {
  useSupabase: true,
  supabaseUrl: "https://ugpwksluhrflbmwoxqmt.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncHdrc2x1aHJmbGJtd294cW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3ODMzMzMsImV4cCI6MjA5ODM1OTMzM30.BmN_zRt7z7c1jJYEUWbAaDjfmwPpAu4jitLmL6Lf6b4",
  shopSlug: "demo-shop",
  liffId: "2010557164-GdxhSolO",
  // Basic ID ของ LINE OA (ขึ้นต้นด้วย @ เช่น "@mbcreation") ใช้ทำปุ่มกดส่งข้อความอัตโนมัติในการ์ดออเดอร์
  lineOaId: "",
  shopName: "M&B CREATION",
  shopTagline: "สินค้าคุณภาพ พร้อมบริการผ่าน LINE",
  logoUrl: "assets/logo.png",
  logoFallback: "leaf",
  productsApiUrl: "",
  sheetCsvUrl: "",
  apiBaseUrl: "",
  cloudinary: {
    cloudName: "dessiyxwk",
    unsignedUploadPreset: "product mb"
  },
  currency: "฿"
};

window.SHOP_CONFIG = SHOP_CONFIG;

const FALLBACK_PRODUCTS = [
  {
    id: 1,
    cat: "เครื่องดื่ม",
    name: "ชาเขียวมัทฉะพรีเมียม",
    pack: "ขวด 250 ml",
    price: 89,
    icon: "cup",
    image: "",
    image2: "",
    desc: "ชาเขียวหอมละมุน เหมาะสำหรับดื่มเย็นหรือจัดชุดของฝาก",
    stock: 12,
    featured: true,
    active: true
  },
  {
    id: 2,
    cat: "เบเกอรี่",
    name: "คุกกี้เนยสด",
    pack: "กล่อง 12 ชิ้น",
    price: 159,
    icon: "cookie",
    image: "",
    image2: "",
    desc: "คุกกี้อบใหม่ เนยหอม เนื้อร่วนกำลังดี",
    stock: 5,
    featured: true,
    active: true
  },
  {
    id: 3,
    cat: "ของใช้",
    name: "ถุงผ้าแคนวาสลายร้าน",
    pack: "1 ใบ",
    price: 120,
    icon: "bag",
    image: "",
    image2: "",
    desc: "ถุงผ้าหนา ใช้ซ้ำได้ เหมาะกับการช้อปประจำวัน",
    stock: 18,
    featured: true,
    active: true
  },
  {
    id: 4,
    cat: "ของฝาก",
    name: "เซ็ตของขวัญมินิ",
    pack: "1 เซ็ต",
    price: 299,
    icon: "gift",
    image: "",
    image2: "",
    desc: "รวมสินค้าขายดีในกล่องของขวัญ พร้อมการ์ดข้อความ",
    stock: 0,
    featured: true,
    active: true
  },
  {
    id: 5,
    cat: "เครื่องดื่ม",
    name: "กาแฟโคลด์บรูว์",
    pack: "ขวด 300 ml",
    price: 95,
    icon: "coffee",
    image: "",
    image2: "",
    desc: "กาแฟสกัดเย็น รสกลม นุ่ม ไม่เปรี้ยว",
    stock: 9,
    featured: false,
    active: true
  },
  {
    id: 6,
    cat: "เบเกอรี่",
    name: "บราวนี่ดาร์กช็อก",
    pack: "กล่อง 6 ชิ้น",
    price: 180,
    icon: "chocolate",
    image: "",
    image2: "",
    desc: "บราวนี่เข้มข้น เนื้อหนึบ ใช้ดาร์กช็อกโกแลตแท้",
    stock: 3,
    featured: false,
    active: true
  }
];

window.FALLBACK_PRODUCTS = FALLBACK_PRODUCTS;
