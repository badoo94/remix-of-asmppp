// Server-only helpers for Moneroo payments. Imported dynamically inside handlers.
export const MONEROO_API = "https://api.moneroo.io/v1";

export async function getMonerooSecret(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("admin_settings").select("config").eq("id", 1).maybeSingle();
  const cfg = (data?.config ?? {}) as { monerooSecretKey?: string };
  if (!cfg.monerooSecretKey) throw new Error("Moneroo n'est pas configuré");
  return cfg.monerooSecretKey;
}

type VerifyResult = { ok: boolean; status?: string; orderId?: string; userId?: string };

/** Ask Moneroo for the real status of a payment, then mark the matching order paid. */
export async function verifyAndSyncPayment(paymentId: string): Promise<VerifyResult> {
  const secret = await getMonerooSecret();
  const res = await fetch(`${MONEROO_API}/payments/${encodeURIComponent(paymentId)}/verify`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { status?: string; metadata?: Record<string, string> };
  };
  if (!res.ok) return { ok: false };
  const status = json.data?.status;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id,user_id,status")
    .eq("external_ref", paymentId)
    .maybeSingle();
  if (!order) return { ok: false, status };
  if (status === "success" && order.status !== "paid") {
    await supabaseAdmin.from("orders").update({ status: "paid" }).eq("id", order.id);
  }
  return { ok: status === "success", status, orderId: order.id, userId: order.user_id };
}
