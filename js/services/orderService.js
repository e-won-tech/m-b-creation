(function () {
  window.ShopServices = window.ShopServices || {};
  const core = () => window.ShopServices.core;

  const ORDER_COLUMNS = "id, shop_id, order_no, line_user_id, line_display_name, customer_name, pay_method, note, tax_required, tax_info, total, status, line_message_sent, created_at, updated_at";

  function validateCartPayload(payload) {
    if (!payload?.shop_slug) throw new Error("ไม่พบร้านค้านี้");
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("ตะกร้าต้องไม่ว่าง");
    payload.items.forEach((item) => {
      if (!item.product_id) throw new Error("สินค้าแต่ละตัวต้องมี product_id");
      if (!Number.isInteger(Number(item.qty)) || Number(item.qty) <= 0) throw new Error("qty ต้องมากกว่า 0");
      if ("price" in item) delete item.price;
    });
    return payload;
  }

  async function createOrderFromCart(payload) {
    const supabase = core().requireSupabaseClient();
    const clean = validateCartPayload(JSON.parse(JSON.stringify(payload)));
    const { data, error } = await supabase.rpc("create_order_from_cart", { payload: clean });
    if (error) throw core().publicError("สร้างออเดอร์ไม่สำเร็จ", error);
    if (data && data.ok === false) throw new Error(data.error || "สร้างออเดอร์ไม่สำเร็จ");
    return data;
  }

  async function loadOrders(shopId, filters = {}) {
    const supabase = core().requireSupabaseClient();
    let query = supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);

    const { data, error } = await query;
    if (error) throw core().publicError("โหลดออเดอร์ไม่สำเร็จ", error);
    return data || [];
  }

  async function loadOrderDetail(orderId) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase
      .from("orders")
      .select(`${ORDER_COLUMNS}, order_items(id, product_id, product_name, pack, qty, price, subtotal)`)
      .eq("id", orderId)
      .single();
    if (error) throw core().publicError("โหลดรายละเอียดออเดอร์ไม่สำเร็จ", error);
    return data;
  }

  async function updateOrderStatus(orderId, status) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase.from("orders").update({ status }).eq("id", orderId).select(ORDER_COLUMNS).single();
    if (error) throw core().publicError("อัปเดตสถานะออเดอร์ไม่สำเร็จ", error);
    return data;
  }

  async function deleteOrder(orderId) {
    const supabase = core().requireSupabaseClient();
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) throw core().publicError("ลบออเดอร์ไม่สำเร็จ", error);
    return true;
  }

  async function getSalesSummary(shopId, range = {}) {
    const orders = await loadOrders(shopId, { ...range });
    const paidOrders = orders.filter((order) => order.status !== "cancelled");
    return {
      orderCount: paidOrders.length,
      totalSales: paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      pendingCount: orders.filter((order) => order.status === "pending").length
    };
  }

  function subscribeNewOrders(shopId, onOrder) {
    const supabase = core().getSupabaseClient();
    if (!supabase?.channel) return null;
    return supabase
      .channel(`orders:${shopId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `shop_id=eq.${shopId}` }, (payload) => onOrder?.(payload.new))
      .subscribe();
  }

  function ordersToCsv(orders) {
    const columns = ["order_no", "customer_name", "pay_method", "total", "status", "created_at"];
    const rows = [columns.join(",")];
    orders.forEach((order) => {
      rows.push(columns.map((key) => csvEscape(order[key] ?? "")).join(","));
    });
    return rows.join("\n");
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  window.ShopServices.orderService = {
    createOrderFromCart,
    loadOrders,
    loadOrderDetail,
    updateOrderStatus,
    deleteOrder,
    getSalesSummary,
    subscribeNewOrders,
    ordersToCsv,
    validateCartPayload
  };
})();
