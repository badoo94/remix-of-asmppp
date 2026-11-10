import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/auth";
import { appSettingsQuery, DEFAULT_APP_CONFIG } from "@/lib/settings";
import { dayFromStart, dayPricesQuery, formatMoney, priceForDay } from "@/lib/premium-offer";
import { confirmMonerooPayment, startMonerooPayment } from "@/lib/payment.functions";

type Ctx = { startCheckout: (opts?: { url?: string | undefined }) => void; busy: boolean };
const PaymentCtx = createContext<Ctx>({ startCheckout: () => {}, busy: false });

export function usePremiumCheckout() {
  return useContext(PaymentCtx);
}

export function PaymentProvider({ children }: { children: ReactNode }) {
  const { user, profile, isPremium, refetch } = useAccess();
  const { data: settings = DEFAULT_APP_CONFIG } = useQuery(appSettingsQuery);
  const { data: prices = [] } = useQuery(dayPricesQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const startMoneroo = useServerFn(startMonerooPayment);
  const confirmMoneroo = useServerFn(confirmMonerooPayment);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Return from Moneroo checkout: verify and sync premium automatically.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    if (!params.get("moneroo") || !paymentId) return;
    confirmMoneroo({ data: { paymentId } })
      .then((r) => {
        if (r.ok) toast.success("Paiement confirmé : bienvenue dans l'offre premium !");
        else toast.error("Le paiement n'a pas été confirmé.");
        refetch();
        qc.invalidateQueries();
      })
      .catch(() => toast.error("Vérification du paiement impossible."))
      .finally(() => {
        const url = new URL(window.location.href);
        ["moneroo", "paymentId", "paymentStatus"].forEach((k) => url.searchParams.delete(k));
        window.history.replaceState({}, "", url.toString());
      });
  }, [user, confirmMoneroo, refetch, qc]);

  const startCheckout = useCallback(
    async (opts?: { url?: string | undefined }) => {
      if (isPremium) {
        toast.success("Vous profitez déjà de l'offre premium.");
        return;
      }
      if (settings.paymentMode === "external") {
        const url = opts?.url || settings.externalUrl;
        if (!url) {
          toast.error("Le lien de paiement n'est pas encore configuré.");
          return;
        }
        setExternalUrl(url);
        return;
      }
      if (!user || !profile) {
        toast.message("Connectez-vous pour obtenir l'offre premium.");
        navigate({ to: "/auth", search: { redirect: window.location.pathname } });
        return;
      }
      const total = prices.length ? Math.max(...prices.map((p) => p.day)) : 1;
      const amount = priceForDay(prices, dayFromStart(new Date(profile.created_at), total));
      setBusy(true);
      try {
        if (settings.paymentMode === "moneroo") {
          const { checkoutUrl } = await startMoneroo({ data: { returnUrl: window.location.href.split("#")[0] ?? window.location.href } });
          window.location.assign(checkoutUrl);
          return;
        }
        const { error } = await supabase
          .from("orders")
          .insert({ user_id: user.id, provider: "simple", amount, currency: settings.currency, status: "pending" });
        if (error) throw error;
        setOrderInfo(formatMoney(amount, settings.currency));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Paiement impossible");
      } finally {
        setBusy(false);
      }
    },
    [isPremium, settings, user, profile, prices, navigate, startMoneroo],
  );

  return (
    <PaymentCtx.Provider value={{ startCheckout, busy }}>
      {children}
      <Dialog open={!!externalUrl} onOpenChange={(o) => !o && setExternalUrl(null)}>
        <DialogContent className="flex h-[88vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <DialogTitle className="text-sm font-semibold">Offre premium</DialogTitle>
            <DialogDescription className="sr-only">Page de paiement externe</DialogDescription>
            <Button size="icon" variant="ghost" onClick={() => setExternalUrl(null)} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {externalUrl && (
            <iframe
              title="Paiement"
              src={externalUrl}
              className="h-full w-full flex-1 bg-background"
              allow="payment *; clipboard-write"
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!orderInfo} onOpenChange={(o) => !o && setOrderInfo(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Commande enregistrée</DialogTitle>
          <DialogDescription>
            Votre commande premium à {orderInfo} est enregistrée. Votre accès premium s'activera automatiquement dès que
            le paiement sera validé.
          </DialogDescription>
          <Button variant="cta" onClick={() => setOrderInfo(null)}>
            Compris
          </Button>
        </DialogContent>
      </Dialog>
    </PaymentCtx.Provider>
  );
}
