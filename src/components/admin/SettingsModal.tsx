import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  appSettingsQuery,
  DEFAULT_AI_INSTRUCTION,
  DEFAULT_APP_CONFIG,
  DEFAULT_ADMIN_CONFIG,
  loadAdminConfig,
  saveAdminConfig,
  saveAppConfig,
  type AdminConfig,
  type AppConfig,
  type ExerciseKey,
} from "@/lib/settings";
import { dayPricesQuery, formatMoney, type DayPrice } from "@/lib/premium-offer";
import { uploadPremiumFile } from "@/lib/upload";
import { AiDistributor } from "./AiDistributor";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

export function SettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: appCfg } = useQuery(appSettingsQuery);
  const { data: priceRows } = useQuery(dayPricesQuery);
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [admin, setAdmin] = useState<AdminConfig>(DEFAULT_ADMIN_CONFIG);
  const [prices, setPrices] = useState<DayPrice[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (appCfg) setCfg(appCfg);
    if (priceRows) setPrices(priceRows);
    loadAdminConfig().then(setAdmin).catch(() => {});
  }, [open, appCfg, priceRows]);

  const set = (patch: Partial<AppConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setA = (patch: Partial<AdminConfig>) => setAdmin((c) => ({ ...c, ...patch }));

  async function saveAll(silent = false) {
    setSaving(true);
    try {
      const clean = prices.filter((p) => p.day > 0).sort((a, b) => a.day - b.day);
      const days = new Set(clean.map((p) => p.day));
      if (days.size !== clean.length) throw new Error("Chaque jour ne peut avoir qu'un seul prix.");
      await saveAppConfig(cfg);
      await saveAdminConfig(admin);
      const { error: delErr } = await supabase.from("day_prices").delete().gte("day", -1_000_000);
      if (delErr) throw delErr;
      if (clean.length) {
        const { error } = await supabase.from("day_prices").insert(clean.map((p) => ({ day: p.day, amount: p.amount })));
        if (error) throw error;
      }
      await qc.invalidateQueries();
      if (!silent) toast.success("Paramètres enregistrés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle>Paramètres</DialogTitle>
          <DialogDescription>Contenu, IA, prix, paiement et exercices.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="content" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="content">Contenu interne</TabsTrigger>
            <TabsTrigger value="ai">IA</TabsTrigger>
            <TabsTrigger value="prices">Prix / Temps</TabsTrigger>
            <TabsTrigger value="payment">Paiement</TabsTrigger>
            <TabsTrigger value="exercises">Exercices</TabsTrigger>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsContent value="content" className="mt-0 space-y-5">
              <Row label="Utiliser le contenu interne" hint="Le contenu interne est le rendu visuel de la page Méthode.">
                <Switch checked={cfg.useInternalContent} onCheckedChange={(v) => set({ useInternalContent: v })} />
              </Row>
              <div className="space-y-2">
                <Label>Taille de police du cadre (Inter) : {cfg.fontSize} pt</Label>
                <Slider min={8} max={28} step={0.5} value={[cfg.fontSize]} onValueChange={([v]) => set({ fontSize: v })} />
                <p className="text-xs text-muted-foreground">Le texte réduit automatiquement si un cadre déborde, pour rester entièrement visible.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Mention du pied de page</Label>
                <Input value={cfg.footerText} onChange={(e) => set({ footerText: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary"><Link to="/au-stop-de-madame/app/methode/set">Ouvrir l'éditeur de pages</Link></Button>
                <Button asChild variant="outline"><Link to="/au-stop-de-madame/app/methode">Voir la page publique</Link></Button>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-0 space-y-5">
              <div className="space-y-2">
                <Label>Fournisseur d'IA</Label>
                <RadioGroup value={admin.aiProvider} onValueChange={(v) => setA({ aiProvider: v as AdminConfig["aiProvider"] })} className="gap-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="lovable" /> IA de Lovable (sans clé)</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="gemini" /> Ma clé Google Gemini</label>
                </RadioGroup>
              </div>
              {admin.aiProvider === "gemini" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Clé API Gemini</Label>
                    <Input type="password" value={admin.geminiKey} onChange={(e) => setA({ geminiKey: e.target.value })} placeholder="AIza…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modèle Gemini</Label>
                    <Select value={admin.geminiModel} onValueChange={(v) => setA({ geminiModel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GEMINI_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Instruction pour l'IA</Label>
                  <button type="button" className="text-xs text-primary underline" onClick={() => setA({ aiInstruction: DEFAULT_AI_INSTRUCTION })}>
                    Rétablir l'instruction par défaut
                  </button>
                </div>
                <Textarea rows={10} className="text-xs" value={admin.aiInstruction} onChange={(e) => setA({ aiInstruction: e.target.value })} />
              </div>
              <AiDistributor beforeRun={() => saveAll(true)} />
            </TabsContent>

            <TabsContent value="prices" className="mt-0 space-y-5">
              <p className="text-sm text-muted-foreground">
                Associez un montant à un temps passé (en jours) sur l'offre gratuite. Affiché en jj/hh/mm/ss par le minuteur et en jours par le cercle.
              </p>
              <div className="space-y-2">
                {prices.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-12 text-sm text-muted-foreground">Jour</span>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={p.day}
                      onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, day: parseInt(e.target.value) || 0 } : x)))}
                    />
                    <span className="text-sm">=</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      value={p.amount}
                      onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))}
                    />
                    <span className="text-sm text-muted-foreground">{cfg.currency}</span>
                    <Button size="icon" variant="ghost" onClick={() => setPrices(prices.filter((_, j) => j !== i))} aria-label="Supprimer">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => {
                    const last = prices[prices.length - 1];
                    setPrices([...prices, { day: (last?.day ?? 0) + 1, amount: (last?.amount ?? 0) + 5 }]);
                  }}
                >
                  <Plus /> Ajouter une règle Prix = Temps
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Durée d'un tour du cercle (secondes)</Label>
                  <Input type="number" min={1} value={cfg.secondsPerDay} onChange={(e) => set({ secondsPerDay: parseInt(e.target.value) || 6 })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Devise</Label>
                  <Input value={cfg.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase().slice(0, 3) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Introduction du jour actuel</Label>
                <Input value={cfg.introToday} onChange={(e) => set({ introToday: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Introduction des autres jours</Label>
                <Input value={cfg.introLater} onChange={(e) => set({ introLater: e.target.value })} />
              </div>
            </TabsContent>

            <TabsContent value="payment" className="mt-0 space-y-5">
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <RadioGroup value={cfg.paymentMode} onValueChange={(v) => set({ paymentMode: v as AppConfig["paymentMode"] })} className="gap-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="external" /> 🔗 URL externe</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="simple" /> 🛒 Commande simple</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="moneroo" /> 💳 Moneroo</label>
                </RadioGroup>
              </div>
              {cfg.paymentMode === "external" && (
                <>
                  <div className="space-y-1.5">
                    <Label>URL externe de paiement</Label>
                    <Input value={cfg.externalUrl} onChange={(e) => set({ externalUrl: e.target.value })} placeholder="https://…" />
                    <p className="text-xs text-muted-foreground">S'ouvre dans une fenêtre popup sans quitter la page.</p>
                  </div>
                  <ActivationCodes />
                </>
              )}
              {cfg.paymentMode === "moneroo" && (
                <div className="space-y-1.5">
                  <Label>Clé secrète Moneroo</Label>
                  <Input type="password" value={admin.monerooSecretKey} onChange={(e) => setA({ monerooSecretKey: e.target.value })} placeholder="sk_…" />
                  <p className="text-xs text-muted-foreground">
                    Le compte devient premium automatiquement après le paiement. Webhook Moneroo : <code>/api/public/moneroo-webhook</code>
                  </p>
                </div>
              )}
              {cfg.paymentMode !== "external" && <Orders currency={cfg.currency} />}
            </TabsContent>

            <TabsContent value="exercises" className="mt-0 space-y-6">
              <PremiumContentEditor keyName="flux" title="Kegel FluxControl ⚡ Premium" />
              <PremiumContentEditor keyName="respiratory" title="Kegel respiratoire 💨 Premium" />
              <div className="space-y-3">
                <h4 className="font-semibold">📌 Règles de pratique</h4>
                {(["classic", "squat", "belly"] as ExerciseKey[]).map((k) => (
                  <div key={k} className="space-y-2 rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">{k === "classic" ? "Kegel classique" : k === "squat" ? "Kegel Squat" : "Kegel Ventre"}</p>
                    {(["fr", "en"] as const).map((l) => (
                      <div key={l} className="space-y-1">
                        <Label className="text-xs uppercase text-muted-foreground">{l}</Label>
                        <Textarea
                          rows={3}
                          value={cfg.practiceRules[l][k]}
                          onChange={(e) =>
                            set({ practiceRules: { ...cfg.practiceRules, [l]: { ...cfg.practiceRules[l], [k]: e.target.value } } })
                          }
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <Users />
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex justify-end gap-2 border-t border-border p-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button variant="cta" onClick={() => saveAll()} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function randomCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join("");
  return `${pick()}-${pick()}`;
}

function ActivationCodes() {
  const { data = [], refetch } = useQuery({
    queryKey: ["activation_codes"],
    queryFn: async () => {
      const { data } = await supabase.from("activation_codes").select("id,code,used_by,used_at,created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [custom, setCustom] = useState("");
  async function add(code: string) {
    const { error } = await supabase.from("activation_codes").insert({ code: code.trim().toUpperCase() });
    if (error) toast.error(error.message.includes("duplicate") ? "Ce code existe déjà" : error.message);
    else {
      setCustom("");
      refetch();
    }
  }
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <h4 className="font-semibold">Codes d'accès premium</h4>
      <div className="flex flex-wrap gap-2">
        <Input className="w-40" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="XXXX-XXXX" />
        <Button variant="secondary" onClick={() => custom.trim() && add(custom)}>Ajouter</Button>
        <Button variant="secondary" onClick={() => add(randomCode())}><Plus /> Générer</Button>
      </div>
      <ul className="max-h-60 space-y-1 overflow-y-auto">
        {data.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-sm">
            <span className="font-mono">{c.code}</span>
            <span className="flex items-center gap-2">
              <span className={c.used_by ? "text-xs text-muted-foreground" : "text-xs text-brand-gold"}>{c.used_by ? "utilisé" : "disponible"}</span>
              <Button size="icon" variant="ghost" aria-label="Copier" onClick={() => navigator.clipboard.writeText(c.code).then(() => toast.success("Copié"))}>
                <Copy />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Supprimer"
                onClick={async () => {
                  await supabase.from("activation_codes").delete().eq("id", c.id);
                  refetch();
                }}
              >
                <Trash2 />
              </Button>
            </span>
          </li>
        ))}
        {data.length === 0 && <li className="text-xs text-muted-foreground">Aucun code pour l'instant.</li>}
      </ul>
    </div>
  );
}

function Orders({ currency }: { currency: string }) {
  const { data = [], refetch } = useQuery({
    queryKey: ["orders_admin"],
    queryFn: async () => {
      const [{ data: orders }, { data: profiles }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("id,email"),
      ]);
      const emails = new Map((profiles ?? []).map((p) => [p.id, p.email]));
      return (orders ?? []).map((o) => ({ ...o, email: emails.get(o.user_id) ?? o.user_id }));
    },
  });
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <h4 className="font-semibold">Commandes</h4>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {data.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{o.email}</span>
            <span className="text-xs text-muted-foreground">
              {o.provider} · {formatMoney(Number(o.amount), o.currency || currency)} · {new Date(o.created_at).toLocaleDateString("fr-FR")}
            </span>
            {o.status === "paid" ? (
              <span className="text-xs font-semibold text-brand-gold">payée ✓</span>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const { error } = await supabase.from("orders").update({ status: "paid" }).eq("id", o.id);
                  if (error) toast.error(error.message);
                  else toast.success("Commande validée : l'utilisateur est premium");
                  refetch();
                }}
              >
                Marquer payée
              </Button>
            )}
          </li>
        ))}
        {data.length === 0 && <li className="text-xs text-muted-foreground">Aucune commande.</li>}
      </ul>
    </div>
  );
}

function PremiumContentEditor({ keyName, title }: { keyName: "flux" | "respiratory"; title: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["premium_content", keyName],
    queryFn: async () => {
      const { data } = await supabase.from("premium_content").select("mode,html,pdf_path").eq("key", keyName).maybeSingle();
      return data;
    },
  });
  const [mode, setMode] = useState<"text" | "pdf">("text");
  const [html, setHtml] = useState("");
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) {
      setMode(data.mode === "pdf" ? "pdf" : "text");
      setHtml(data.html ?? "");
      setPdfPath(data.pdf_path);
    }
  }, [data]);

  async function save(next?: { pdf_path?: string | null }) {
    setBusy(true);
    const { error } = await supabase
      .from("premium_content")
      .upsert({ key: keyName, mode, html, pdf_path: next?.pdf_path !== undefined ? next.pdf_path : pdfPath, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${title} enregistré`);
      qc.invalidateQueries({ queryKey: ["premium_content_status"] });
      qc.invalidateQueries({ queryKey: ["premium_content", keyName] });
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <h4 className="font-semibold">{title}</h4>
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as "text" | "pdf")} className="flex gap-4">
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="text" /> Texte / script HTML</label>
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="pdf" /> PDF</label>
      </RadioGroup>
      {mode === "text" ? (
        <Textarea rows={6} className="font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} placeholder="Texte ou <html>…</html>" />
      ) : (
        <div className="space-y-1">
          <Input
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                const path = await uploadPremiumFile(f);
                setPdfPath(path);
                await save({ pdf_path: path });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Échec");
                setBusy(false);
              }
            }}
          />
          {pdfPath && <p className="text-xs text-muted-foreground">PDF téléversé ✓</p>}
        </div>
      )}
      <Button size="sm" variant="secondary" onClick={() => save()} disabled={busy}>Enregistrer ce contenu</Button>
    </div>
  );
}

function Users() {
  const { data = [], refetch } = useQuery({
    queryKey: ["profiles_admin"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,email,is_premium,created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <ul className="space-y-1">
      {data.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{u.email}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {new Date(u.created_at).toLocaleDateString("fr-FR")}
            <Switch
              checked={u.is_premium}
              onCheckedChange={async (v) => {
                const { error } = await supabase.from("profiles").update({ is_premium: v, premium_since: v ? new Date().toISOString() : null }).eq("id", u.id);
                if (error) toast.error(error.message);
                refetch();
              }}
            />
            premium
          </span>
        </li>
      ))}
    </ul>
  );
}
