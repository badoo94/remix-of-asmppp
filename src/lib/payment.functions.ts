import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Starts a Moneroo checkout for the signed-in user at today's price. */
export const startMonerooPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { returnUrl: string }) => {
    if (!/^https?:\/\//.test(input.returnUrl)) throw new Error("URL de retour invalide");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { MONEROO_API, getMonerooSecret } = await import("./moneroo.server");
    const { priceForDay, dayFromStart } = await import("./premium-offer");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email,display_name,created_at,is_premium")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Profil introuvable");
    if (profile.is_premium) throw new Error("Vous êtes déjà premium");

    const [{ data: prices }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("day_prices").select("day,amount").order("day"),
      supabaseAdmin.from("app_settings").select("config").eq("id", 1).maybeSingle(),
    ]);
    const list = (prices ?? []).map((p) => ({ day: p.day, amount: Number(p.amount) }));
    const total = list.length ? Math.max(...list.map((p) => p.day)) : 1;
    const day = dayFromStart(new Date(profile.created_at), total);
    const amount = priceForDay(list, day);
    const currency = ((settings?.config ?? {}) as { currency?: string }).currency || "EUR";

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({ user_id: context.userId, provider: "moneroo", amount, currency, status: "pending" })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error("Impossible de créer la commande");

    const secret = await getMonerooSecret();
    const name = (profile.display_name || profile.email || "Client").split(" ");
    const sep = data.returnUrl.includes("?") ? "&" : "?";
    const res = await fetch(`${MONEROO_API}/payments/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount),
        currency,
        description: `Offre premium — Jour ${day}`,
        return_url: `${data.returnUrl}${sep}moneroo=1`,
        customer: {
          email: profile.email ?? "client@example.com",
          first_name: name[0] || "Client",
          last_name: name.slice(1).join(" ") || "Premium",
        },
        metadata: { order_id: order.id, user_id: context.userId },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message?: string;
      data?: { id?: string; checkout_url?: string };
    };
    if (!res.ok || !json.data?.checkout_url || !json.data.id) {
      await supabaseAdmin.from("orders").update({ status: "failed", note: json.message ?? null }).eq("id", order.id);
      throw new Error(`Moneroo : ${json.message ?? "paiement indisponible"}`);
    }
    await supabaseAdmin.from("orders").update({ external_ref: json.data.id }).eq("id", order.id);
    return { checkoutUrl: json.data.checkout_url };
  });

/** Called when the user comes back from Moneroo: verifies and syncs premium status. */
export const confirmMonerooPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => {
    if (!input.paymentId || input.paymentId.length > 200) throw new Error("Paiement invalide");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { verifyAndSyncPayment } = await import("./moneroo.server");
    const result = await verifyAndSyncPayment(data.paymentId);
    if (result.userId && result.userId !== context.userId) return { ok: false };
    return { ok: result.ok, status: result.status ?? null };
  });
