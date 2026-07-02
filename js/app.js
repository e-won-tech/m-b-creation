const HEADER_MAP = {
  category: ["category", "หมวดหมู่", "หมวด", "ประเภท", "cat"],
  name: ["name", "ชื่อ", "ชื่อสินค้า"],
  pack: ["pack", "ขนาด", "ขนาดบรรจุ", "บรรจุ"],
  price: ["price", "ราคา"],
  emoji: ["emoji", "อิโมจิ", "ไอคอน"],
  image: ["image", "img", "รูป", "รูปภาพ", "url", "ลิงก์รูป"],
  image2: ["image2", "รูป2", "รูปเนื้อ", "รูปเนื้อสินค้า"],
  desc: ["desc", "description", "รายละเอียด", "คำอธิบาย"],
  active: ["active", "แสดง", "สถานะ", "เปิดขาย"],
  stock: ["stock", "คงเหลือ", "สต็อก", "สต๊อก", "จำนวน", "จำนวนคงเหลือ"],
  featured: ["featured", "แนะนำ", "หน้าแรก"]
};

const ICON_PATHS = {
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  box: '<path d="m3 8 9-5 9 5-9 5-9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H7"/>',
  chocolate: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M5 10h14M5 15h14M10 4v16M14 4v16"/>',
  coffee: '<path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/><path d="M16 10h2a2 2 0 1 1 0 4h-2"/><path d="M6 3v2M10 3v2M14 3v2"/>',
  cookie: '<circle cx="12" cy="12" r="8"/><circle cx="9" cy="9" r="1"/><circle cx="14.5" cy="10.5" r="1"/><circle cx="11" cy="15" r="1"/><path d="M16.5 15.5h.01"/>',
  cup: '<path d="M6 7h12l-1 12H7L6 7Z"/><path d="M8 4h8"/><path d="M9 11h6"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M4 13h16M12 9v11"/><path d="M12 9H8a2 2 0 1 1 2-2c0 2 2 2 2 2Zm0 0h4a2 2 0 1 0-2-2c0 2-2 2-2 2Z"/>',
  leaf: '<path d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14Z"/><path d="M5 19 15 9"/>',
  package: '<path d="m3 8 9-5 9 5-9 5-9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M7.5 5.5 16.5 10.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};

let PRODUCTS = [];
let selectedCat = "แนะนำ";
let detailProductId = null;
let detailQty = 1;
let CURRENT_SHOP = null;
let MEMBER_UID = "";
let MEMBER_NAME = "";
let MEMBER_PROFILE = null;
let MEMBER_DATA = null;
let LAST_CONTACT = null;

const cart = {};
const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  renderStaticIcons();

  // ปุ่มในการ์ดออเดอร์เปิดหน้านี้พร้อม action=send → ส่งข้อความเข้าแชทแล้วปิดทันที (ไม่ต้องโหลดร้าน)
  const params = new URLSearchParams(window.location.search);
  if (params.get("action") === "send") {
    await initLiff();
    const sent = await autoSendToChat(params.get("text") || "");
    if (sent) return;
  }

  await hydrateShopFromDataLayer();
  applyBranding();
  renderSkeleton();

  PRODUCTS = await loadProducts();
  renderCats();
  renderGrid();
  updateBadge();

  await initLiff();
  handleQueryString();
}

function bindElements() {
  Object.assign(els, {
    logo: document.querySelector("#logo"),
    shopName: document.querySelector("#shopName"),
    shopTag: document.querySelector("#shopTag"),
    searchInput: document.querySelector("#searchInput"),
    statusBanner: document.querySelector("#statusBanner"),
    catRow: document.querySelector("#catRow"),
    productGrid: document.querySelector("#productGrid"),
    sectionTitle: document.querySelector("#sectionTitle"),
    sectionSub: document.querySelector("#sectionSub"),
    productCount: document.querySelector("#productCount"),
    badge: document.querySelector("#badge"),
    cartBtn: document.querySelector("#cartBtn"),
    memberBtn: document.querySelector("#memberBtn"),
    sheetLayer: document.querySelector("#sheetLayer"),
    sheetBody: document.querySelector("#sheetBody"),
    toastWrap: document.querySelector("#toastWrap"),
    lightbox: document.querySelector("#lightbox"),
    lightboxImg: document.querySelector("#lightboxImg"),
    lightboxClose: document.querySelector("#lightboxClose")
  });
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => renderGrid());
  els.cartBtn.addEventListener("click", openCart);
  els.memberBtn.addEventListener("click", openMember);
  els.sheetLayer.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-sheet]")) closeSheet();
  });
  els.lightbox.addEventListener("click", closeLightbox);
  els.lightboxClose.addEventListener("click", closeLightbox);
}

function applyBranding() {
  document.title = `${SHOP_CONFIG.shopName} - สั่งซื้อผ่าน LINE`;
  els.shopName.textContent = SHOP_CONFIG.shopName;
  els.shopTag.textContent = SHOP_CONFIG.shopTagline;

  if (SHOP_CONFIG.logoUrl) {
    els.logo.innerHTML = `<img src="${escapeAttr(SHOP_CONFIG.logoUrl)}" alt="${escapeAttr(SHOP_CONFIG.shopName)}">`;
    document.body.style.setProperty("--logo-bg", `url("${SHOP_CONFIG.logoUrl}")`);
  } else {
    els.logo.innerHTML = iconSvg(SHOP_CONFIG.logoFallback || "leaf", "brand-icon");
  }
}

async function hydrateShopFromDataLayer() {
  if (!SHOP_CONFIG.useSupabase || !window.ShopServices?.shopService) return;
  try {
    CURRENT_SHOP = await window.ShopServices.shopService.getShopBySlug(SHOP_CONFIG.shopSlug);
    SHOP_CONFIG.shopName = CURRENT_SHOP.shop_name || SHOP_CONFIG.shopName;
    SHOP_CONFIG.shopTagline = CURRENT_SHOP.tagline || SHOP_CONFIG.shopTagline;
    SHOP_CONFIG.logoUrl = CURRENT_SHOP.logo_url || SHOP_CONFIG.logoUrl;
    SHOP_CONFIG.liffId = CURRENT_SHOP.liff_id || SHOP_CONFIG.liffId;
  } catch (error) {
    console.error(error);
    showBanner("โหลดข้อมูลร้านไม่สำเร็จ ใช้ข้อมูลตั้งค่าในไฟล์แทน");
  }
}

async function loadProducts() {
  let products = [];

  if (SHOP_CONFIG.useSupabase && CURRENT_SHOP?.id && window.ShopServices?.productService) {
    try {
      products = await window.ShopServices.productService.loadProducts(CURRENT_SHOP.id, { activeOnly: true });
      products = normalizeProducts(products);
      if (products.length) return products;
      showBanner("ยังไม่มีสินค้าในร้านนี้ ใช้ข้อมูลสำรองชั่วคราว");
    } catch (error) {
      console.error(error);
      showBanner("โหลดสินค้าไม่สำเร็จ ใช้ข้อมูลสำรองแทน");
    }
  }

  if (SHOP_CONFIG.productsApiUrl) {
    try {
      products = await fetchJson(SHOP_CONFIG.productsApiUrl);
      products = normalizeProducts(Array.isArray(products) ? products : products.products);
      if (products.length) return products;
    } catch (error) {
      showBanner("โหลดข้อมูลจาก API ไม่สำเร็จ กำลังลองแหล่งข้อมูลสำรอง");
    }
  }

  if (SHOP_CONFIG.sheetCsvUrl) {
    try {
      const csv = await fetchText(SHOP_CONFIG.sheetCsvUrl);
      products = normalizeProducts(parseCsvProducts(csv));
      if (products.length) return products;
    } catch (error) {
      showBanner("โหลด Google Sheet ไม่สำเร็จ ใช้ข้อมูลสำรองแทน");
    }
  }

  if (!products.length) {
    if (SHOP_CONFIG.productsApiUrl || SHOP_CONFIG.sheetCsvUrl) showBanner("ใช้ข้อมูลสินค้าสำรองชั่วคราว");
    products = normalizeProducts(FALLBACK_PRODUCTS);
  }

  return products;
}

async function fetchJson(url, options = {}, timeout = 8000) {
  const text = await fetchText(url, options, timeout);
  return JSON.parse(text);
}

async function fetchText(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseCsvProducts(csv) {
  const rows = parseCsv(csv).filter((row) => row.some(Boolean));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => String(header).trim().toLowerCase());
  return rows.slice(1).map((row, index) => {
    const item = { id: index + 1 };
    for (const [field, aliases] of Object.entries(HEADER_MAP)) {
      const headerIndex = aliases.findIndex((name) => headers.includes(String(name).toLowerCase()));
      if (headerIndex >= 0) item[field === "category" ? "cat" : field] = row[headers.indexOf(String(aliases[headerIndex]).toLowerCase())];
    }
    return item;
  });
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  rows.push(row);
  return rows;
}

function normalizeProducts(products = []) {
  return products
    .map((item, index) => ({
      id: item.id || index + 1,
      cat: String(item.cat || item.category || item.category_name || "ทั่วไป").trim(),
      name: String(item.name || "สินค้าไม่มีชื่อ").trim(),
      pack: String(item.pack || "").trim(),
      price: Number(item.price || 0),
      icon: item.icon || item.icon_name || iconForCategory(item.cat || item.category_name),
      image: item.image || item.image_url || "",
      image2: item.image2 || item.image2_url || "",
      desc: item.desc || item.description || "",
      usage: item.usage || item.usage_rate || "",
      isSack: toBool(item.isSack ?? item.is_sack ?? false),
      weightKg: Number(item.weightKg ?? item.weight_kg ?? 1) || 1,
      stock: item.stock === null || item.stock === undefined || item.stock === "" ? null : Number(item.stock),
      featured: toBool(item.featured),
      active: item.active === undefined ? true : toBool(item.active)
    }))
    .filter((item) => item.active);
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  return !["false", "0", "no", "ปิด", "ไม่แสดง"].includes(String(value ?? "").trim().toLowerCase());
}

function renderSkeleton() {
  els.productGrid.innerHTML = `<div class="skeleton-grid">${Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join("")}</div>`;
}

function renderCats() {
  const cats = ["แนะนำ", ...new Set(PRODUCTS.map((product) => product.cat))];
  els.catRow.innerHTML = cats
    .map((cat) => `<button class="cat-chip ${cat === selectedCat ? "is-active" : ""}" type="button" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`)
    .join("");

  els.catRow.querySelectorAll("[data-cat]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCat = button.dataset.cat;
      els.searchInput.value = "";
      renderCats();
      renderGrid();
    });
  });
}

function renderGrid() {
  const query = els.searchInput.value.trim().toLowerCase();
  let products = PRODUCTS;

  if (query) {
    products = PRODUCTS.filter((product) => [product.name, product.desc, product.cat].some((value) => String(value).toLowerCase().includes(query)));
    els.sectionTitle.textContent = "ผลการค้นหา";
    els.sectionSub.textContent = `ค้นทั้งร้านจาก "${els.searchInput.value.trim()}"`;
  } else if (selectedCat === "แนะนำ") {
    products = PRODUCTS.filter((product) => product.featured);
    els.sectionTitle.textContent = "สินค้าแนะนำ";
    els.sectionSub.textContent = "รายการยอดนิยมของร้าน";
  } else {
    products = PRODUCTS.filter((product) => product.cat === selectedCat);
    els.sectionTitle.textContent = selectedCat;
    els.sectionSub.textContent = "เลือกสินค้าแล้วเพิ่มลงตะกร้า";
  }

  els.productCount.textContent = `${products.length} รายการ`;

  if (!products.length) {
    const message = query ? `ไม่พบสินค้าที่ตรงกับ “${escapeHtml(els.searchInput.value.trim())}”` : "ยังไม่มีสินค้าในหมวดนี้";
    els.productGrid.innerHTML = `<div class="empty-state">${message}</div>`;
    return;
  }

  els.productGrid.innerHTML = products.map(renderProductCard).join("");
  els.productGrid.querySelectorAll("[data-open-product]").forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.openProduct));
  });
  els.productGrid.querySelectorAll("[data-quick-add]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      quickAdd(button.dataset.quickAdd);
    });
  });
}

function renderProductCard(product) {
  const out = product.stock !== null && product.stock <= 0;
  return `
    <article class="product-card ${out ? "is-out" : ""}" data-open-product="${escapeAttr(product.id)}">
      <div class="product-media">
        ${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}" loading="lazy">` : iconSvg(product.icon, "product-icon")}
        ${out ? `<span class="sold-out-badge">สินค้าหมด</span>` : ""}
        ${product.pack ? `<span class="size-label">${escapeHtml(product.pack)}</span>` : ""}
      </div>
      <div class="card-body">
        <div class="pack">${escapeHtml(product.cat || "")}</div>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <div class="card-foot">
          <div class="price">${money(product.price)}</div>
          <button class="add-btn" type="button" data-quick-add="${escapeAttr(product.id)}" ${out ? "disabled" : ""} aria-label="เพิ่ม ${escapeAttr(product.name)}">${addIconSvg()}</button>
        </div>
      </div>
    </article>
  `;
}

function openDetail(id) {
  const product = findProduct(id);
  if (!product) return;
  detailProductId = product.id;
  detailQty = 1;
  renderDetail(product);
}

function renderDetail(product) {
  const out = product.stock !== null && product.stock <= 0;
  const images = [product.image, product.image2].filter(Boolean);
  let mediaInner;
  if (images.length > 1) {
    mediaInner = `
      <div class="detail-slider" id="detailSlider">
        ${images.map((src) => `<div class="detail-slide"><img src="${escapeAttr(src)}" alt="${escapeAttr(product.name)}"></div>`).join("")}
      </div>
      <button class="slider-nav prev" type="button" id="slidePrev" aria-label="รูปก่อนหน้า">‹</button>
      <button class="slider-nav next" type="button" id="slideNext" aria-label="รูปถัดไป">›</button>
      <div class="slider-dots" id="sliderDots">${images.map((_, i) => `<span class="${i === 0 ? "is-active" : ""}"></span>`).join("")}</div>`;
  } else if (images.length === 1) {
    mediaInner = `<img src="${escapeAttr(images[0])}" alt="${escapeAttr(product.name)}">`;
  } else {
    mediaInner = iconSvg(product.icon, "product-icon");
  }
  openSheet(`
    <div class="detail-view">
      <div class="detail-media ${out ? "is-out" : ""}">
        ${mediaInner}
        ${out ? `<span class="sold-out-badge">สินค้าหมด</span>` : ""}
      </div>
      <h2 class="sheet-title" id="sheetTitle">${escapeHtml(product.name)}</h2>
      <div class="meta-row">
        <span class="meta-chip">${escapeHtml(product.cat)}</span>
        <span class="meta-chip">${escapeHtml(product.pack || "ไม่ระบุขนาด")}</span>
        <span class="meta-chip">คงเหลือ ${escapeHtml(displayStock(product.stock))}</span>
      </div>
      <div class="detail-section">
        <h3 class="detail-heading">รายละเอียดสินค้า</h3>
        <p class="detail-desc">${escapeHtml(product.desc || "ไม่มีรายละเอียดเพิ่มเติม")}</p>
      </div>
      ${product.usage ? `
      <div class="detail-section">
        <h3 class="detail-heading">อัตราการใช้</h3>
        <p class="detail-desc">${escapeHtml(product.usage)}</p>
      </div>` : ""}
      <div class="cart-total price-row"><span>ราคา</span><strong>${money(product.price)}</strong></div>
      <div class="qty-row">
        <strong>จำนวน</strong>
        <div class="qty-control">
          <button class="qty-btn" type="button" id="detailMinus" ${detailQty <= 1 ? "disabled" : ""}>-</button>
          <span class="qty-value" id="detailQty">${detailQty}</span>
          <button class="qty-btn" type="button" id="detailPlus" ${product.stock !== null && detailQty >= product.stock || out ? "disabled" : ""}>+</button>
        </div>
      </div>
      <div class="action-stack">
        <div class="action-row">
          <button class="primary-btn" type="button" id="detailAdd" ${out ? "disabled" : ""}>เพิ่มลงตะกร้า</button>
          <button class="secondary-btn" type="button" id="askProduct">สอบถามสินค้ากับร้าน</button>
        </div>
        <button class="ghost-btn" type="button" id="shareProduct">แชร์สินค้าผ่านไลน์</button>
      </div>
    </div>
  `);

  document.querySelector("#detailMinus")?.addEventListener("click", () => changeDetailQty(-1));
  document.querySelector("#detailPlus")?.addEventListener("click", () => changeDetailQty(1));
  document.querySelector("#detailAdd")?.addEventListener("click", addFromDetail);
  document.querySelector("#askProduct")?.addEventListener("click", () => askProduct(product));
  document.querySelector("#shareProduct")?.addEventListener("click", () => shareProduct(product));
  bindDetailSlider();
}

function bindDetailSlider() {
  const slider = document.querySelector("#detailSlider");
  if (!slider) return;
  const dots = Array.from(document.querySelectorAll("#sliderDots span"));
  document.querySelector("#slidePrev")?.addEventListener("click", () => slider.scrollBy({ left: -slider.clientWidth, behavior: "smooth" }));
  document.querySelector("#slideNext")?.addEventListener("click", () => slider.scrollBy({ left: slider.clientWidth, behavior: "smooth" }));
  slider.addEventListener("scroll", () => {
    const index = Math.round(slider.scrollLeft / slider.clientWidth);
    dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
  });
}

function changeDetailQty(delta) {
  const product = findProduct(detailProductId);
  if (!product) return;
  detailQty = product.stock === null ? Math.max(1, detailQty + delta) : clamp(detailQty + delta, 1, product.stock);
  renderDetail(product);
}

function quickAdd(id) {
  addToCart(id, 1);
}

function addFromDetail() {
  if (!detailProductId) return;
  addToCart(detailProductId, detailQty);
  closeSheet();
}

function addToCart(id, qty) {
  const product = findProduct(id);
  if (!product) return;
  if (product.stock !== null && product.stock <= 0) return toast("สินค้าหมดแล้ว");
  const current = cart[product.id]?.qty || 0;
  const next = current + qty;
  if (product.stock !== null && next > product.stock) return toast(`เพิ่มได้ไม่เกินสต็อก ${product.stock} ชิ้น`);
  cart[product.id] = { id: product.id, qty: next };
  updateBadge();
  toast("เพิ่มสินค้าในตะกร้าแล้ว");
}

function changeQty(id, delta) {
  const product = findProduct(id);
  if (!product || !cart[id]) return;
  const next = cart[id].qty + delta;
  if (next <= 0) {
    delete cart[id];
  } else if (product.stock !== null && next > product.stock) {
    toast(`เพิ่มได้ไม่เกินสต็อก ${product.stock} ชิ้น`);
  } else {
    cart[id].qty = next;
  }
  updateBadge();
  renderCart();
}

function cartItems() {
  return Object.values(cart)
    .map((entry) => ({ ...findProduct(entry.id), qty: entry.qty }))
    .filter((item) => item.id);
}

function cartCount() {
  return cartItems().reduce((sum, item) => sum + item.qty, 0);
}

function cartTotal() {
  return cartItems().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function updateBadge() {
  els.badge.textContent = cartCount();
}

function openCart() {
  renderCart();
}

function renderCart() {
  const items = cartItems();
  if (!items.length) {
    openSheet(`
      <h2 class="sheet-title" id="sheetTitle">ตะกร้าสินค้า</h2>
      <div class="empty-state">ตะกร้ายังว่าง เลือกสินค้าจากหน้าร้านได้เลย</div>
    `);
    return;
  }

  openSheet(`
    <h2 class="sheet-title" id="sheetTitle">ตะกร้าสินค้า</h2>
    <div class="cart-list">
      ${items.map(renderCartItem).join("")}
    </div>
    <div class="cart-total"><span>รวม ${cartCount()} ชิ้น</span><strong>${money(cartTotal())}</strong></div>
    <form class="form-grid" id="orderForm">
      <div class="field">
        <span>วิธีการจัดส่ง</span>
        <div class="radio-group" id="shippingGroup">
          ${shippingOptionsHtml(items)}
        </div>
      </div>
      <div class="field">
        <span>วิธีชำระเงิน</span>
        <div class="radio-group" id="payGroup"></div>
      </div>
      <label class="field">
        <span>ชื่อผู้สั่ง</span>
        <input id="customerInput" value="${escapeAttr(LAST_CONTACT?.name || MEMBER_NAME || "")}" placeholder="เช่น คุณมายด์">
      </label>
      <label class="field">
        <span>เบอร์โทรศัพท์</span>
        <input id="phoneInput" type="tel" inputmode="tel" autocomplete="tel" value="${escapeAttr(LAST_CONTACT?.phone || "")}" placeholder="08x-xxx-xxxx">
      </label>
      <div class="detail-stack" id="shippingDetails"></div>
      <label class="field">
        <span>หมายเหตุถึงร้าน (ถ้ามี)</span>
        <textarea id="noteInput" placeholder="ข้อความเพิ่มเติมถึงร้าน"></textarea>
      </label>
      <label class="check-row">
        <input id="taxCheck" type="checkbox">
        ต้องการใบกำกับภาษี
      </label>
      <label class="field is-hidden" id="taxField">
        <span>ข้อมูลใบกำกับภาษี</span>
        <textarea id="taxInput" placeholder="ชื่อบริษัท / เลขประจำตัวผู้เสียภาษี / ที่อยู่"></textarea>
      </label>
      <div class="order-summary-box" id="orderSummary"></div>
      <button class="primary-btn" type="submit">ยืนยันและส่งออเดอร์เข้า LINE</button>
    </form>
  `);

  document.querySelectorAll("[data-cart-delta]").forEach((button) => {
    button.addEventListener("click", () => changeQty(button.dataset.cartId, Number(button.dataset.cartDelta)));
  });
  document.querySelector("#taxCheck").addEventListener("change", (event) => {
    document.querySelector("#taxField").classList.toggle("is-hidden", !event.target.checked);
  });
  document.querySelectorAll('input[name="shipping"]').forEach((input) => {
    input.addEventListener("change", () => onShippingChange(input.value));
  });
  onShippingChange(document.querySelector('input[name="shipping"]:checked')?.value);
  document.querySelector("#orderForm").addEventListener("submit", submitOrder);
}

// ตัวเลือกวิธีจัดส่ง — ถ้ายอด/จำนวนไม่ถึงเงื่อนไข ให้ disabled (เทากดไม่ได้) พร้อมเหตุผล
function shippingOptionsHtml(items) {
  const options = [
    { value: "จัดส่งขนส่ง Flash Express", label: "จัดส่งขนส่ง Flash Express" },
    { value: "จัดส่งขนส่งเอกชน (จำนวน 15 กระสอบขึ้นไป)", label: 'จัดส่งขนส่งเอกชน <small>(จำนวน 15 กระสอบขึ้นไป)</small>' },
    { value: "รับสินค้าด้วยตัวเอง", label: "รับสินค้าด้วยตัวเอง" }
  ];
  let firstEnabledPicked = false;
  return options.map((opt) => {
    const check = computeShipping(opt.value, items);
    const disabled = Boolean(check.error);
    const checked = !disabled && !firstEnabledPicked;
    if (checked) firstEnabledPicked = true;
    return `
      <label class="radio-card ${disabled ? "is-disabled" : ""}">
        <input type="radio" name="shipping" value="${escapeAttr(opt.value)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
        <span>${opt.label}${disabled ? `<small class="radio-reason">${escapeHtml(check.error)}</small>` : ""}</span>
      </label>
    `;
  }).join("");
}

function onShippingChange(shipping) {
  renderPayOptions(shipping);
  renderShippingDetails(shipping);
  updateOrderSummary(shipping);
}

const DEFAULT_SHIPPING_RATES = {
  brackets: [
    { max: 1, fee: 60 },
    { max: 3, fee: 60 },
    { max: 5, fee: 70 },
    { max: 10, fee: 110 },
    { max: 15, fee: 180 },
    { max: 20, fee: 250 },
    { max: 25, fee: 300 }
  ],
  over_per_kg: 15
};

const MIN_FLASH_FEE = 60;

// ค่าส่ง Flash ตามน้ำหนักรวม (ตารางเรตจากร้าน หรือค่าเริ่มต้น) ขั้นต่ำ 60 บาท
function flashFeeByWeight(totalWeight) {
  const rates = CURRENT_SHOP?.shipping_rates || DEFAULT_SHIPPING_RATES;
  const brackets = (rates.brackets || []).slice().sort((a, b) => Number(a.max) - Number(b.max));
  const hit = brackets.find((b) => totalWeight <= Number(b.max));
  if (hit) return Math.max(MIN_FLASH_FEE, Number(hit.fee));
  if (brackets.length) {
    const last = brackets[brackets.length - 1];
    const over = Number(rates.over_per_kg ?? 15);
    return Math.max(MIN_FLASH_FEE, Number(last.fee) + Math.ceil(Math.max(0, totalWeight - Number(last.max))) * over);
  }
  return MIN_FLASH_FEE;
}

// คำนวณค่าส่งตามกฎ (ฝั่ง client เพื่อแสดงผล/เตือนล่วงหน้า — ฝั่ง RPC คิดซ้ำเป็นค่าจริง)
function computeShipping(shipping, items = cartItems()) {
  const sackQty = items.filter((item) => item.isSack).reduce((sum, item) => sum + item.qty, 0);
  const nonSackQty = items.reduce((sum, item) => sum + item.qty, 0) - sackQty;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weightKg) || 1) * item.qty, 0);

  if (String(shipping).startsWith("จัดส่งขนส่งเอกชน")) {
    if (nonSackQty > 0) return { fee: 0, error: "ขนส่งเอกชนรับเฉพาะสินค้ากระสอบเท่านั้น" };
    if (sackQty < 15) return { fee: 0, error: `ขนส่งเอกชนสั่งขั้นต่ำ 15 กระสอบ (ตอนนี้ ${sackQty})` };
    return { fee: sackQty * 60, error: null };
  }
  if (shipping === "รับสินค้าด้วยตัวเอง") {
    if (subtotal < 5000) return { fee: 0, error: `รับสินค้าเองสั่งขั้นต่ำ 5,000 บาท (ตอนนี้ ${money(subtotal)})` };
    return { fee: 0, error: null };
  }
  return { fee: flashFeeByWeight(totalWeight), error: null };
}

function updateOrderSummary(shipping = document.querySelector('input[name="shipping"]:checked')?.value) {
  const box = document.querySelector("#orderSummary");
  if (!box) return;
  const subtotal = cartTotal();
  const result = computeShipping(shipping);

  box.innerHTML = `
    <div class="summary-row"><span>ค่าสินค้า</span><span>${money(subtotal)}</span></div>
    ${result.error
      ? `<div class="summary-warn">${escapeHtml(result.error)}</div>`
      : `<div class="summary-row"><span>ค่าจัดส่ง</span><span>${result.fee ? money(result.fee) : "ฟรี"}</span></div>
         <div class="summary-row summary-grand"><span>ยอดรวมทั้งหมด</span><strong>${money(subtotal + result.fee)}</strong></div>`}
  `;
  const submit = document.querySelector("#orderForm button[type='submit']");
  if (submit) submit.disabled = Boolean(result.error);
}

function renderPayOptions(shipping) {
  const group = document.querySelector("#payGroup");
  if (!group) return;
  const allowCod = shipping === "จัดส่งขนส่ง Flash Express";
  const options = allowCod ? ["โอนเงิน", "เก็บเงินปลายทาง (COD)"] : ["โอนเงิน"];
  group.innerHTML = options.map((value, index) => `
    <label class="radio-card">
      <input type="radio" name="pay" value="${escapeAttr(value)}" ${index === 0 ? "checked" : ""}>
      <span>${escapeHtml(value)}</span>
    </label>
  `).join("");
}

const PICKUP_WINDOWS = [
  { label: "ช่วงเช้า (09.30 - 11.30)", slots: ["09:30", "10:00", "10:30", "11:00", "11:30"] },
  { label: "ช่วงบ่าย (13.30 - 15.30)", slots: ["13:30", "14:00", "14:30", "15:00", "15:30"] }
];

function addressField() {
  return `
  <label class="field">
    <span>ที่อยู่จัดส่ง</span>
    <textarea id="addressInput" placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์">${escapeHtml(LAST_CONTACT?.address || "")}</textarea>
  </label>
`;
}

function renderShippingDetails(shipping) {
  const box = document.querySelector("#shippingDetails");
  if (!box) return;

  if (shipping === "รับสินค้าด้วยตัวเอง") {
    const minDate = firstPickupDate();
    const slotOptions = PICKUP_WINDOWS.map((win) => `
      <optgroup label="${win.label}">
        ${win.slots.map((slot) => `<option value="${slot}">${slot.replace(":", ".")} น.</option>`).join("")}
      </optgroup>
    `).join("");
    box.innerHTML = `
      <label class="field">
        <span>วันที่เข้ารับ</span>
        <input id="pickupDate" type="date" min="${minDate}" value="${minDate}">
      </label>
      <label class="field">
        <span>เวลาเข้ารับ</span>
        <select id="pickupTime">${slotOptions}</select>
      </label>
      <p class="form-note">ชำระเงินภายใน 1 ชั่วโมงหลังยืนยันออเดอร์ • วันและเวลาเข้ารับ ทางร้านจะคอนเฟิร์มอีกครั้ง</p>
    `;
    const dateInput = box.querySelector("#pickupDate");
    dateInput.addEventListener("change", refreshPickupSlots);
    refreshPickupSlots();
    return;
  }

  if (String(shipping).startsWith("จัดส่งขนส่งเอกชน")) {
    box.innerHTML = `
      ${addressField()}
      <div class="field">
        <span>การจัดขนส่งเอกชน</span>
        <div class="radio-group" id="carrierGroup">
          <label class="radio-card">
            <input type="radio" name="carrier" value="ระบุชื่อขนส่งที่ใช้งานอยู่" checked>
            <span>ระบุชื่อขนส่งที่ใช้งานอยู่</span>
          </label>
          <label class="field nested-field" id="carrierNameField">
            <span>ชื่อขนส่งที่ใช้</span>
            <input id="carrierNameInput" placeholder="เช่น นิ่มซี่เส็ง, ไปรษณีย์, KERRY">
          </label>
          <label class="radio-card">
            <input type="radio" name="carrier" value="ให้ทางร้านจัดหาตามที่อยู่">
            <span>ให้ทางร้านจัดหาให้ตามที่อยู่</span>
          </label>
        </div>
      </div>
      <p class="form-note">ทางร้านเรียกเก็บค่าขนส่งต้นทาง 60 บาท/กระสอบ และค่าจัดส่งชำระปลายทางกับทางขนส่งอีกครั้ง</p>
    `;
    box.querySelectorAll('input[name="carrier"]').forEach((input) => {
      input.addEventListener("change", () => toggleCarrierName(input.value));
    });
    toggleCarrierName(box.querySelector('input[name="carrier"]:checked')?.value);
    return;
  }

  box.innerHTML = addressField();
}

function toggleCarrierName(choice) {
  const field = document.querySelector("#carrierNameField");
  if (!field) return;
  field.classList.toggle("is-hidden", choice !== "ระบุชื่อขนส่งที่ใช้งานอยู่");
}

function allPickupSlots() {
  return PICKUP_WINDOWS.flatMap((win) => win.slots);
}

// Earliest instant a pickup is allowed: 24h from now (absolute, timezone-independent).
function pickupMinInstant() {
  return Date.now() + 24 * 60 * 60 * 1000;
}

// Absolute instant for a wall-clock slot interpreted in Thailand time (UTC+7, no DST).
function slotInstant(dateStr, slot) {
  return new Date(`${dateStr}T${slot}:00+07:00`).getTime();
}

// Thailand calendar date (YYYY-MM-DD) for a given instant.
function bangkokDateStr(instant) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(instant));
}

// First date (Thailand time) that still has at least one selectable slot after the 24h cutoff.
function firstPickupDate() {
  const minInstant = pickupMinInstant();
  let probe = minInstant;
  for (let i = 0; i < 14; i += 1) {
    const dateStr = bangkokDateStr(probe);
    if (allPickupSlots().some((slot) => slotInstant(dateStr, slot) >= minInstant)) return dateStr;
    probe += 24 * 60 * 60 * 1000;
  }
  return bangkokDateStr(minInstant);
}

// Disable slots earlier than the 24h cutoff for the chosen date, keeping the selection valid.
function refreshPickupSlots() {
  const dateInput = document.querySelector("#pickupDate");
  const timeSelect = document.querySelector("#pickupTime");
  if (!dateInput || !timeSelect) return;
  const minInstant = pickupMinInstant();
  const dateStr = dateInput.value;
  let firstEnabled = "";

  Array.from(timeSelect.options).forEach((option) => {
    const allowed = dateStr ? slotInstant(dateStr, option.value) >= minInstant : true;
    option.disabled = !allowed;
    if (allowed && !firstEnabled) firstEnabled = option.value;
  });

  const current = timeSelect.selectedOptions[0];
  if ((!current || current.disabled) && firstEnabled) timeSelect.value = firstEnabled;
}

function formatThaiDate(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${dateStr}T00:00:00`));
}

function renderCartItem(item) {
  return `
    <div class="cart-item">
      <div class="cart-line">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="pack">${escapeHtml(item.pack)}</div>
        </div>
        <strong>${money(item.price * item.qty)}</strong>
      </div>
      <div class="qty-row">
        <span>${money(item.price)} x ${item.qty}</span>
        <div class="qty-control">
          <button class="qty-btn" type="button" data-cart-id="${escapeAttr(item.id)}" data-cart-delta="-1">-</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" type="button" data-cart-id="${escapeAttr(item.id)}" data-cart-delta="1">+</button>
        </div>
      </div>
    </div>
  `;
}

async function submitOrder(event) {
  event.preventDefault();
  const values = readOrderForm();

  const error = validateOrderForm(values);
  if (error) {
    toast(error);
    return;
  }

  const shipping = computeShipping(values.shipping, values.items);
  if (shipping.error) {
    toast(shipping.error);
    return;
  }

  if (SHOP_CONFIG.useSupabase && CURRENT_SHOP?.slug && window.ShopServices?.orderService) {
    try {
      const result = await createOrderViaDataLayer(values);
      await sendOrderMessage(result.message, buildOrderFlex(values, result), { saved: true, orderNo: result.order_no });
      return;
    } catch (error) {
      console.error(error);
      toast(error.message || "สร้างออเดอร์ไม่สำเร็จ");
      return;
    }
  }

  const fallbackMessage = buildMessage(values);
  let message = fallbackMessage;

  try {
    const verified = await verifyOrder(values);
    if (verified?.message) message = verified.message;
  } catch (error) {
    // Client totals are only a fallback. Production shops should verify pricing server-side.
    toast("ตรวจยอดกับ API ไม่สำเร็จ ใช้ข้อความสรุปจากหน้าเว็บแทน");
  }

  await saveMemberOrder(values);
  await sendOrderMessage(message);
}

async function createOrderViaDataLayer(values) {
  const payload = {
    shop_slug: CURRENT_SHOP.slug,
    line_user_id: MEMBER_UID || "",
    line_display_name: MEMBER_NAME || "",
    line_picture_url: MEMBER_PROFILE?.pictureUrl || "",
    customer_name: values.customer,
    customer_phone: values.phone,
    customer_address: isPickup(values) ? "" : values.address,
    shipping_method: values.shipping,
    pay_method: values.pay,
    note: buildShippingSummary(values).join("\n"),
    tax_required: values.tax,
    tax_info: values.taxInfo,
    items: values.items.map((item) => ({
      product_id: item.id,
      qty: item.qty
    }))
  };
  return window.ShopServices.orderService.createOrderFromCart(payload);
}

function readOrderForm() {
  return {
    items: cartItems(),
    shipping: document.querySelector('input[name="shipping"]:checked')?.value || "",
    pay: document.querySelector('input[name="pay"]:checked')?.value || "",
    customer: document.querySelector("#customerInput").value.trim(),
    phone: document.querySelector("#phoneInput")?.value.trim() || "",
    address: document.querySelector("#addressInput")?.value.trim() || "",
    carrierChoice: document.querySelector('input[name="carrier"]:checked')?.value || "",
    carrierName: document.querySelector("#carrierNameInput")?.value.trim() || "",
    pickupDate: document.querySelector("#pickupDate")?.value || "",
    pickupTime: document.querySelector("#pickupTime")?.value || "",
    note: document.querySelector("#noteInput")?.value.trim() || "",
    tax: document.querySelector("#taxCheck").checked,
    taxInfo: document.querySelector("#taxInput")?.value.trim() || ""
  };
}

function isPickup(values) {
  return values.shipping === "รับสินค้าด้วยตัวเอง";
}

function isPrivateCarrier(values) {
  return String(values.shipping).startsWith("จัดส่งขนส่งเอกชน");
}

function validateOrderForm(values) {
  if (!values.customer) return "กรุณากรอกชื่อผู้สั่ง";
  if (!values.phone) return "กรุณากรอกเบอร์โทรศัพท์";

  if (isPickup(values)) {
    if (!values.pickupDate) return "กรุณาเลือกวันที่เข้ารับสินค้า";
    if (!allPickupSlots().includes(values.pickupTime)) {
      return "กรุณาเลือกเวลาเข้ารับในช่วง 09.30 - 11.30 หรือ 13.30 - 15.30";
    }
    if (slotInstant(values.pickupDate, values.pickupTime) < pickupMinInstant()) {
      return "วันและเวลาเข้ารับต้องเป็นหลังกดสั่งซื้ออย่างน้อย 24 ชั่วโมง (ตามเวลาประเทศไทย)";
    }
    return null;
  }

  if (!values.address) return "กรุณากรอกที่อยู่จัดส่ง";
  if (isPrivateCarrier(values)) {
    if (!values.carrierChoice) return "กรุณาเลือกวิธีจัดขนส่งเอกชน";
    if (values.carrierChoice === "ระบุชื่อขนส่งที่ใช้งานอยู่" && !values.carrierName) {
      return "กรุณาระบุชื่อขนส่งที่ใช้";
    }
  }
  return null;
}

function buildShippingSummary(values) {
  const lines = [`การจัดส่ง: ${values.shipping}`];
  if (values.phone) lines.push(`เบอร์โทร: ${values.phone}`);

  if (isPickup(values)) {
    if (values.pickupDate) {
      lines.push(`วันเข้ารับ: ${formatThaiDate(values.pickupDate)}${values.pickupTime ? ` เวลา ${values.pickupTime} น.` : ""}`);
    }
    lines.push("** เข้ารับเอง กรุณาชำระเงินภายใน 1 ชั่วโมง **");
  } else {
    if (values.address) lines.push(`ที่อยู่จัดส่ง: ${values.address}`);
    if (isPrivateCarrier(values)) {
      if (values.carrierChoice === "ระบุชื่อขนส่งที่ใช้งานอยู่") {
        lines.push(`ขนส่งที่ใช้: ${values.carrierName || "(ยังไม่ระบุ)"}`);
      } else if (values.carrierChoice) {
        lines.push(`การจัดขนส่ง: ${values.carrierChoice}`);
      }
      lines.push("** ค่าขนส่งต้นทาง 60 บาท/กระสอบ • ค่าจัดส่งชำระปลายทางกับขนส่ง **");
    }
  }

  if (values.note) lines.push(`หมายเหตุ: ${values.note}`);
  return lines;
}

function buildMessage(values = readOrderForm()) {
  const lines = [
    `คำสั่งซื้อใหม่ - ${SHOP_CONFIG.shopName}`,
    "━━━━━━━━━━━━━━━"
  ];

  values.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`);
    if (item.pack) lines.push(`   ${item.pack}`);
    lines.push(`   ${item.qty} x ${money(item.price)} = ${money(item.price * item.qty)}`);
  });

  lines.push("━━━━━━━━━━━━━━━");
  lines.push(`รวม ${cartCount()} ชิ้น • ยอดรวม ${money(cartTotal())}`);
  lines.push(`ชำระเงิน: ${values.pay}`);
  if (values.customer) lines.push(`ผู้สั่ง: ${values.customer}`);
  buildShippingSummary(values).forEach((line) => lines.push(line));
  if (values.tax) lines.push(`ใบกำกับภาษี: ${values.taxInfo || "ต้องการใบกำกับภาษี"}`);
  lines.push("ถ้าแอดมินยืนยันยอดรวมแล้วแจ้งกลับด้วย");

  return lines.join("\n");
}

async function verifyOrder(values) {
  if (!SHOP_CONFIG.apiBaseUrl) return null;
  return fetchJson(`${SHOP_CONFIG.apiBaseUrl.replace(/\/$/, "")}/order/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: values.items.map((item) => ({ name: item.name, qty: item.qty })),
      shipping: values.shipping,
      pay: values.pay,
      customer: values.customer,
      note: values.note,
      shop: SHOP_CONFIG.shopName
    })
  });
}

async function saveMemberOrder(values) {
  if (!SHOP_CONFIG.apiBaseUrl || !MEMBER_UID) return;
  try {
    await fetchJson(`${SHOP_CONFIG.apiBaseUrl.replace(/\/$/, "")}/order/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: MEMBER_UID,
        name: MEMBER_NAME,
        items: values.items,
        shipping: values.shipping,
        pay: values.pay,
        note: values.note,
        tax: values.tax,
        taxInfo: values.taxInfo
      })
    });
  } catch (error) {
    toast("บันทึกประวัติสมาชิกไม่สำเร็จ แต่ยังส่งออเดอร์ได้");
  }
}

function buildOrderFlex(values, result) {
  const primary = "#3B9344";
  const total = Number(result?.total ?? cartTotal());
  const orderNo = result?.order_no || "";
  const subtotal = values.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipFee = Math.max(0, total - subtotal);

  const itemRows = values.items.map((item) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `${item.name} x${item.qty}`, size: "sm", color: "#444444", wrap: true, flex: 5 },
      { type: "text", text: money(item.price * item.qty), size: "sm", color: "#111111", align: "end", flex: 3 }
    ]
  }));

  const amountRow = (label, value, strong) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: strong ? "md" : "sm", color: strong ? "#111111" : "#666666", weight: strong ? "bold" : "regular" },
      { type: "text", text: value, size: strong ? "md" : "sm", color: strong ? primary : "#111111", align: "end", weight: strong ? "bold" : "regular" }
    ]
  });

  // รายละเอียดผู้สั่ง/จัดส่ง/ชำระเงิน (buildShippingSummary รวม เบอร์โทร ที่อยู่ วันรับ ขนส่ง หมายเหตุ ให้แล้ว)
  const detailLines = [`ผู้สั่ง: ${values.customer}`];
  buildShippingSummary(values).forEach((line) => detailLines.push(line.replace(/\*\*/g, "").trim()));
  detailLines.push(`ชำระเงิน: ${values.pay}`);
  if (values.tax) detailLines.push(`ใบกำกับภาษี: ${values.taxInfo || "ต้องการใบกำกับภาษี"}`);

  const bodyContents = [...itemRows];
  bodyContents.push({ type: "separator", margin: "md" });
  bodyContents.push({ ...amountRow("ยอดสินค้า", money(subtotal)), margin: "md" });
  bodyContents.push(amountRow("ค่าจัดส่ง", shipFee > 0 ? money(shipFee) : "-"));
  bodyContents.push({ type: "separator", margin: "md" });
  bodyContents.push({ ...amountRow("ยอดรวมทั้งหมด", money(total), true), margin: "md" });
  bodyContents.push({ type: "separator", margin: "md" });
  bodyContents.push({
    type: "box",
    layout: "vertical",
    margin: "md",
    spacing: "sm",
    contents: detailLines.map((line) => ({ type: "text", text: line, size: "xs", color: "#888888", wrap: true }))
  });

  const footerContents = buildOrderFlexFooter(primary, orderNo, values.pay);
  const bubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: primary,
      paddingAll: "16px",
      contents: [
        { type: "text", text: SHOP_CONFIG.shopName || "คำสั่งซื้อใหม่", color: "#FFFFFF", weight: "bold", size: "lg", wrap: true },
        { type: "text", text: `เลขออเดอร์ ${orderNo || "-"}`, color: "#EAF6EC", size: "sm", margin: "sm" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents
    }
  };
  if (footerContents.length) {
    bubble.footer = { type: "box", layout: "vertical", spacing: "sm", contents: footerContents };
  }

  return {
    type: "flex",
    altText: `คำสั่งซื้อ ${orderNo} ยอดรวม ${money(total)}`,
    contents: bubble
  };
}

// ปุ่มในการ์ดออเดอร์: เปิดหน้า LIFF พร้อม action=send → ส่งข้อความเข้าแชทเองอัตโนมัติ → OA ตอบกลับอัตโนมัติ
// ข้อความต้องตรงกับ keyword ของ LINE OA เป๊ะ (exact match) จึงส่งเป็นคำสั้น ๆ ไม่มีเลขออเดอร์
// COD (เก็บเงินปลายทาง) ไม่ต้องแจ้งชำระ → ใช้ปุ่ม "ยืนยันออเดอร์" แทน
function buildOrderFlexFooter(primary, orderNo, payMethod) {
  if (!SHOP_CONFIG.liffId) return [];

  const base = `https://liff.line.me/${SHOP_CONFIG.liffId}`;
  const sendUri = (text) => `${base}?action=send&text=${encodeURIComponent(text)}`;
  const isCod = /COD|ปลายทาง/.test(payMethod || "");

  const primaryBtn = isCod
    ? { type: "button", style: "primary", color: primary, action: { type: "uri", label: "✅ ยืนยันออเดอร์", uri: sendUri("ยืนยันออเดอร์") } }
    : { type: "button", style: "primary", color: primary, action: { type: "uri", label: "💳 แจ้งชำระเงิน", uri: sendUri("แจ้งชำระเงิน") } };

  return [
    primaryBtn,
    {
      type: "button",
      style: "secondary",
      height: "sm",
      action: { type: "uri", label: "📦 สอบถามสถานะ", uri: sendUri("เช็คสถานะ") }
    },
    { type: "text", text: "กดปุ่มเพื่อแจ้งร้าน ระบบจะตอบกลับอัตโนมัติ", size: "xxs", color: "#AAAAAA", align: "center", wrap: true }
  ];
}

async function sendOrderMessage(message, flexMessage = null, meta = {}) {
  if (canSendLiffMessage()) {
    const attempts = [];
    if (flexMessage) attempts.push(flexMessage);
    attempts.push({ type: "text", text: message });

    let lastError = null;
    let flexError = null;
    for (let i = 0; i < attempts.length; i += 1) {
      const msg = attempts[i];
      try {
        await liff.sendMessages([msg]);
        Object.keys(cart).forEach((key) => delete cart[key]);
        updateBadge();
        openSheet(`
          <h2 class="sheet-title" id="sheetTitle">ส่งออเดอร์แล้ว</h2>
          <div class="empty-state">ระบบส่งคำสั่งซื้อเข้าแชท LINE เรียบร้อย</div>
          ${flexError ? `<div class="status-banner">FLEX FAIL: ${escapeHtml(`${flexError?.code || ""} ${flexError?.message || flexError}`)}</div>` : ""}
        `);
        setTimeout(() => { if (!flexError) window.liff?.closeWindow?.(); }, 1200);
        return;
      } catch (error) {
        console.error("LIFF sendMessages error:", error);
        lastError = error;
        if (msg === flexMessage) flexError = error;
      }
    }
    showBanner(`ส่งเข้า LINE ไม่สำเร็จ: ${lastError?.code || ""} ${lastError?.message || lastError}`.trim());
  }

  openFallbackMessage(message, meta);
}

// ลิงก์เปิดแชท/เพิ่มเพื่อน LINE OA ของร้าน (จาก lineOaId)
function shopLineUrl() {
  const oaId = SHOP_CONFIG.lineOaId;
  return oaId ? `https://line.me/R/ti/p/${encodeURIComponent(oaId)}` : "";
}

function openFallbackMessage(message, meta = {}) {
  const saved = Boolean(meta.saved);
  const lineUrl = shopLineUrl();

  openSheet(`
    <h2 class="sheet-title" id="sheetTitle">${saved ? "บันทึกออเดอร์แล้ว ✅" : "สรุปออเดอร์"}</h2>
    ${saved
      ? `<div class="order-summary-box">
           <div>ออเดอร์${meta.orderNo ? ` เลขที่ <strong>${escapeHtml(meta.orderNo)}</strong>` : ""} ถูกส่งถึงร้านเรียบร้อยแล้ว</div>
           <div class="pack">ร้านจะติดต่อกลับตามเบอร์ที่ให้ไว้ หรือแจ้งร้านผ่าน LINE เพื่อความรวดเร็ว</div>
         </div>`
      : `<p class="form-note">คัดลอกข้อความนี้ส่งให้ร้านผ่าน LINE เพื่อยืนยันออเดอร์</p>`}
    <textarea class="order-summary" id="fallbackMessage" readonly>${escapeHtml(message)}</textarea>
    <div class="action-stack">
      ${lineUrl ? `<a class="primary-btn" href="${escapeAttr(lineUrl)}" target="_blank" rel="noopener" id="openShopLine">แจ้งร้านผ่าน LINE</a>` : ""}
      <button class="${lineUrl ? "secondary-btn" : "primary-btn"}" type="button" id="copyMessage">คัดลอกข้อความ</button>
      <button class="ghost-btn" type="button" id="keepCart">${saved ? "กลับไปหน้าร้าน" : "กลับไปแก้ไขตะกร้า"}</button>
    </div>
  `);

  if (saved) {
    Object.keys(cart).forEach((key) => delete cart[key]);
    updateBadge();
  }

  document.querySelector("#copyMessage").addEventListener("click", async () => {
    const ok = await copyText(message);
    toast(ok ? "คัดลอกข้อความแล้ว" : "คัดลอกไม่ได้ ลองแตะข้อความค้างไว้");
  });
  document.querySelector("#keepCart").addEventListener("click", () => {
    if (saved) closeSheet();
    else renderCart();
  });
}

async function initLiff() {
  if (window.__liffInited) return;
  if (!window.liff || !SHOP_CONFIG.liffId) return;
  try {
    await liff.init({ liffId: SHOP_CONFIG.liffId });
    window.__liffInited = true;
  } catch (error) {
    console.error("LIFF init error:", error);
    showBanner(`LIFF init: ${error?.code || ""} ${error?.message || error}`.trim());
    return;
  }
  try {
    if (liff.isLoggedIn?.()) {
      MEMBER_PROFILE = await liff.getProfile();
      MEMBER_UID = MEMBER_PROFILE.userId;
      MEMBER_NAME = MEMBER_PROFILE.displayName;
      await refreshMember();
    }
  } catch (error) {
    console.error("LIFF profile error:", error);
    showBanner(`LIFF profile: ${error?.code || ""} ${error?.message || error}`.trim());
  }
}

function canSendLiffMessage() {
  if (!window.liff || typeof liff.sendMessages !== "function") return false;
  if (!liff.isInClient?.()) return false;
  const context = liff.getContext?.();
  return ["utou", "room", "group"].includes(context?.type);
}

async function askProduct(product) {
  const message = [
    "สอบถามสินค้า",
    product.name,
    product.pack,
    `ราคา ${money(product.price)}`,
    "",
    "สนใจสอบถามรายละเอียดเพิ่มเติม"
  ].join("\n");

  if (!canSendLiffMessage()) return toast("เปิดผ่านแชท LINE จึงจะส่งข้อความสอบถามได้");
  try {
    await liff.sendMessages([{ type: "text", text: message }]);
    toast("ส่งข้อความสอบถามแล้ว");
  } catch (error) {
    toast("ส่งข้อความสอบถามไม่สำเร็จ");
  }
}

async function shareProduct(product) {
  // ใช้ URL เว็บตรง ๆ (เปิดได้ทุกที่ ไม่ใช่ liff.line.me ที่คนนอก LINE กดแล้ว 404)
  const shareUrl = `${window.location.origin}/?pname=${encodeURIComponent(product.name)}`;

  // เปิดในแอป LINE → แชร์เป็นการ์ดสวย ๆ ให้เพื่อน
  if (window.liff?.isInClient?.() && typeof liff.shareTargetPicker === "function") {
    try {
      const result = await liff.shareTargetPicker([buildProductFlex(product, shareUrl)]);
      if (result) toast("แชร์สินค้าแล้ว");
      return;
    } catch (error) {
      console.error("shareTargetPicker error:", error);
      // ตกไปใช้วิธีสำรองด้านล่าง
    }
  }

  // นอกแอป LINE → แชร์ผ่านระบบเครื่อง หรือคัดลอกลิงก์
  const shareData = { title: product.name, text: `${product.name} • ${product.pack || ""} • ${money(product.price)}`, url: shareUrl };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const ok = await copyText(shareUrl);
  toast(ok ? "คัดลอกลิงก์สินค้าแล้ว" : "คัดลอกลิงก์ไม่สำเร็จ ลองแตะลิงก์ค้างไว้");
}

function buildProductFlex(product, uri) {
  const primary = "#3B9344";
  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: SHOP_CONFIG.shopName || "", size: "xs", color: "#AAAAAA", wrap: true },
        { type: "text", text: product.name, weight: "bold", size: "lg", wrap: true },
        { type: "text", text: product.pack || product.cat || "", size: "sm", color: "#666666", wrap: true },
        { type: "text", text: money(product.price), weight: "bold", size: "xl", color: primary, margin: "md" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "button", style: "primary", color: primary, action: { type: "uri", label: "ดูสินค้า / สั่งซื้อ", uri } }]
    }
  };
  if (product.image) {
    bubble.hero = { type: "image", url: product.image, size: "full", aspectRatio: "1:1", aspectMode: "cover" };
  }
  return {
    type: "flex",
    altText: `${product.name} ${money(product.price)}`,
    contents: bubble
  };
}

async function openMember() {
  if (!MEMBER_UID && window.liff?.isLoggedIn?.()) {
    try {
      MEMBER_PROFILE = await liff.getProfile();
      MEMBER_UID = MEMBER_PROFILE.userId;
      MEMBER_NAME = MEMBER_PROFILE.displayName;
      await refreshMember();
    } catch (error) {
      toast("ดึงข้อมูล LINE profile ไม่สำเร็จ");
    }
  }
  renderMember();
}

async function refreshMember() {
  if (!SHOP_CONFIG.useSupabase || !CURRENT_SHOP?.slug || !MEMBER_UID || !window.ShopServices?.memberService?.getMemberSummary) {
    MEMBER_DATA = null;
    return;
  }
  try {
    const res = await window.ShopServices.memberService.getMemberSummary({
      shop_slug: CURRENT_SHOP.slug,
      line_user_id: MEMBER_UID
    });
    MEMBER_DATA = res?.ok ? res : null;
    LAST_CONTACT = MEMBER_DATA?.last_contact || null;
  } catch (error) {
    console.error(error);
    MEMBER_DATA = null;
  }
}

function renderMember() {
  const member = MEMBER_DATA?.member || null;
  const profileName = member?.display_name || MEMBER_NAME || "ลูกค้า LINE";
  const avatar = MEMBER_PROFILE?.pictureUrl ? `<img src="${escapeAttr(MEMBER_PROFILE.pictureUrl)}" alt="">` : iconSvg("user", "avatar-icon");
  const history = MEMBER_DATA?.history?.length ? MEMBER_DATA.history : demoHistory();

  openSheet(`
    <h2 class="sheet-title" id="sheetTitle">สมาชิก</h2>
    <div class="member-head">
      <div class="avatar">${avatar}</div>
      <div>
        <strong>${escapeHtml(profileName)}</strong>
        <div class="pack">${MEMBER_UID ? "เชื่อมต่อ LINE แล้ว" : "เปิดผ่าน LINE เพื่อดึงข้อมูลสมาชิก"}</div>
      </div>
    </div>
    ${member ? renderMemberStats(member) : renderJoinPrompt()}
    <div class="member-list">
      <strong>ประวัติสั่งซื้อ</strong>
      ${history.map(renderHistoryItem).join("")}
    </div>
  `);

  document.querySelector("#joinMember")?.addEventListener("click", joinMember);
  document.querySelectorAll("[data-reorder]").forEach((button) => {
    button.addEventListener("click", () => reorder(history[Number(button.dataset.reorder)]));
  });
  document.querySelectorAll("[data-contact]").forEach((button) => {
    button.addEventListener("click", () => contactShopAboutOrder(button.dataset.contact));
  });
}

async function contactShopAboutOrder(orderNo) {
  const text = `ติดต่อสอบถามเกี่ยวกับออเดอร์เลขที่ ${orderNo || ""}`.trim();
  if (canSendLiffMessage()) {
    try {
      await liff.sendMessages([{ type: "text", text }]);
      liff.closeWindow?.();
      return;
    } catch (error) {
      console.error("contactShopAboutOrder error:", error);
    }
  }
  toast("เปิดผ่านแชท LINE เพื่อติดต่อร้านค้า");
}

function renderMemberStats(member) {
  return `
    <div class="stat-grid">
      <div class="stat"><span>ยอดสั่งซื้อสะสม</span><strong>${money(Number(member.total_spent || 0))}</strong></div>
    </div>
  `;
}

function renderJoinPrompt() {
  return `
    <div class="action-stack">
      <button class="secondary-btn" type="button" id="joinMember">สมัครสมาชิกฟรี</button>
    </div>
  `;
}

async function joinMember() {
  if (!MEMBER_UID) return toast("กรุณาเปิดผ่านแอป LINE เพื่อสมัครสมาชิก");
  if (!window.ShopServices?.memberService?.joinMemberViaRpc || !CURRENT_SHOP?.slug) {
    return toast("ระบบสมาชิกยังไม่พร้อมใช้งาน");
  }
  try {
    await window.ShopServices.memberService.joinMemberViaRpc({
      shop_slug: CURRENT_SHOP.slug,
      line_user_id: MEMBER_UID,
      display_name: MEMBER_NAME,
      picture_url: MEMBER_PROFILE?.pictureUrl || ""
    });
    await refreshMember();
    toast("สมัครสมาชิกสำเร็จ");
    renderMember();
  } catch (error) {
    console.error(error);
    toast(error.message || "สมัครสมาชิกไม่สำเร็จ");
  }
}

const ORDER_STATUS_LABELS = {
  pending: "รอดำเนินการ",
  waiting_payment: "รอชำระเงิน",
  paid: "แจ้งชำระแล้ว / รอตรวจสอบ",
  confirmed: "ยืนยันการชำระเงิน",
  packing: "กำลังแพ็กสินค้า",
  shipped: "จัดส่งแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก"
};

function renderHistoryItem(order, index) {
  const total = Number(order.total ?? order.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0));
  const orderNo = order.date || `ออเดอร์ #${index + 1}`;
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status || "";
  return `
    <div class="history-item">
      <div class="cart-line">
        <strong>${escapeHtml(orderNo)}</strong>
        <strong>${money(total)}</strong>
      </div>
      ${statusLabel ? `<span class="order-status">${escapeHtml(statusLabel)}</span>` : ""}
      <div class="pack">${escapeHtml(order.items.map((item) => `${item.name} x${item.qty}`).join(", "))}</div>
      <div class="history-actions">
        <button class="ghost-btn" type="button" data-reorder="${index}">สั่งซ้ำ</button>
        <button class="ghost-btn" type="button" data-contact="${escapeAttr(orderNo)}">ติดต่อร้านค้า</button>
      </div>
    </div>
  `;
}

function reorder(order) {
  let skipped = 0;
  order.items.forEach((oldItem) => {
    const product = PRODUCTS.find((item) => item.name === oldItem.name);
    if (!product || product.stock !== null && product.stock <= 0) {
      skipped += 1;
      return;
    }
    const qty = product.stock === null ? Number(oldItem.qty || 1) : Math.min(Number(oldItem.qty || 1), product.stock);
    cart[product.id] = { id: product.id, qty };
  });
  updateBadge();
  if (skipped) toast(`บางรายการไม่มีสินค้าแล้ว ${skipped} รายการ`);
  renderCart();
}

function demoHistory() {
  return [
    {
      date: "ตัวอย่างออเดอร์ล่าสุด",
      items: cartItems().length ? cartItems() : [{ name: "ชาเขียวมัทฉะพรีเมียม", qty: 1, price: 89 }]
    }
  ];
}

// ส่งข้อความเข้าแชทอัตโนมัติ (ใช้กับปุ่มในการ์ดออเดอร์ → ให้ OA ตอบกลับอัตโนมัติ)
async function autoSendToChat(text) {
  if (!text) return false;
  if (!canSendLiffMessage()) {
    showBanner("เปิดผ่านแชท LINE เพื่อส่งข้อความ");
    return false;
  }
  try {
    await liff.sendMessages([{ type: "text", text }]);
    liff.closeWindow?.();
    return true;
  } catch (error) {
    console.error("autoSendToChat error:", error);
    showBanner(`ส่งข้อความไม่สำเร็จ: ${error?.code || ""} ${error?.message || error}`.trim());
    return false;
  }
}

function handleQueryString() {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get("cat");
  const pname = params.get("pname");
  if (cat && ["แนะนำ", ...new Set(PRODUCTS.map((product) => product.cat))].includes(cat)) {
    selectedCat = cat;
    renderCats();
    renderGrid();
  }
  if (pname) {
    const product = PRODUCTS.find((item) => item.name === pname);
    if (product) openDetail(product.id);
  }
  if (params.get("view") === "member" || params.get("history") === "1") openMember();
  if (params.get("view") === "payment") openPayment(params.get("order"), params.get("amount"));
}

function openPayment(orderNo, amount) {
  const shop = CURRENT_SHOP || {};
  const hasInfo = shop.payment_image_url || shop.payment_bank || shop.payment_account_no;

  if (!hasInfo) {
    openSheet(`
      <h2 class="sheet-title" id="sheetTitle">ชำระเงิน</h2>
      <div class="empty-state">ร้านยังไม่ได้ตั้งค่าข้อมูลการชำระเงิน</div>
    `);
    return;
  }

  openSheet(`
    <h2 class="sheet-title" id="sheetTitle">ชำระเงิน</h2>
    ${orderNo ? `<div class="pack">ออเดอร์ ${escapeHtml(orderNo)}</div>` : ""}
    ${amount ? `<div class="cart-total price-row"><span>ยอดที่ต้องชำระ</span><strong>${money(Number(amount))}</strong></div>` : ""}
    ${shop.payment_image_url ? `<img class="pay-qr" src="${escapeAttr(shop.payment_image_url)}" alt="QR ชำระเงิน">` : ""}
    <div class="pay-info">
      ${shop.payment_bank ? `<div class="pay-row"><span>ธนาคาร</span><strong>${escapeHtml(shop.payment_bank)}</strong></div>` : ""}
      ${shop.payment_account_no ? `<div class="pay-row"><span>เลขบัญชี</span><strong id="payAcct">${escapeHtml(shop.payment_account_no)}</strong></div>` : ""}
      ${shop.payment_account_name ? `<div class="pay-row"><span>ชื่อบัญชี</span><strong>${escapeHtml(shop.payment_account_name)}</strong></div>` : ""}
    </div>
    ${shop.payment_note ? `<p class="form-note">${escapeHtml(shop.payment_note)}</p>` : ""}
    <div class="pay-steps">
      <strong>หลังโอนเงินแล้ว</strong>
      <p>กรุณาส่ง<b>สลิปการโอน</b>เข้ามาในแชท LINE ของร้าน เพื่อให้ร้านตรวจสอบและยืนยันออเดอร์ของคุณ</p>
    </div>
    <div class="action-stack">
      ${shop.payment_account_no ? `<button class="primary-btn" type="button" id="copyAcct">คัดลอกเลขบัญชี</button>` : ""}
      <button class="ghost-btn" type="button" data-close-sheet>ปิด</button>
    </div>
  `);

  document.querySelector("#copyAcct")?.addEventListener("click", async () => {
    const ok = await copyText(shop.payment_account_no);
    toast(ok ? "คัดลอกเลขบัญชีแล้ว" : "คัดลอกไม่ได้ ลองแตะที่เลขค้างไว้เพื่อคัดลอก");
  });
}

// คัดลอกข้อความแบบรองรับ webview ใน LINE (Clipboard API มักถูกบล็อก จึง fallback execCommand)
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // fall through to legacy method
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch (error) {
    return false;
  }
}

function openSheet(html) {
  els.sheetBody.innerHTML = html;
  els.sheetLayer.classList.add("is-open");
  els.sheetLayer.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");
}

function closeSheet() {
  els.sheetLayer.classList.remove("is-open");
  els.sheetLayer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
  detailProductId = null;
}

function openLightbox(src, alt) {
  els.lightboxImg.src = src;
  els.lightboxImg.alt = alt;
  els.lightbox.classList.add("is-open");
  els.lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  els.lightbox.classList.remove("is-open");
  els.lightbox.setAttribute("aria-hidden", "true");
}

function showBanner(message) {
  els.statusBanner.textContent = message;
  els.statusBanner.classList.remove("is-hidden");
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  els.toastWrap.append(node);
  setTimeout(() => node.remove(), 2600);
}

function renderStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = iconSvg(node.dataset.icon);
  });
}

function iconSvg(name = "package", className = "ui-icon") {
  const safeName = ICON_PATHS[name] ? name : "package";
  return `<svg class="${escapeAttr(className)}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[safeName]}</svg>`;
}

function addIconSvg() {
  return `<svg class="add-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m12 1c-2.17559 0-4.30233.64514-6.11127 1.85383-1.80894 1.2087-3.21884 2.92666-4.0514 4.93665s-1.050403 4.22172-.62596 6.35552c.42443 2.1338 1.47208 4.0938 3.01046 5.6322s3.49839 2.586 5.63218 3.0104c2.13379.4245 4.34549.2066 6.35549-.6259 2.01-.8326 3.728-2.2425 4.9367-4.0514 1.2087-1.809 1.8538-3.9357 1.8538-6.1113 0-2.91738-1.1589-5.71527-3.2218-7.77817s-4.8608-3.22183-7.7782-3.22183zm5 12h-4v4c0 .2652-.1054.5196-.2929.7071s-.4419.2929-.7071.2929-.5196-.1054-.7071-.2929-.2929-.4419-.2929-.7071v-4h-4c-.26521 0-.51957-.1054-.7071-.2929-.18754-.1875-.2929-.4419-.2929-.7071s.10536-.5196.2929-.7071c.18753-.1875.44189-.2929.7071-.2929h4v-4c0-.26522.1054-.51957.2929-.70711.1875-.18753.4419-.29289.7071-.29289s.5196.10536.7071.29289c.1875.18754.2929.44189.2929.70711v4h4c.2652 0 .5196.1054.7071.2929s.2929.4419.2929.7071-.1054.5196-.2929.7071-.4419.2929-.7071.2929z" fill="currentColor"></path></svg>`;
}

function iconForCategory(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("เครื่องดื่ม") || value.includes("drink") || value.includes("กาแฟ") || value.includes("ชา")) return "cup";
  if (value.includes("เบเกอรี่") || value.includes("bakery") || value.includes("ขนม")) return "cookie";
  if (value.includes("ของฝาก") || value.includes("gift")) return "gift";
  if (value.includes("ของใช้") || value.includes("bag")) return "bag";
  return "package";
}

function findProduct(id) {
  return PRODUCTS.find((product) => String(product.id) === String(id));
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/)[0];
}

function money(value) {
  return `${SHOP_CONFIG.currency}${Number(value || 0).toLocaleString("th-TH")}`;
}

function displayStock(stock) {
  return stock === null ? "ไม่จำกัด" : stock;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
