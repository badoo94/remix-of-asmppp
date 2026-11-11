import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { distributeTextChunk } from "@/lib/ai.functions";
import { chunkPages, extractPdfPages } from "@/lib/pdf-text";

type Job = { chunks: string[]; next: number; position: number; created: number; note: string };

function friendly(e: unknown, part: number) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/failed to fetch|content-type|networkerror|load failed|network|timeout|504|502/i.test(msg)) {
    return `La connexion a été coupée pendant la partie ${part}. Cliquez sur « Reprendre » pour continuer là où ça s'est arrêté.`;
  }
  return `Partie ${part} : ${msg || "répartition impossible"}`;
}

/** "Ask box": the admin drops a PDF and the AI spreads its text into the A4 template pages. */
export function AiDistributor({ beforeRun }: { beforeRun: () => Promise<void> }) {
  const run = useServerFn(distributeTextChunk);
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [canResume, setCanResume] = useState(false);
  const job = useRef<Job | null>(null);

  async function process() {
    const j = job.current;
    if (!j) return;
    setBusy(true);
    setCanResume(false);
    try {
      for (; j.next < j.chunks.length; j.next++) {
        const i = j.next;
        setStatus(`Répartition par l'IA : partie ${i + 1} / ${j.chunks.length}…`);
        let pages;
        try {
          ({ pages } = await run({ data: { text: j.chunks[i] ?? "", note: j.note, part: i + 1, total: j.chunks.length } }));
        } catch (e) {
          throw new Error(friendly(e, i + 1));
        }
        if (pages.length) {
          const rows = pages.map((p) => ({
            position: ++j.position,
            type: p.type,
            partie: p.partie,
            chapitre: p.chapitre,
            titre: p.titre,
            sous_chapitre: p.sousChapitre,
            body: p.body,
          }));
          const { error } = await supabase.from("method_pages").insert(rows);
          if (error) throw new Error(`Partie ${i + 1} : ${error.message}`);
          j.created += rows.length;
        }
        setProgress(Math.round(((i + 1) / j.chunks.length) * 100));
      }
      await qc.invalidateQueries({ queryKey: ["method"] });
      setStatus(`Terminé : ${j.created} pages créées.`);
      toast.success(`${j.created} pages ajoutées à la méthode`);
      job.current = null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Répartition impossible";
      setStatus(msg);
      toast.error(msg);
      setCanResume(true);
      await qc.invalidateQueries({ queryKey: ["method"] });
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!file) {
      toast.error("Choisissez un PDF");
      return;
    }
    if (mode === "replace" && !window.confirm("Remplacer toutes les pages existantes de la méthode ?")) return;
    setBusy(true);
    setProgress(0);
    setCanResume(false);
    try {
      await beforeRun();
      setStatus("Lecture du PDF…");
      const chunks = chunkPages(await extractPdfPages(file));
      if (!chunks.length) throw new Error("Aucun texte trouvé dans ce PDF");
      let position = 0;
      if (mode === "replace") {
        const { error } = await supabase.from("method_pages").delete().gte("position", -1_000_000);
        if (error) throw error;
      } else {
        const { data } = await supabase.from("method_pages").select("position").order("position", { ascending: false }).limit(1);
        position = data?.[0]?.position ?? 0;
      }
      job.current = { chunks, next: 0, position, created: 0, note };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Répartition impossible";
      setStatus(msg);
      toast.error(msg);
      setBusy(false);
      return;
    }
    await process();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-brand-gold/30 bg-brand-inset p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-gold" />
        <h4 className="font-semibold">Ask box IA — répartir un PDF</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        L'IA recopie le texte mot pour mot et le répartit dans le design template existant, en ajoutant autant de pages que nécessaire.
      </p>
      <div className="space-y-1.5">
        <Label>PDF à répartir</Label>
        <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
      </div>
      <div className="space-y-1.5">
        <Label>Message pour l'IA (optionnel)</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : commence à la Partie 2" disabled={busy} />
      </div>
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as "append" | "replace")} className="flex gap-4">
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="append" /> Ajouter à la fin</label>
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="replace" /> Remplacer tout</label>
      </RadioGroup>
      {(busy || status) && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      )}
      {canResume && job.current && (
        <Button variant="gold" className="w-full" onClick={process} disabled={busy}>
          <RotateCw /> Reprendre à la partie {job.current.next + 1}
        </Button>
      )}
      <Button variant="cta" className="w-full" onClick={start} disabled={busy || !file}>
        {busy ? "Répartition en cours…" : "Lancer la répartition"}
      </Button>
    </div>
  );
}
