import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Crown, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/auth";
import { appSettingsQuery, DEFAULT_APP_CONFIG } from "@/lib/settings";
import { dayFromStart, dayPricesQuery } from "@/lib/premium-offer";
import { PremiumCountdown } from "@/components/dashboard/PremiumCountdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/au-stop-de-madame/app/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Au stop de madame" },
      { name: "description", content: "Votre tableau de bord : offre premium du jour, méthode et exercices." },
      { property: "og:title", content: "Tableau de bord — Au stop de madame" },
      { property: "og:description", content: "Votre tableau de bord : offre premium du jour, méthode et exercices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, isPremium, isAdmin, ready, refetch } = useAccess();
  const { data: settings = DEFAULT_APP_CONFIG } = useQuery(appSettingsQuery);
  const { data: prices = [] } = useQuery(dayPricesQuery);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [activating, setActivating] = useState(false);

  const signupAt = profile ? new Date(profile.created_at) : new Date();
  const totalDays = prices.length ? Math.max(...prices.map((p) => p.day)) : 1;
  const today = dayFromStart(signupAt, totalDays);

  async function activate() {
    if (!code.trim()) return;
    setActivating(true);
    const { data, error } = await supabase.rpc("redeem_activation_code", { _code: code.trim() });
    setActivating(false);
    if (error || !data) {
      toast.error("Code invalide ou déjà utilisé.");
      return;
    }
    toast.success("Code activé : votre accès premium est ouvert !");
    setCode("");
    refetch();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined } });
  }

  return (
    <div className="bg-app flex min-h-screen justify-center">
      <main className="flex min-h-screen w-full max-w-[430px] flex-col gap-4 overflow-x-hidden px-4 py-5 pb-12">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-border/80 bg-brand-inset/90 px-5 py-3 text-[15px] font-medium tracking-wide text-foreground/85 shadow-sm transition active:scale-[0.99]"
            >
              <span>Overview mode</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56">
            <DropdownMenuItem asChild>
              <Link to="/au-stop-de-madame/app">Vue d'ensemble</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/au-stop-de-madame/app/methode">Méthode</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/au-stop-de-madame/app/exercices">Exercices</Link>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/au-stop-de-madame/edit">Administration</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/au-stop-de-madame/app/methode/set">Éditeur de la méthode</Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>Se déconnecter</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <section className="flex items-center justify-between rounded-3xl border border-border/60 bg-header-card p-5 shadow-lg">
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="text-sm text-muted-foreground">Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}</p>
            <p className="pt-1 text-xs font-medium text-foreground/80">
              Plan : <span className="text-foreground">{isPremium ? "offre premium" : "offre gratuit"}</span>
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Profil utilisateur"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-avatar text-foreground shadow-md active:opacity-90"
              >
                <User className="h-6 w-6" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{profile?.email}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>Se déconnecter</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        {ready && !isPremium && prices.length > 0 && (
          <PremiumCountdown prices={prices} today={today} signupAt={signupAt} settings={settings} />
        )}

        {ready && isPremium && (
          <section className="flex items-center gap-4 rounded-3xl border border-brand-gold/50 bg-brand-card/90 p-5 shadow-glow">
            <Crown className="h-10 w-10 text-brand-gold" />
            <div>
              <h2 className="font-bold">Accès premium actif</h2>
              <p className="text-sm text-muted-foreground">Toute la méthode, la lecture audio et tous les exercices sont débloqués.</p>
            </div>
          </section>
        )}

        {ready && !isPremium && (
          <section className="rounded-2xl border border-brand-gold/25 bg-activation p-4 shadow-sm">
            <h3 className="text-sm font-bold">Votre accès Premium commence ici</h3>
            <p className="mb-3 text-xs text-muted-foreground">Entrez votre code d'activation</p>
            <div className="flex items-center gap-2">
              <input
                aria-label="Code d'activation"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                className="min-w-0 flex-1 rounded-xl border border-input bg-brand-inset px-3 py-2 font-mono text-sm tracking-wider text-foreground/85 focus:border-brand-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={activate}
                disabled={activating}
                className="rounded-xl bg-gold px-5 py-2 text-sm font-bold text-brand-ink shadow-md transition active:scale-95"
              >
                Activer
              </button>
            </div>
          </section>
        )}

        <nav aria-label="Sections complémentaires" className="flex flex-col gap-3 pt-1">
          <Link
            to="/au-stop-de-madame/app/methode"
            className="flex w-full items-center gap-4 rounded-3xl bg-brand-cream p-3 text-brand-ink shadow-md transition hover:bg-brand-cream-hover active:scale-[0.99]"
          >
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-ink/15 bg-page p-1 shadow-inner">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-brand-ink/10 bg-page p-1 text-center">
                <span className="text-[6px] font-bold uppercase leading-none tracking-widest text-brand-ink/60">Méthode</span>
                <span className="mb-1 text-[5px] uppercase leading-none text-brand-ink/50">au stop</span>
                <svg className="h-5 w-5 text-apex-emerald" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 4v16M4 12h16" />
                </svg>
                <span className="mt-1 text-[4px] text-brand-ink/50">DE MADAME</span>
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight">Méthode</span>
          </Link>
          <Link
            to="/au-stop-de-madame/app/exercices"
            className="flex w-full items-center gap-4 rounded-3xl bg-brand-cream p-3 text-brand-ink shadow-md transition hover:bg-brand-cream-hover active:scale-[0.99]"
          >
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-ink/15 bg-page shadow-inner">
              <svg className="h-10 w-10 text-brand-ink/80" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v7" />
                <path d="M7 11l5-2 5 2" />
                <path d="M6 14l1-3M18 14l-1-3" />
                <path d="M8 18l4-3 4 3" />
                <path d="M5 19l3-1M19 19l-3-1" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">Exercice</span>
          </Link>
        </nav>
      </main>
    </div>
  );
}
