(function () {
  window.ShopServices = window.ShopServices || {};
  const core = () => window.ShopServices.core;

  async function loadMembers(shopId, filters = {}) {
    const supabase = core().requireSupabaseClient();
    let query = supabase
      .from("members")
      .select("id, shop_id, line_user_id, display_name, picture_url, points, total_spent, tier, created_at, updated_at")
      .eq("shop_id", shopId)
      .order("updated_at", { ascending: false });

    if (filters.search) query = query.ilike("display_name", `%${filters.search}%`);
    if (filters.tier) query = query.eq("tier", filters.tier);

    const { data, error } = await query;
    if (error) throw core().publicError("โหลดสมาชิกไม่สำเร็จ", error);
    return data || [];
  }

  async function loadMemberDetail(memberId) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase
      .from("members")
      .select("*, member_point_logs(id, points, reason, created_at)")
      .eq("id", memberId)
      .single();
    if (error) throw core().publicError("โหลดรายละเอียดสมาชิกไม่สำเร็จ", error);
    return data;
  }

  async function updateMemberTier(memberId, tier) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase.from("members").update({ tier }).eq("id", memberId).select().single();
    if (error) throw core().publicError("บันทึกระดับสมาชิกไม่สำเร็จ", error);
    return data;
  }

  async function addMemberPoints(memberId, points, reason) {
    const supabase = core().requireSupabaseClient();
    const { data: member, error: memberError } = await supabase.from("members").select("id, shop_id, points").eq("id", memberId).single();
    if (memberError) throw core().publicError("โหลดสมาชิกไม่สำเร็จ", memberError);

    const nextPoints = Math.max(0, Number(member.points || 0) + Number(points || 0));
    const { data, error } = await supabase.from("members").update({ points: nextPoints }).eq("id", memberId).select().single();
    if (error) throw core().publicError("อัปเดตคะแนนไม่สำเร็จ", error);

    await supabase.from("member_point_logs").insert({
      shop_id: member.shop_id,
      member_id: memberId,
      points: Number(points || 0),
      reason
    });

    return data;
  }

  async function getMemberSummary(payload) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase.rpc("get_member", { payload });
    if (error) throw core().publicError("โหลดข้อมูลสมาชิกไม่สำเร็จ", error);
    return data;
  }

  async function joinMemberViaRpc(payload) {
    const supabase = core().requireSupabaseClient();
    const { data, error } = await supabase.rpc("join_member", { payload });
    if (error) throw core().publicError("สมัครสมาชิกไม่สำเร็จ", error);
    if (data && data.ok === false) throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
    return data;
  }

  function membersToCsv(members) {
    const columns = ["line_user_id", "display_name", "points", "total_spent", "tier", "created_at"];
    const rows = [columns.join(",")];
    members.forEach((member) => {
      rows.push(columns.map((key) => csvEscape(member[key] ?? "")).join(","));
    });
    return rows.join("\n");
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  window.ShopServices.memberService = {
    loadMembers,
    loadMemberDetail,
    updateMemberTier,
    addMemberPoints,
    getMemberSummary,
    joinMemberViaRpc,
    membersToCsv
  };
})();
