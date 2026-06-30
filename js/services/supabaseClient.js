(function () {
  window.ShopServices = window.ShopServices || {};

  let cachedClient = null;

  function getSupabaseClient() {
    const config = window.SHOP_CONFIG || {};
    if (!config.useSupabase || !config.supabaseUrl || !config.supabaseAnonKey) return null;
    if (!window.supabase?.createClient) {
      console.error("Supabase SDK is not loaded");
      return null;
    }
    if (!cachedClient) {
      cachedClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    return cachedClient;
  }

  function requireSupabaseClient() {
    const client = getSupabaseClient();
    if (!client) throw new Error("ยังไม่ได้ตั้งค่า Supabase");
    return client;
  }

  function publicError(message, error) {
    if (error) console.error(message, error);
    const wrapped = new Error(message);
    wrapped.cause = error;
    return wrapped;
  }

  function normalizeBool(value) {
    if (typeof value === "boolean") return value;
    const text = String(value ?? "").trim().toLowerCase();
    if (["true", "1", "yes", "y", "ใช่", "เปิด", "active"].includes(text)) return true;
    if (["false", "0", "no", "n", "ไม่ใช่", "ปิด", "inactive"].includes(text)) return false;
    return Boolean(value);
  }

  function parseNumber(value, fallback = 0) {
    if (value === "" || value === null || value === undefined) return fallback;
    const parsed = Number(String(value).replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseNullableStock(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) throw new Error("สต็อกต้องว่างหรือเป็นจำนวนเต็ม >= 0");
    return parsed;
  }

  window.ShopServices.core = {
    getSupabaseClient,
    requireSupabaseClient,
    publicError,
    normalizeBool,
    parseNumber,
    parseNullableStock
  };
})();
