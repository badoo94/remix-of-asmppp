import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Dumbbell, LayoutDashboard, PenSquare, Settings } from "lucide-react";
import { useAccess } from "@/lib/auth";
import { methodQuery } from "@/lib/method";
import { appSettingsQuery, DEFAULT_APP_CONFIG } from "@/lib/settings";
import { SettingsModal } from "@/components/admin/SettingsModal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/au-stop-de-madame/edit")({
  head: () => ({
    meta: [
      { title: "Administration — Au stop de madame" },
      { name: "description", content: "Paramètres de l'application : contenu, IA, prix, paiement et exercices." },
      { property: "og:title", content: "Administration — Au stop de madame" },
      { property: "og:description", content: "Paramètres de l'application : contenu, IA, prix, paiement et exercices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const MODE_LABEL = { external: "🔗 URL externe", simple: "🛒 Commande simple", moneroo: "💳 Moneroo" } as const;

function AdminPage() {
  const { isAdmin, ready } = useAccess();
  const [open, setOpen] = useState(false);
  const { data: method } = useQuery(methodQuery);
  const { data: settings = DEFAULT_APP_CONFIG } = useQuery(appSettingsQuery);

  if (ready && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Accès réservé à l'administrateur</h1>
          <Link to="/au-stop-de-madame/app" className="mt-4 inline-block text-sm text-primary underline">Retour</Link>
        </div>
      </div>
    );
  }

  const cards = [
    { to: "/au-stop-de-madame/app/methode/set" as const, icon: PenSquare, title: "Éditeur de la méthode", text: `${method?.pages.length ?? 0} pages · rectangles et zones premium` },
    { to: "/au-stop-de-madame/app/methode" as const, icon: BookOpen, title: "Méthode (lecture publique)", text: "Voir le rendu final" },
    { to: "/au-stop-de-madame/app/exercices" as const, icon: Dumbbell, title: "Exercices", text: "Kegel classique, squat, ventre, premium" },
    { to: "/au-stop-de-madame/app" as const, icon: LayoutDashboard, title: "Tableau de bord", text: "Offre premium et compte à rebours" },
  ];

  return (
    <div className="bg-app min-h-screen">
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-gold">Au stop de madame</p>
            <h1 className="text-2xl font-bold">Administration</h1>
          </div>
          <Button variant="cta" onClick={() => setOpen(true)} className="h-11 px-5">
            <Settings /> Paramètres
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pages" value={String(method?.pages.length ?? 0)} />
          <Stat label="Police cadre" value={`${settings.fontSize} pt`} />
          <Stat label="Paiement" value={MODE_LABEL[settings.paymentMode]} />
          <Stat label="Tour du cercle" value={`${settings.secondsPerDay} s`} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <Link key={c.to} to={c.to} className="flex items-start gap-3 rounded-2xl border border-border bg-brand-card/90 p-4 transition hover:border-brand-gold/50">
              <c.icon className="mt-0.5 h-5 w-5 text-brand-gold" />
              <div>
                <h2 className="font-semibold">{c.title}</h2>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </div>
            </Link>
          ))}
        </section>
      </main>
      <SettingsModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-brand-inset p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold">{value}</p>
    </div>
  );
}
