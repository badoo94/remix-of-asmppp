import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { distributeTextChunk } from "@/lib/ai.functions";
import { chunkPages, extractPdfPages } from "@/lib/pdf-text";

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

  async function start() {
    if (!file) return toast.error("Choisissez un PDF");
    if (mode === "replace" && !window.confirm("Remplacer toutes les pages existantes de la méthode ?")) return;
    setBusy(true);
    setProgress(0);
    try {
      await beforeRun();
      setStatus("Lecture du PDF…");
      const pdfPages = await extractPdfPages(file);
      const chunks = chunkPages(pdfPages);
      if (!chunks.length) throw new Error("Aucun texte trouvé dans ce PDF");

      let position = 0;
      if (mode === "replace") {
        const { error } = await supabase.from("method_pages").delete().gte("position", -1_000_000);
        if (error) throw error;
      } else {
        const { data } = await supabase.from("method_pages").select("position").order("position", { ascending: false }).limit(1);
        position = data?.[0]?.position ?? 0;
      }

      let created = 0;
      for (let i = 0; i < chunks.length; i++) {
        setStatus(`Répartition par l'IA : partie ${i + 1} / ${chunks.length}…`);
        const { pages } = await run({ data: { text: chunks[i], note, part: i + 1, total: chunks.length } });
        if (pages.length) {
          const rows = pages.map((p) => ({
            position: ++position,
            type: p.type,
            partie: p.partie,
            chapitre: p.chapitre,
            titre: p.titre,
            sous_chapitre: p.sousChapitre,
            body: p.body,
          }));
          const { error } = await supabase.from("method_pages").insert(rows);
          if (error) throw error;
          created += rows.length;
        }
        setProgress(Math.round(((i + 1) / chunks.length) * 100));
      }
      await qc.invalidateQueries({ queryKey: ["method"] });
      setStatus(`Terminé : ${created} pages créées.`);
      toast.success(`${created} pages ajoutées à la méthode`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Répartition impossible";
      setStatus(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
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
      <Button variant="cta" className="w-full" onClick={start} disabled={busy || !file}>
        {busy ? "Répartition en cours…" : "Lancer la répartition"}
      </Button>
    </div>
  );
}
