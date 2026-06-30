(function () {
  window.ShopServices = window.ShopServices || {};
  const core = () => window.ShopServices.core;

  async function getCurrentUser() {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw core().publicError("ตรวจผู้ใช้ไม่สำเร็จ", error);
    return data.user;
  }

  async function getAdminShopAccess(userId) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase
      .from("shop_admins")
      .select("shop_id, role, shops(id, slug, shop_name)")
      .eq("user_id", userId);
    if (error) throw core().publicError("บัญชีนี้ไม่มีสิทธิ์จัดการร้าน", error);
    return data || [];
  }

  async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) throw new Error("กรุณาเข้าสู่ระบบแอดมิน");
    const access = await getAdminShopAccess(user.id);
    if (!access.length) throw new Error("บัญชีนี้ไม่มีสิทธิ์จัดการร้าน");
    return { user, access };
  }

  async function logAudit(shopId, action, tableName, recordId, beforeData, afterData) {
    const supabase = core().requireSupabaseClient();
    const user = await getCurrentUser();
    const { error } = await supabase.from("audit_logs").insert({
      shop_id: shopId,
      user_id: user?.id || null,
      action,
      table_name: tableName,
      record_id: recordId,
      before_data: beforeData || null,
      after_data: afterData || null
    });
    if (error) console.error("บันทึก audit log ไม่สำเร็จ", error);
  }

  window.ShopServices.adminService = {
    getCurrentUser,
    requireAdmin,
    getAdminShopAccess,
    logAudit
  };
})();
