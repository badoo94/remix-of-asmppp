import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContentType, MaskStyle, MethodRect } from "@/lib/method";
import { uploadMedia } from "@/lib/upload";
import { DESIGN_OPTIONS, FONT_OPTIONS } from "./RectContent";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "video", label: "Vidéo" },
  { value: "html", label: "Script HTML" },
  { value: "text", label: "Texte" },
  { value: "button_url", label: "Bouton-url" },
  { value: "button_reveal", label: "Bouton (révéler un rectangle)" },
];

interface Props {
  rect: MethodRect | null;
  allRects: MethodRect[];
  pageNumberOf: (pageId: string) => number;
  onClose: () => void;
  onSave: (r: MethodRect) => void;
  onDelete: (id: string) => void;
}

export function RectConfigDialog({ rect, allRects, pageNumberOf, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<MethodRect | null>(rect);
  const [uploading, setUploading] = useState(false);
  useEffect(() => setDraft(rect), [rect]);
  if (!draft) return null;
  const c = draft.config;
  const setC = (patch: Partial<MethodRect["config"]>) => setDraft({ ...draft, config: { ...draft.config, ...patch } });
  const isMask = draft.kind === "mask";

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setC({ mediaUrl: await uploadMedia(file) });
      toast.success("Fichier téléversé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  }

  const targets = allRects.filter((r) => r.kind === "content" && r.id !== draft.id && r.config.contentType !== "button_reveal");

  return (
    <Dialog open={!!rect} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isMask ? "Zone premium (rectangle de floutage)" : "Rectangle de contenu"}</DialogTitle>
          <DialogDescription>
            {isMask ? "Réglez le style et l'intensité du floutage." : "Choisissez le type de contenu affiché dans le rectangle."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isMask ? (
            <>
              <div className="space-y-1.5">
                <Label>Style</Label>
                <Select value={c.style ?? "blur"} onValueChange={(v) => setC({ style: v as MaskStyle })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blur">Flou (blur)</SelectItem>
                    <SelectItem value="opaque">Opaque</SelectItem>
                    <SelectItem value="gradient">Dégradé</SelectItem>
                    <SelectItem value="premium">Texte premium + bouton CTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Intensité du flou : {c.blur ?? 12}px</Label>
                <Slider min={0} max={40} step={1} value={[c.blur ?? 12]} onValueChange={([v]) => setC({ blur: v })} />
              </div>
              <div className="space-y-2">
                <Label>Opacité : {c.opacity ?? 60}%</Label>
                <Slider min={0} max={100} step={1} value={[c.opacity ?? 60]} onValueChange={([v]) => setC({ opacity: v })} />
              </div>
              {c.style === "premium" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Texte premium</Label>
                    <Textarea value={c.text ?? ""} onChange={(e) => setC({ text: e.target.value })} placeholder="Contenu réservé aux membres premium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Texte du bouton CTA</Label>
                    <Input value={c.ctaText ?? ""} onChange={(e) => setC({ ctaText: e.target.value })} placeholder="Débloquer avec l'offre premium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>URL du CTA (optionnel, mode URL externe)</Label>
                    <Input value={c.ctaUrl ?? ""} onChange={(e) => setC({ ctaUrl: e.target.value })} placeholder="https://…" />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Type de contenu</Label>
                <Select value={c.contentType ?? ""} onValueChange={(v) => setC({ contentType: v as ContentType })}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Titre</Label>
                <Input value={c.title ?? ""} onChange={(e) => setC({ title: e.target.value })} />
              </div>
              {(c.contentType === "image" || c.contentType === "video") && (
                <div className="space-y-1.5">
                  <Label>{c.contentType === "image" ? "Image" : "Vidéo"} depuis votre appareil</Label>
                  <Input type="file" accept={c.contentType === "image" ? "image/*" : "video/*"} onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
                  {uploading && <p className="text-xs text-muted-foreground">Téléversement…</p>}
                  {c.mediaUrl && <p className="truncate text-xs text-muted-foreground">Fichier prêt ✓</p>}
                </div>
              )}
              {c.contentType === "html" && (
                <div className="space-y-1.5">
                  <Label>Script HTML</Label>
                  <Textarea rows={8} className="font-mono text-xs" value={c.html ?? ""} onChange={(e) => setC({ html: e.target.value })} placeholder="<div>…</div>" />
                </div>
              )}
              {c.contentType === "text" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Texte</Label>
                    <Textarea rows={6} value={c.text ?? ""} onChange={(e) => setC({ text: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Police</Label>
                      <Select value={c.font ?? "inter"} onValueChange={(v) => setC({ font: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Design</Label>
                      <Select value={c.design ?? "card"} onValueChange={(v) => setC({ design: v as never })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DESIGN_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
              {c.contentType === "button_url" && (
                <div className="space-y-1.5">
                  <Label>URL de redirection</Label>
                  <Input value={c.url ?? ""} onChange={(e) => setC({ url: e.target.value })} placeholder="https://…" />
                </div>
              )}
              {c.contentType === "button_reveal" && (
                <div className="space-y-1.5">
                  <Label>Rectangle à faire apparaître</Label>
                  <Select value={c.targetRectId ?? ""} onValueChange={(v) => setC({ targetRectId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir un rectangle existant" /></SelectTrigger>
                    <SelectContent>
                      {targets.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          Page {pageNumberOf(r.page_id)} — {r.config.title || r.config.contentType || "sans titre"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Le rectangle choisi sera masqué et n'apparaîtra qu'au clic sur ce bouton, à sa taille d'origine.</p>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!c.revealOnly} onCheckedChange={(v) => setC({ revealOnly: !!v })} />
                Masqué (apparaît seulement via un bouton)
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draft.full_page} onCheckedChange={(v) => setDraft({ ...draft, full_page: !!v })} />
            Appliquer à la page toute entière
          </label>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="destructive" onClick={() => onDelete(draft.id)}>Supprimer</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => onSave(draft)}>Valider</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
