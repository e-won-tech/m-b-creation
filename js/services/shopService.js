(function () {
  window.ShopServices = window.ShopServices || {};
  const core = () => window.ShopServices.core;

  async function getShopBySlug(slug) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase
      .from("shops")
      .select("id, slug, shop_name, tagline, logo_url, logo_public_id, liff_id, theme, contact_line_url, contact_phone, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error) throw core().publicError("ไม่พบข้อมูลร้าน", error);
    return data;
  }

  async function getAdminShops() {
    const supabase = core().requireSupabaseClient();
    const { data: access, error } = await supabase
      .from("shop_admins")
      .select("role, shops(id, slug, shop_name, tagline, logo_url, liff_id, theme, is_active)")
      .order("created_at", { ascending: false });

    if (error) throw core().publicError("บัญชีนี้ไม่มีสิทธิ์จัดการร้าน", error);
    return access || [];
  }

  async function updateShopSettings(shopId, payload) {
    const supabase = core().requireSupabaseClient();
    const allowed = ["shop_name", "tagline", "logo_url", "logo_public_id", "liff_id", "theme", "contact_line_url", "contact_phone", "is_active"];
    const clean = Object.fromEntries(Object.entries(payload || {}).filter(([key]) => allowed.includes(key)));
    const { data, error } = await supabase.from("shops").update(clean).eq("id", shopId).select().single();
    if (error) throw core().publicError("บันทึกข้อมูลร้านไม่สำเร็จ", error);
    return data;
  }

  window.ShopServices.shopService = {
    getShopBySlug,
    getAdminShops,
    updateShopSettings
  };
})();
