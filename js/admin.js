(function () {
  const DEFAULT_RATES = {
    brackets: [
      { max: 1, fee: 40 },
      { max: 3, fee: 55 },
      { max: 5, fee: 70 },
      { max: 10, fee: 110 },
      { max: 15, fee: 180 },
      { max: 20, fee: 250 },
      { max: 25, fee: 300 }
    ],
    over_per_kg: 15
  };

  const state = {
    user: null,
    access: [],
    shop: null,
    products: [],
    orders: [],
    members: [],
    tab: "settings",
    editingProductId: ""
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", initAdmin);

  async function initAdmin() {
    bindAdminElements();
    bindAdminEvents();

    if (!window.SHOP_CONFIG?.useSupabase) {
      showSetupOnly();
      return;
    }

    els.setupPanel.classList.add("is-hidden");
    await refreshSession();
  }

  function bindAdminElements() {
    Object.assign(els, {
      setupPanel: document.querySelector("#setupPanel"),
      loginPanel: document.querySelector("#loginPanel"),
      dashboardPanel: document.querySelector("#dashboardPanel"),
      loginForm: document.querySelector("#loginForm"),
      logoutBtn: document.querySelector("#logoutBtn"),
      shopSelect: document.querySelector("#shopSelect"),
      adminShopName: document.querySelector("#adminShopName"),
      adminUserLabel: document.querySelector("#adminUserLabel"),
      settingsView: document.querySelector("#settingsView"),
      paymentView: document.querySelector("#paymentView"),
      productsView: document.querySelector("#productsView"),
      ordersView: document.querySelector("#ordersView"),
      membersView: document.querySelector("#membersView"),
      toastWrap: document.querySelector("#toastWrap")
    });
  }

  function bindAdminEvents() {
    els.loginForm.addEventListener("submit", loginAdmin);
    els.logoutBtn.addEventListener("click", logoutAdmin);
    els.shopSelect.addEventListener("change", () => selectShop(els.shopSelect.value));
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.adminTab));
    });
  }

  function showSetupOnly() {
    els.setupPanel.classList.remove("is-hidden");
    els.loginPanel.classList.add("is-hidden");
    els.dashboardPanel.classList.add("is-hidden");
  }

  async function refreshSession() {
    setLoading("กำลังตรวจสอบสิทธิ์");
    try {
      const user = await window.ShopServices.adminService.getCurrentUser();
      if (!user) {
        showLogin();
        return;
      }
      state.user = user;
      const access = await window.ShopServices.adminService.getAdminShopAccess(user.id);
      if (!access.length) {
        showLogin("บัญชีนี้ไม่มีสิทธิ์จัดการร้าน");
        return;
      }
      state.access = access;
      showDashboard();
      await selectShop(access[0].shop_id);
    } catch (error) {
      console.error(error);
      showLogin(error.message || "เข้าสู่ระบบแอดมินไม่สำเร็จ");
    }
  }

  async function loginAdmin(event) {
    event.preventDefault();
    const supabase = window.ShopServices.core.requireSupabaseClient();
    const email = document.querySelector("#loginEmail").value.trim();
    const password = document.querySelector("#loginPassword").value;
    setLoading("กำลังเข้าสู่ระบบ");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(error);
      showLogin("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    state.user = data.user;
    await refreshSession();
  }

  async function logoutAdmin() {
    const supabase = window.ShopServices.core.requireSupabaseClient();
    await supabase.auth.signOut();
    state.user = null;
    state.access = [];
    state.shop = null;
    showLogin("ออกจากระบบแล้ว");
  }

  function showLogin(message = "") {
    els.loginPanel.classList.remove("is-hidden");
    els.dashboardPanel.classList.add("is-hidden");
    els.logoutBtn.classList.add("is-hidden");
    if (message) toast(message);
  }

  function showDashboard() {
    els.loginPanel.classList.add("is-hidden");
    els.dashboardPanel.classList.remove("is-hidden");
    els.logoutBtn.classList.remove("is-hidden");
    els.adminUserLabel.textContent = state.user?.email || "แอดมิน";
    els.shopSelect.innerHTML = state.access.map((item) => `<option value="${escapeAttr(item.shop_id)}">${escapeHtml(item.shops?.shop_name || item.shops?.slug || item.shop_id)} (${escapeHtml(item.role)})</option>`).join("");
  }

  async function selectShop(shopId) {
    const access = state.access.find((item) => item.shop_id === shopId);
    if (!access) return;
    state.shop = {
      ...access.shops,
      id: access.shop_id,
      role: access.role
    };
    els.shopSelect.value = shopId;
    els.adminShopName.textContent = state.shop.shop_name || "ร้านค้า";
    await loadActiveTab();
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll("[data-admin-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminTab === tab));
    [els.settingsView, els.paymentView, els.productsView, els.ordersView, els.membersView].forEach((view) => view.classList.add("is-hidden"));
    document.querySelector(`#${tab}View`).classList.remove("is-hidden");
    loadActiveTab();
  }

  async function loadActiveTab() {
    if (!state.shop?.id) return;
    try {
      if (state.tab === "settings") renderSettings();
      if (state.tab === "payment") renderPayment();
      if (state.tab === "products") await loadProductsView();
      if (state.tab === "orders") await loadOrdersView();
      if (state.tab === "members") await loadMembersView();
    } catch (error) {
      console.error(error);
      toast(error.message || "โหลดข้อมูลไม่สำเร็จ");
    }
  }

  function renderSettings() {
    els.settingsView.innerHTML = `
      <form class="admin-form" id="settingsForm">
        <div class="admin-grid">
          <label class="field">
            <span>ชื่อร้าน</span>
            <input name="shop_name" value="${escapeAttr(state.shop.shop_name || "")}" required>
          </label>
          <label class="field">
            <span>LIFF ID</span>
            <input name="liff_id" value="${escapeAttr(state.shop.liff_id || "")}">
          </label>
          <label class="field span-2">
            <span>Tagline</span>
            <input name="tagline" value="${escapeAttr(state.shop.tagline || "")}">
          </label>
          <label class="field span-2">
            <span>Logo URL</span>
            <input name="logo_url" value="${escapeAttr(state.shop.logo_url || "")}">
          </label>
        </div>
        <button class="primary-btn" type="submit">บันทึกตั้งค่าร้าน</button>
      </form>
    `;
    document.querySelector("#settingsForm").addEventListener("submit", saveSettings);
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      shop_name: form.get("shop_name").trim(),
      tagline: form.get("tagline").trim(),
      logo_url: form.get("logo_url").trim(),
      liff_id: form.get("liff_id").trim()
    };
    const updated = await window.ShopServices.shopService.updateShopSettings(state.shop.id, payload);
    state.shop = { ...state.shop, ...updated };
    els.adminShopName.textContent = state.shop.shop_name;
    toast("บันทึกตั้งค่าร้านแล้ว");
    renderSettings();
  }

  function rateRowHtml(max, fee) {
    return `
      <div class="rate-row">
        <span>ไม่เกิน</span>
        <input type="number" min="0" step="0.5" class="rate-max" value="${escapeAttr(max ?? "")}">
        <span>กก. →</span>
        <input type="number" min="0" step="1" class="rate-fee" value="${escapeAttr(fee ?? "")}">
        <span>บาท</span>
        <button type="button" class="mini-btn danger rate-del">ลบ</button>
      </div>`;
  }

  function renderPayment() {
    const shop = state.shop;
    const rates = shop.shipping_rates || DEFAULT_RATES;
    els.paymentView.innerHTML = `
      <form class="admin-form" id="paymentForm">
        <div class="admin-panel-head">
          <div>
            <h2>ตั้งค่าการชำระเงิน</h2>
            <p>ข้อมูลนี้ใช้แสดง/ส่งให้ลูกค้าเมื่อสถานะออเดอร์เป็น "รอชำระเงิน"</p>
          </div>
        </div>
        <div class="admin-grid">
          <label class="field">
            <span>ธนาคาร</span>
            <input name="payment_bank" value="${escapeAttr(shop.payment_bank || "")}" placeholder="เช่น กสิกรไทย">
          </label>
          <label class="field">
            <span>เลขที่บัญชี</span>
            <input name="payment_account_no" value="${escapeAttr(shop.payment_account_no || "")}" inputmode="numeric" placeholder="xxx-x-xxxxx-x">
          </label>
          <label class="field span-2">
            <span>ชื่อบัญชี</span>
            <input name="payment_account_name" value="${escapeAttr(shop.payment_account_name || "")}" placeholder="ชื่อ-นามสกุล เจ้าของบัญชี">
          </label>
          <label class="field span-2">
            <span>หมายเหตุ (ถ้ามี)</span>
            <textarea name="payment_note" placeholder="เช่น โอนแล้วแจ้งสลิปในแชท">${escapeHtml(shop.payment_note || "")}</textarea>
          </label>
          ${renderImageField("payment", "รูป QR / พร้อมเพย์", shop.payment_image_url, shop.payment_image_public_id)}
          <div class="field span-2">
            <span>ค่าส่ง Flash ตามน้ำหนักรวม</span>
            <div id="rateRows">${(rates.brackets || []).map((b) => rateRowHtml(b.max, b.fee)).join("")}</div>
            <button class="ghost-btn compact-btn" type="button" id="addRate">+ เพิ่มช่วงน้ำหนัก</button>
            <p class="admin-muted">ถ้าน้ำหนักรวมไม่เกินค่าในแถว → คิดค่าส่งของแถวนั้น (เรียงจากน้อยไปมาก)</p>
          </div>
          <label class="field span-2">
            <span>เกินน้ำหนักสูงสุด คิดเพิ่มต่อ กก. (บาท)</span>
            <input name="over_per_kg" type="number" min="0" step="1" value="${escapeAttr(rates.over_per_kg ?? 15)}">
          </label>
        </div>
        <button class="primary-btn" type="submit">บันทึกการชำระเงิน</button>
      </form>
    `;
    document.querySelector("#paymentForm").addEventListener("submit", savePayment);
    bindImageInputs();

    document.querySelector("#addRate").addEventListener("click", () => {
      document.querySelector("#rateRows").insertAdjacentHTML("beforeend", rateRowHtml("", ""));
      bindRateDelete();
    });
    bindRateDelete();
  }

  function bindRateDelete() {
    document.querySelectorAll(".rate-del").forEach((button) => {
      button.onclick = () => button.closest(".rate-row").remove();
    });
  }

  async function savePayment(event) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const submitBtn = formEl.querySelector("button[type='submit']");
    const originalLabel = submitBtn?.textContent;
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "กำลังบันทึก...";
      }
      let image = {
        url: formEl.querySelector('input[name="payment_url"]')?.value || "",
        publicId: formEl.querySelector('input[name="payment_public_id"]')?.value || ""
      };
      const file = formEl.querySelector('input[name="payment_file"]')?.files?.[0];
      if (file) {
        const uploaded = await window.ShopServices.uploadService.uploadPaymentImage(file, state.shop.id);
        image = { url: uploaded.url, publicId: uploaded.publicId };
      }
      const brackets = Array.from(formEl.querySelectorAll("#rateRows .rate-row"))
        .map((row) => ({
          max: Number(row.querySelector(".rate-max").value),
          fee: Number(row.querySelector(".rate-fee").value)
        }))
        .filter((b) => b.max > 0 && b.fee >= 0)
        .sort((a, b) => a.max - b.max);
      const shippingRates = {
        brackets,
        over_per_kg: Number(formEl.querySelector('input[name="over_per_kg"]').value) || 15
      };
      const payload = {
        payment_bank: (form.get("payment_bank") || "").trim(),
        payment_account_no: (form.get("payment_account_no") || "").trim(),
        payment_account_name: (form.get("payment_account_name") || "").trim(),
        payment_note: (form.get("payment_note") || "").trim(),
        payment_image_url: image.url,
        payment_image_public_id: image.publicId,
        shipping_rates: shippingRates
      };
      const updated = await window.ShopServices.shopService.updateShopSettings(state.shop.id, payload);
      state.shop = { ...state.shop, ...updated };
      toast("บันทึกข้อมูลชำระเงินแล้ว");
      renderPayment();
    } catch (error) {
      console.error(error);
      toast(error.message || "บันทึกไม่สำเร็จ");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }
  }

  async function loadProductsView() {
    els.productsView.innerHTML = `<div class="admin-empty">กำลังโหลดสินค้า</div>`;
    state.products = await window.ShopServices.productService.loadProducts(state.shop.id, { activeOnly: false });
    renderProducts();
  }

  function renderProducts() {
    const editing = state.products.find((item) => item.id === state.editingProductId) || {};
    els.productsView.innerHTML = `
      <form class="admin-form" id="productForm">
        <div class="admin-panel-head">
          <div>
            <h2>${editing.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
            <p>ใช้ icon_name เช่น package, cup, coffee, cookie, chocolate, bag, gift</p>
          </div>
          <button class="ghost-btn compact-btn" type="button" id="resetProductForm">ล้างฟอร์ม</button>
        </div>
        <input type="hidden" name="id" value="${escapeAttr(editing.id || "")}">
        <div class="admin-grid">
          <label class="field">
            <span>ชื่อสินค้า</span>
            <input name="name" value="${escapeAttr(editing.name || "")}" required>
          </label>
          <label class="field">
            <span>หมวดหมู่</span>
            <input name="category_name" value="${escapeAttr(editing.category_name || "")}">
          </label>
          <label class="field">
            <span>ขนาด</span>
            <input name="pack" value="${escapeAttr(editing.pack || "")}">
          </label>
          <label class="field">
            <span>ราคา</span>
            <input name="price" type="number" min="0" step="0.01" value="${escapeAttr(editing.price ?? 0)}" required>
          </label>
          <label class="field">
            <span>สต็อก</span>
            <input name="stock" type="number" min="0" step="1" value="${escapeAttr(editing.stock ?? "")}" placeholder="ว่าง = ไม่จำกัด">
          </label>
          <label class="field">
            <span>น้ำหนัก (กก.) ใช้คิดค่าส่ง Flash</span>
            <input name="weight_kg" type="number" min="0" step="0.1" value="${escapeAttr(editing.weight_kg ?? 1)}" placeholder="เช่น 1 หรือ 20 (กระสอบ)">
          </label>
          <label class="field span-2">
            <span>รายละเอียด</span>
            <textarea name="description">${escapeHtml(editing.description || "")}</textarea>
          </label>
          <label class="field span-2">
            <span>อัตราการใช้</span>
            <textarea name="usage_rate" placeholder="เช่น 200 กรัมต่อน้ำ 200 ลิตร">${escapeHtml(editing.usage_rate || "")}</textarea>
          </label>
          ${renderImageField("image", "รูปสินค้า", editing.image_url, editing.image_public_id)}
          ${renderImageField("image2", "รูปสินค้า 2", editing.image2_url, editing.image2_public_id)}
          <label class="check-row"><input name="is_sack" type="checkbox" ${editing.is_sack ? "checked" : ""}> เป็นสินค้ากระสอบ (ใช้ขนส่งเอกชน)</label>
          <label class="check-row"><input name="featured" type="checkbox" ${editing.featured ? "checked" : ""}> แสดงในแนะนำ</label>
          <label class="check-row"><input name="active" type="checkbox" ${editing.id ? editing.active ? "checked" : "" : "checked"}> เปิดขาย</label>
        </div>
        <button class="primary-btn" type="submit">${editing.id ? "บันทึกสินค้า" : "เพิ่มสินค้า"}</button>
      </form>
      ${renderProductTable()}
    `;

    document.querySelector("#productForm").addEventListener("submit", saveProduct);
    bindImageInputs();
    document.querySelector("#resetProductForm").addEventListener("click", () => {
      state.editingProductId = "";
      renderProducts();
    });
    document.querySelectorAll("[data-edit-product]").forEach((button) => button.addEventListener("click", () => {
      state.editingProductId = button.dataset.editProduct;
      renderProducts();
    }));
    document.querySelectorAll("[data-hide-product]").forEach((button) => button.addEventListener("click", () => hideProduct(button.dataset.hideProduct)));
    document.querySelectorAll("[data-delete-product]").forEach((button) => button.addEventListener("click", () => removeProduct(button.dataset.deleteProduct)));
  }

  function renderProductTable() {
    if (!state.products.length) return `<div class="admin-empty">ยังไม่มีสินค้า</div>`;
    return `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>หมวด</th>
              <th>ราคา</th>
              <th>สต็อก</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${state.products.map((product) => `
              <tr>
                <td><strong>${escapeHtml(product.name)}</strong><div class="admin-muted">${escapeHtml(product.pack || "")}</div></td>
                <td>${escapeHtml(product.category_name || "-")}</td>
                <td>${money(product.price)}</td>
                <td>${product.stock === null ? "ไม่จำกัด" : escapeHtml(product.stock)}</td>
                <td><span class="status-pill">${product.active ? "เปิดขาย" : "ซ่อน"}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="mini-btn" type="button" data-edit-product="${escapeAttr(product.id)}">แก้ไข</button>
                    <button class="mini-btn" type="button" data-hide-product="${escapeAttr(product.id)}">ซ่อน</button>
                    <button class="mini-btn danger" type="button" data-delete-product="${escapeAttr(product.id)}">ลบ</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderImageField(field, label, currentUrl, currentPublicId) {
    const hasImage = Boolean(currentUrl);
    return `
      <div class="field span-2 upload-field">
        <span>${escapeHtml(label)}</span>
        <div class="upload-row">
          <div class="upload-preview ${hasImage ? "has-image" : ""}" data-preview="${field}">
            ${hasImage ? `<img src="${escapeAttr(currentUrl)}" alt="">` : `<span class="upload-empty">ไม่มีรูป</span>`}
          </div>
          <div class="upload-controls">
            <label class="upload-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <span>เลือกรูปภาพ</span>
              <input type="file" name="${field}_file" accept="image/*" data-image-input="${field}" hidden>
            </label>
            <div class="upload-meta">
              <span class="upload-filename" data-filename="${field}">${hasImage ? "ใช้รูปเดิม" : "ยังไม่ได้เลือกไฟล์"}</span>
              <button type="button" class="upload-clear ${hasImage ? "" : "is-hidden"}" data-clear-image="${field}">ลบรูป</button>
            </div>
            <p class="upload-hint">รองรับ JPG, PNG, WEBP — อัปโหลดขึ้น Cloudinary อัตโนมัติ</p>
          </div>
        </div>
        <input type="hidden" name="${field}_url" value="${escapeAttr(currentUrl || "")}">
        <input type="hidden" name="${field}_public_id" value="${escapeAttr(currentPublicId || "")}">
      </div>
    `;
  }

  function bindImageInputs() {
    document.querySelectorAll("[data-image-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.imageInput;
        const file = input.files?.[0];
        const preview = document.querySelector(`[data-preview="${field}"]`);
        const filename = document.querySelector(`[data-filename="${field}"]`);
        const clearBtn = document.querySelector(`[data-clear-image="${field}"]`);
        if (file) {
          if (preview) {
            preview.classList.add("has-image");
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
          }
          if (filename) filename.textContent = file.name;
          if (clearBtn) clearBtn.classList.remove("is-hidden");
        }
      });
    });
    document.querySelectorAll("[data-clear-image]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = button.dataset.clearImage;
        const form = button.closest("form");
        if (!form) return;
        form.querySelector(`input[name="${field}_url"]`).value = "";
        form.querySelector(`input[name="${field}_public_id"]`).value = "";
        const fileInput = form.querySelector(`input[name="${field}_file"]`);
        if (fileInput) fileInput.value = "";
        const preview = document.querySelector(`[data-preview="${field}"]`);
        if (preview) {
          preview.classList.remove("has-image");
          preview.innerHTML = `<span class="upload-empty">ไม่มีรูป</span>`;
        }
        const filename = document.querySelector(`[data-filename="${field}"]`);
        if (filename) filename.textContent = "ยังไม่ได้เลือกไฟล์";
        button.classList.add("is-hidden");
      });
    });
  }

  async function resolveImageField(form, field) {
    const fileInput = form.querySelector(`input[name="${field}_file"]`);
    const file = fileInput?.files?.[0];
    if (file) {
      const uploaded = await window.ShopServices.uploadService.uploadProductImage(file, state.shop.id);
      return { url: uploaded.url, publicId: uploaded.publicId };
    }
    return {
      url: form.querySelector(`input[name="${field}_url"]`)?.value || "",
      publicId: form.querySelector(`input[name="${field}_public_id"]`)?.value || ""
    };
  }

  async function saveProduct(event) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const id = form.get("id");
    const submitBtn = formEl.querySelector("button[type='submit']");
    const originalLabel = submitBtn?.textContent;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "กำลังบันทึก...";
      }

      const image = await resolveImageField(formEl, "image");
      const image2 = await resolveImageField(formEl, "image2");
      const existing = state.products.find((item) => item.id === id);

      const payload = {
        name: form.get("name"),
        category_name: form.get("category_name"),
        pack: form.get("pack"),
        price: form.get("price"),
        stock: form.get("stock"),
        icon_name: existing?.icon_name || "package",
        description: form.get("description"),
        usage_rate: form.get("usage_rate"),
        image_url: image.url,
        image_public_id: image.publicId,
        image2_url: image2.url,
        image2_public_id: image2.publicId,
        is_sack: form.has("is_sack"),
        weight_kg: form.get("weight_kg") || 1,
        featured: form.has("featured"),
        active: form.has("active")
      };
      if (id) {
        await window.ShopServices.productService.updateProduct(id, payload);
        toast("บันทึกสินค้าแล้ว");
      } else {
        await window.ShopServices.productService.createProduct(state.shop.id, payload);
        toast("เพิ่มสินค้าแล้ว");
      }
      state.editingProductId = "";
      await loadProductsView();
    } catch (error) {
      console.error(error);
      toast(error.message || "บันทึกสินค้าไม่สำเร็จ");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }
  }

  async function hideProduct(productId) {
    await window.ShopServices.productService.softDeleteProduct(productId);
    toast("ซ่อนสินค้าแล้ว");
    await loadProductsView();
  }

  async function removeProduct(productId) {
    const product = state.products.find((item) => item.id === productId);
    const name = product?.name || "สินค้านี้";
    if (!window.confirm(`ลบ "${name}" ถาวร? ลบแล้วกู้คืนไม่ได้ (ถ้าแค่ไม่ต้องการขายชั่วคราว ให้ใช้ "ซ่อน")`)) return;
    try {
      await window.ShopServices.productService.deleteProduct(productId);
      if (state.editingProductId === productId) state.editingProductId = "";
      toast("ลบสินค้าแล้ว");
      await loadProductsView();
    } catch (error) {
      console.error(error);
      toast(error.message || "ลบสินค้าไม่สำเร็จ");
    }
  }

  async function loadOrdersView() {
    els.ordersView.innerHTML = `<div class="admin-empty">กำลังโหลดออเดอร์</div>`;
    state.orders = await window.ShopServices.orderService.loadOrders(state.shop.id);
    renderOrders();
  }

  function renderOrders() {
    if (!state.orders.length) {
      els.ordersView.innerHTML = `<div class="admin-empty">ยังไม่มีรายการขาย</div>`;
      return;
    }
    const statuses = [
      ["pending", "รอดำเนินการ"],
      ["waiting_payment", "รอชำระเงิน"],
      ["paid", "แจ้งชำระแล้ว / รอตรวจสอบ"],
      ["confirmed", "ยืนยันการชำระเงิน"],
      ["packing", "กำลังแพ็กสินค้า"],
      ["shipped", "จัดส่งแล้ว"],
      ["completed", "เสร็จสิ้น"],
      ["cancelled", "ยกเลิก"]
    ];
    els.ordersView.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>เลขออเดอร์</th>
              <th>ลูกค้า</th>
              <th>ยอดรวม</th>
              <th>สถานะ</th>
              <th>วันที่</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${state.orders.map((order) => `
              <tr>
                <td><strong>${escapeHtml(order.order_no || order.id)}</strong><div class="admin-muted">${escapeHtml(order.pay_method || "")}</div></td>
                <td>${escapeHtml(order.customer_name || order.line_display_name || "-")}</td>
                <td>${money(order.total)}</td>
                <td>
                  <select data-order-status="${escapeAttr(order.id)}">
                    ${statuses.map(([value, label]) => `<option value="${value}" ${order.status === value ? "selected" : ""}>${label}</option>`).join("")}
                  </select>
                </td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                  <div class="row-actions">
                    <button class="mini-btn" type="button" data-detail-order="${escapeAttr(order.id)}">รายละเอียด</button>
                    <button class="mini-btn" type="button" data-notify-order="${escapeAttr(order.id)}">แจ้งลูกค้า</button>
                    <button class="mini-btn danger" type="button" data-delete-order="${escapeAttr(order.id)}">ลบ</button>
                  </div>
                </td>
              </tr>
              <tr class="order-detail-row is-hidden" data-detail-for="${escapeAttr(order.id)}">
                <td colspan="6">${orderDetailHtml(order)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    document.querySelectorAll("[data-order-status]").forEach((select) => select.addEventListener("change", () => updateOrderStatus(select.dataset.orderStatus, select.value)));
    document.querySelectorAll("[data-delete-order]").forEach((button) => button.addEventListener("click", () => removeOrder(button.dataset.deleteOrder)));
    document.querySelectorAll("[data-detail-order]").forEach((button) => button.addEventListener("click", () => {
      const row = document.querySelector(`[data-detail-for="${CSS.escape(button.dataset.detailOrder)}"]`);
      if (row) row.classList.toggle("is-hidden");
    }));
    document.querySelectorAll("[data-notify-order]").forEach((button) => button.addEventListener("click", () => openNotifyModal(button.dataset.notifyOrder)));
  }

  const NOTIFY_TEMPLATES = [
    { key: "paid", label: "ยืนยันชำระเงิน", needsTracking: false },
    { key: "packing", label: "กำลังแพ็ก", needsTracking: false },
    { key: "shipped", label: "แจ้งเลขพัสดุ", needsTracking: true },
    { key: "pickup", label: "นัดรับสินค้า", needsTracking: false },
    { key: "remind", label: "ทวงชำระเงิน", needsTracking: false }
  ];

  function buildNotifyMessage(key, order, extra) {
    const shopName = state.shop?.name || "ทางร้าน";
    const orderNo = order.order_no || order.id;
    const total = money(order.total);
    const carrier = (extra.carrier || "").trim() || "-";
    const tracking = (extra.tracking || "").trim() || "-";
    switch (key) {
      case "paid":
        return `สวัสดีค่ะ 🙏\nร้าน ${shopName} ได้รับการชำระเงินสำหรับออเดอร์ ${orderNo} เรียบร้อยแล้วค่ะ\nยอดชำระ ${total}\nร้านกำลังจัดเตรียมสินค้าให้นะคะ ขอบคุณที่อุดหนุนค่ะ`;
      case "packing":
        return `ออเดอร์ ${orderNo} ทางร้านกำลังแพ็กสินค้าอยู่นะคะ จะรีบจัดส่งให้เร็วที่สุดค่ะ 🙏`;
      case "shipped": {
        if (extra.mode === "private") {
          return `ทางร้านจัดส่งพัสดุเรียบร้อยแล้วนะคะ 🙏\nส่งโดยขนส่ง ${carrier} ค่าจัดส่งชำระปลายทางนะคะ\nเพื่อความสะดวกรวดเร็วในการจัดส่งสินค้า กรุณารับสายจากเจ้าหน้าที่ขนส่งด้วยนะคะ ขอบพระคุณมากๆค่าา 🙏🏻`;
        }
        const trackLink = /flash/i.test(carrier)
          ? `\nหรือลูกค้าสามารถเช็คพัสดุได้ทางลิ้งค์นี้ค่ะ\nhttps://www.flashexpress.co.th/fle/tracking?se=${encodeURIComponent(tracking)}`
          : "";
        return `ทางร้านจัดส่งพัสดุเรียบร้อยแล้ว ขออนุญาตแจ้งเลขพัสดุนะคะ\n${tracking} ขนส่ง ${carrier}${trackLink}\n\nลูกค้าจะได้รับสินค้าภายใน 3-5 วันทำการ หลังจากจัดส่ง 😊 ซึ่งจะขึ้นอยู่กับแต่ละพื้นที่ อาจจะเร็วและช้าตามเขตและพื้นที่จัดส่งนะคะ\nเพื่อความสะดวกรวดเร็วในการจัดส่งสินค้า กรุณารับสายจากเจ้าหน้าที่ขนส่งด้วยนะคะ ขอบพระคุณมากๆค่าา 🙏🏻`;
      }
      case "pickup":
        return `ออเดอร์ ${orderNo} เตรียมพร้อมให้เข้ารับแล้วนะคะ 🙏\nรบกวนมารับตามวันและเวลาที่นัดไว้ค่ะ หากมีการเปลี่ยนแปลงแจ้งทางร้านได้เลยนะคะ`;
      case "remind":
        return `แจ้งเตือนนะคะ 🙏\nออเดอร์ ${orderNo} ยอด ${total} ยังไม่ได้รับการชำระเงินค่ะ\nรบกวนโอนและส่งสลิปในแชทนี้เพื่อยืนยันออเดอร์ด้วยนะคะ`;
      default:
        return "";
    }
  }

  function openNotifyModal(orderId) {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;

    const overlay = document.createElement("div");
    overlay.className = "notify-overlay";
    overlay.innerHTML = `
      <div class="notify-modal" role="dialog" aria-modal="true">
        <div class="notify-head">
          <div>
            <strong>แจ้งลูกค้า</strong>
            <div class="admin-muted">ออเดอร์ ${escapeHtml(order.order_no || order.id)} · ${escapeHtml(order.customer_name || order.line_display_name || "-")}</div>
          </div>
          <button class="icon-close" type="button" data-notify-close aria-label="ปิด">✕</button>
        </div>
        <div class="notify-templates">
          ${NOTIFY_TEMPLATES.map((tpl, index) => `<button class="chip-btn ${index === 0 ? "is-active" : ""}" type="button" data-tpl="${tpl.key}">${tpl.label}</button>`).join("")}
        </div>
        <div class="notify-tracking is-hidden" data-tracking-fields>
          <div class="ship-mode">
            <button class="chip-btn is-active" type="button" data-ship-mode="parcel">มีเลขพัสดุ (Flash/ไปรษณีย์)</button>
            <button class="chip-btn" type="button" data-ship-mode="private">ขนส่งเอกชน (เก็บปลายทาง)</button>
          </div>
          <label>ขนส่ง<input type="text" data-carrier placeholder="เช่น Flash Express, ไปรษณีย์, ศิริสมบูรณ์ทรัพย์"></label>
          <label data-tracking-label>เลขพัสดุ<input type="text" data-tracking placeholder="กรอกเลขพัสดุ"></label>
        </div>
        <textarea class="notify-text" data-notify-text rows="7"></textarea>
        <p class="upload-hint">แก้ไขข้อความได้ก่อนคัดลอก แล้วนำไปวางในแชท LINE ของลูกค้า</p>
        <div class="notify-actions">
          <button class="upload-btn" type="button" data-notify-copy>คัดลอกข้อความ</button>
          <button class="mini-btn" type="button" data-notify-close>ปิด</button>
        </div>
      </div>
    `;
    document.body.append(overlay);

    let current = NOTIFY_TEMPLATES[0].key;
    let shipMode = "parcel";
    const textEl = overlay.querySelector("[data-notify-text]");
    const trackWrap = overlay.querySelector("[data-tracking-fields]");
    const trackLabel = overlay.querySelector("[data-tracking-label]");
    const carrierEl = overlay.querySelector("[data-carrier]");
    const trackEl = overlay.querySelector("[data-tracking]");

    function regenerate() {
      const tpl = NOTIFY_TEMPLATES.find((item) => item.key === current);
      trackWrap.classList.toggle("is-hidden", !tpl.needsTracking);
      trackLabel.classList.toggle("is-hidden", shipMode === "private");
      textEl.value = buildNotifyMessage(current, order, { carrier: carrierEl.value, tracking: trackEl.value, mode: shipMode });
    }
    regenerate();

    overlay.querySelectorAll("[data-tpl]").forEach((btn) => btn.addEventListener("click", () => {
      current = btn.dataset.tpl;
      overlay.querySelectorAll("[data-tpl]").forEach((node) => node.classList.toggle("is-active", node === btn));
      regenerate();
    }));
    overlay.querySelectorAll("[data-ship-mode]").forEach((btn) => btn.addEventListener("click", () => {
      shipMode = btn.dataset.shipMode;
      overlay.querySelectorAll("[data-ship-mode]").forEach((node) => node.classList.toggle("is-active", node === btn));
      regenerate();
    }));
    carrierEl.addEventListener("input", regenerate);
    trackEl.addEventListener("input", regenerate);

    overlay.querySelector("[data-notify-copy]").addEventListener("click", async () => {
      const ok = await copyAdminText(textEl.value);
      toast(ok ? "คัดลอกข้อความแล้ว นำไปวางในแชทได้เลย" : "คัดลอกไม่สำเร็จ ลองเลือกข้อความแล้วคัดลอกเอง");
    });
    overlay.querySelectorAll("[data-notify-close]").forEach((btn) => btn.addEventListener("click", () => overlay.remove()));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
  }

  async function copyAdminText(text) {
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

  function orderDetailHtml(order) {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const itemsHtml = items.length
      ? `<ul class="detail-items">${items.map((item) => `<li>${escapeHtml(item.product_name || "")}${item.pack ? ` (${escapeHtml(item.pack)})` : ""} — ${escapeHtml(item.qty)} x ${money(item.price)} = <strong>${money(item.subtotal)}</strong></li>`).join("")}</ul>`
      : `<div class="admin-muted">ไม่มีรายการสินค้า</div>`;
    const rows = [];
    if (order.customer_phone) rows.push(["เบอร์โทร", escapeHtml(order.customer_phone)]);
    if (order.customer_address) rows.push(["ที่อยู่จัดส่ง", escapeHtml(order.customer_address)]);
    if (order.pay_method) rows.push(["ชำระเงิน", escapeHtml(order.pay_method)]);
    rows.push(["ค่าจัดส่ง", money(order.shipping_fee)]);
    rows.push(["ยอดรวมทั้งหมด", `<strong>${money(order.total)}</strong>`]);
    if (order.tax_required) rows.push(["ใบกำกับภาษี", escapeHtml(order.tax_info || "ต้องการใบกำกับภาษี")]);

    return `
      <div class="order-detail">
        <div class="order-detail-block">
          <h4>รายการสินค้า</h4>
          ${itemsHtml}
        </div>
        <div class="order-detail-block">
          <h4>ข้อมูลลูกค้า / จัดส่ง</h4>
          <table class="detail-kv">${rows.map(([key, val]) => `<tr><th>${key}</th><td>${val}</td></tr>`).join("")}</table>
          ${order.note ? `<div class="detail-note">${escapeHtml(order.note)}</div>` : ""}
        </div>
      </div>
    `;
  }

  async function updateOrderStatus(orderId, status) {
    await window.ShopServices.orderService.updateOrderStatus(orderId, status);
    toast("อัปเดตสถานะออเดอร์แล้ว");
    await loadOrdersView();
  }

  async function removeOrder(orderId) {
    const order = state.orders.find((item) => item.id === orderId);
    const label = order?.order_no || "ออเดอร์นี้";
    if (!window.confirm(`ลบ "${label}" ถาวร? ลบแล้วกู้คืนไม่ได้`)) return;
    try {
      await window.ShopServices.orderService.deleteOrder(orderId);
      toast("ลบออเดอร์แล้ว");
      await loadOrdersView();
    } catch (error) {
      console.error(error);
      toast(error.message || "ลบออเดอร์ไม่สำเร็จ");
    }
  }

  async function loadMembersView() {
    els.membersView.innerHTML = `<div class="admin-empty">กำลังโหลดสมาชิก</div>`;
    state.members = await window.ShopServices.memberService.loadMembers(state.shop.id);
    renderMembers();
  }

  function renderMembers() {
    if (!state.members.length) {
      els.membersView.innerHTML = `<div class="admin-empty">ยังไม่มีสมาชิก</div>`;
      return;
    }
    els.membersView.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>สมาชิก</th>
              <th>ระดับ</th>
              <th>คะแนน</th>
              <th>ยอดซื้อสะสม</th>
              <th>อัปเดตล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            ${state.members.map((member) => `
              <tr>
                <td><strong>${escapeHtml(member.display_name || "-")}</strong><div class="admin-muted">${escapeHtml(member.line_user_id)}</div></td>
                <td><span class="status-pill">${escapeHtml(member.tier)}</span></td>
                <td>${escapeHtml(member.points)}</td>
                <td>${money(member.total_spent)}</td>
                <td>${formatDate(member.updated_at)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function setLoading(message) {
    els.loginPanel.classList.add("is-hidden");
    els.dashboardPanel.classList.add("is-hidden");
    els.setupPanel.classList.remove("is-hidden");
    els.setupPanel.innerHTML = `<h2>${escapeHtml(message)}</h2><p>กรุณารอสักครู่</p>`;
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    els.toastWrap.append(node);
    setTimeout(() => node.remove(), 2800);
  }

  function money(value) {
    return `${window.SHOP_CONFIG?.currency || "฿"}${Number(value || 0).toLocaleString("th-TH")}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
})();
