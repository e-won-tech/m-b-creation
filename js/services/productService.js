(function () {
  window.ShopServices = window.ShopServices || {};
  const core = () => window.ShopServices.core;

  const PRODUCT_COLUMNS = "id, shop_id, category_id, category_name, name, pack, price, description, usage_rate, icon_name, image_url, image_public_id, image2_url, image2_public_id, stock, is_sack, featured, active, sort_order, created_at, updated_at";
  const CSV_COLUMNS = ["category_name", "name", "pack", "price", "description", "usage_rate", "icon_name", "image_url", "image2_url", "stock", "is_sack", "featured", "active", "sort_order"];

  function validateProductPayload(payload, { partial = false } = {}) {
    const clean = { ...payload };
    if (!partial && !String(clean.name || "").trim()) throw new Error("ชื่อสินค้าต้องไม่ว่าง");
    if (clean.name !== undefined) clean.name = String(clean.name).trim();
    if (clean.price !== undefined) {
      clean.price = core().parseNumber(clean.price);
      if (clean.price < 0) throw new Error("ราคาต้องเป็นตัวเลข >= 0");
    }
    if (clean.stock !== undefined) clean.stock = core().parseNullableStock(clean.stock);
    if (clean.active !== undefined) clean.active = core().normalizeBool(clean.active);
    if (clean.featured !== undefined) clean.featured = core().normalizeBool(clean.featured);
    if (clean.is_sack !== undefined) clean.is_sack = core().normalizeBool(clean.is_sack);
    if (clean.sort_order !== undefined) clean.sort_order = Number.parseInt(clean.sort_order || 0, 10);
    if (clean.icon_name === undefined) clean.icon_name = "package";
    return clean;
  }

  async function loadProducts(shopId, options = {}) {
    const supabase = core().requireSupabaseClient();
    let query = supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (options.activeOnly !== false) query = query.eq("active", true);
    if (options.featuredOnly) query = query.eq("featured", true);
    if (options.categoryId) query = query.eq("category_id", options.categoryId);

    const { data, error } = await query;
    if (error) throw core().publicError("โหลดสินค้าไม่สำเร็จ", error);
    return data || [];
  }

  async function loadCategories(shopId, options = {}) {
    const supabase = core().requireSupabaseClient();
    let query = supabase
      .from("categories")
      .select("id, shop_id, name, sort_order, active")
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true });

    if (options.activeOnly !== false) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw core().publicError("โหลดหมวดหมู่ไม่สำเร็จ", error);
    return data || [];
  }

  async function createProduct(shopId, payload) {
    const supabase = core().requireSupabaseClient();
    const clean = validateProductPayload({ ...payload, shop_id: shopId });
    const { data, error } = await supabase.from("products").insert(clean).select(PRODUCT_COLUMNS).single();
    if (error) throw core().publicError("บันทึกสินค้าไม่สำเร็จ", error);
    return data;
  }

  async function updateProduct(productId, payload) {
    const supabase = core().requireSupabaseClient();
    const clean = validateProductPayload(payload, { partial: true });
    const { data, error } = await supabase.from("products").update(clean).eq("id", productId).select(PRODUCT_COLUMNS).single();
    if (error) throw core().publicError("บันทึกสินค้าไม่สำเร็จ", error);
    return data;
  }

  async function softDeleteProduct(productId) {
    return updateProduct(productId, { active: false });
  }

  async function deleteProduct(productId) {
    const supabase = core().requireSupabaseClient();
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw core().publicError("ลบสินค้าไม่สำเร็จ", error);
    return true;
  }

  async function toggleProductActive(productId, active) {
    return updateProduct(productId, { active });
  }

  async function toggleProductFeatured(productId, featured) {
    return updateProduct(productId, { featured });
  }

  async function updateProductStock(productId, stock) {
    return updateProduct(productId, { stock });
  }

  function productsToCsv(products) {
    const rows = [CSV_COLUMNS.join(",")];
    products.forEach((product) => {
      rows.push(CSV_COLUMNS.map((key) => csvEscape(product[key] ?? "")).join(","));
    });
    return rows.join("\n");
  }

  function parseProductsCsv(csv) {
    const rows = parseCsv(csv).filter((row) => row.some(Boolean));
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index] ?? "";
      });
      return validateProductPayload(item);
    });
  }

  async function exportProductsCsv(shopId) {
    const products = await loadProducts(shopId, { activeOnly: false });
    return productsToCsv(products);
  }

  async function importProductsCsv(shopId, csv, { mode = "create" } = {}) {
    const supabase = core().requireSupabaseClient();
    const rows = parseProductsCsv(csv).map((row) => ({ ...row, shop_id: shopId }));
    if (!rows.length) return [];

    if (mode === "upsertByName") {
      const results = [];
      for (const row of rows) {
        const { data: existing, error: findError } = await supabase
          .from("products")
          .select("id")
          .eq("shop_id", shopId)
          .eq("name", row.name)
          .maybeSingle();
        if (findError) throw core().publicError("ตรวจสินค้าซ้ำไม่สำเร็จ", findError);
        results.push(existing ? await updateProduct(existing.id, row) : await createProduct(shopId, row));
      }
      return results;
    }

    const { data, error } = await supabase.from("products").insert(rows).select(PRODUCT_COLUMNS);
    if (error) throw core().publicError("นำเข้าสินค้าไม่สำเร็จ", error);
    return data || [];
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

  window.ShopServices.productService = {
    loadProducts,
    loadCategories,
    createProduct,
    updateProduct,
    softDeleteProduct,
    deleteProduct,
    toggleProductActive,
    toggleProductFeatured,
    updateProductStock,
    exportProductsCsv,
    importProductsCsv,
    validateProductPayload
  };
})();
