import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import type { ContentType, MaskStyle, MethodRect, RectConfig, TextDesign } from "@/lib/method";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { DESIGN_OPTIONS, FONT_OPTIONS } from "./RectContent";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "video", label: "Vidéo" },
  { value: "html", label: "Script HTML" },
  { value: "text", label: "Texte" },
  { value: "button_url", label: "Bouton URL (lien externe)" },
  { value: "button_reveal", label: "Bouton (révèle un autre rectangle)" },
];

const MASK_STYLES: { value: MaskStyle; label: string }[] = [
  { value: "blur", label: "Flou" },
  { value: "opaque", label: "Opaque" },
  { value: "gradient", label: "Dégradé" },
  { value: "premium", label: "Premium + CTA" },
];

interface Props {
  rect: MethodRect | null;
  allRects: MethodRect[];
  pageNumberOf: (pageId: string) => number;
  /** Applied live: the rectangle on the page updates while the admin edits. */
  onChange: (r: MethodRect) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const selectClass =
  "h-12 w-full appearance-none rounded-xl border border-input bg-secondary bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat px-4 pr-10 text-base text-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/40";
const chevron = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
};

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-normal text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** One modal for both rectangle kinds: "Zone de contenu" and "Zone de floutage". */
export function RectConfigDialog({ rect, allRects, pageNumberOf, onChange, onClose, onDelete }: Props) {
  const [uploading, setUploading] = useState(false);
  if (!rect) return null;
  const c = rect.config;
  const setC = (patch: Partial<RectConfig>) => onChange({ ...rect, config: { ...rect.config, ...patch } });
  const isMask = rect.kind === "mask";

  async function upload(file: File | undefined) {
    if (!file || !rect) return;
    setUploading(true);
    const t = toast.loading("Téléversement…");
    try {
      const url = await uploadMedia(file);
      onChange({ ...rect, config: { ...rect.config, mediaUrl: url } });
      toast.success("Fichier ajouté au rectangle", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléversement", { id: t });
    } finally {
      setUploading(false);
    }
  }

  const targets = allRects.filter((r) => r.kind === "content" && r.id !== rect.id && r.config.contentType !== "button_reveal");
  const transparency = 100 - (c.opacity ?? 60);
  const blur = c.blur ?? 12;
  const isButton = c.contentType === "button_url" || c.contentType === "button_reveal";

  const fullPage = (
    <label className="flex items-center gap-3 text-base">
      <Checkbox
        checked={rect.full_page}
        onCheckedChange={(v) => onChange({ ...rect, full_page: !!v })}
        className="h-6 w-6 rounded-md border-brand-gold data-[state=checked]:bg-brand-gold data-[state=checked]:text-brand-ink"
      />
      <span className="text-muted-foreground">Appliquer à toute la page</span>
    </label>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl p-6 sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-bold">
            {isMask ? "Réglages — Zone de floutage" : "Réglages — Zone de contenu"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isMask ? "Réglez la transparence, le flou et le style de la zone premium." : "Choisissez le contenu affiché dans le rectangle."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {fullPage}

          {isMask ? (
            <>
              <Field label={`Transparence (${transparency}%)`}>
                <Slider min={0} max={100} step={1} value={[transparency]} onValueChange={([v]) => setC({ opacity: 100 - (v ?? 40) })} />
              </Field>
              <Field label={`Flou (${blur}px)`}>
                <Slider min={0} max={40} step={1} value={[blur]} onValueChange={([v]) => setC({ blur: v ?? 12 })} />
              </Field>
              <Field label="Style">
                <div className="grid grid-cols-2 gap-3">
                  {MASK_STYLES.map((s) => {
                    const active = (c.style ?? "blur") === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setC({ style: s.value })}
                        className={cn(
                          "h-12 rounded-xl border text-sm font-semibold transition",
                          active ? "border-brand-gold bg-brand-gold/10 text-brand-gold" : "border-input bg-transparent text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {c.style === "premium" && (
                <>
                  <Field label="Texte premium">
                    <Textarea
                      rows={3}
                      value={c.text ?? ""}
                      onChange={(e) => setC({ text: e.target.value })}
                      placeholder="Contenu réservé aux membres premium"
                      className="rounded-xl bg-secondary text-base"
                    />
                  </Field>
                  <Field label="Texte du bouton CTA" hint="Le bouton utilise le mode de paiement choisi dans les paramètres.">
                    <Input
                      value={c.ctaText ?? ""}
                      onChange={(e) => setC({ ctaText: e.target.value })}
                      placeholder="Débloquer maintenant"
                      className="h-12 rounded-xl bg-secondary text-base"
                    />
                  </Field>
                </>
              )}
            </>
          ) : (
            <>
              <Field label="Type de contenu">
                <select
                  className={cn(selectClass, "border-2 border-brand-gold")}
                  style={chevron}
                  value={c.contentType ?? ""}
                  onChange={(e) => setC({ contentType: e.target.value as ContentType })}
                >
                  <option value="">— Choisir —</option>
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              {c.contentType && (
                <Field label={isButton ? "Libellé du bouton" : "Titre"}>
                  <Input
                    value={c.title ?? ""}
                    onChange={(e) => setC({ title: e.target.value })}
                    placeholder={c.contentType === "button_url" ? "Découvrir" : c.contentType === "button_reveal" ? "Voir le contenu" : "Titre affiché"}
                    className="h-12 rounded-xl bg-secondary text-base"
                  />
                </Field>
              )}

              {(c.contentType === "image" || c.contentType === "video") && (
                <Field label={c.contentType === "image" ? "Fichier image" : "Fichier vidéo"}>
                  <label
                    className={cn(
                      "flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-gold font-display text-base font-bold text-brand-ink transition active:scale-[0.98]",
                      uploading && "pointer-events-none opacity-60",
                    )}
                  >
                    <Upload className="h-5 w-5" />
                    {uploading ? "Téléversement…" : c.mediaUrl ? "Remplacer le fichier" : "Choisir un fichier"}
                    <input
                      type="file"
                      className="hidden"
                      accept={c.contentType === "image" ? "image/*" : "video/*"}
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {c.mediaUrl && c.contentType === "image" && <img src={c.mediaUrl} alt="" className="mt-2 max-h-32 rounded-lg object-contain" />}
                  {c.mediaUrl && c.contentType === "video" && <video src={c.mediaUrl} className="mt-2 max-h-32 rounded-lg" muted playsInline />}
                </Field>
              )}

              {c.contentType === "html" && (
                <Field label="Code HTML">
                  <Textarea
                    rows={8}
                    value={c.html ?? ""}
                    onChange={(e) => setC({ html: e.target.value })}
                    placeholder="<div>Votre code HTML…</div>"
                    className="rounded-xl bg-secondary font-mono text-sm"
                  />
                </Field>
              )}

              {c.contentType === "text" && (
                <>
                  <Field label="Texte à afficher">
                    <Textarea
                      rows={6}
                      value={c.text ?? ""}
                      onChange={(e) => setC({ text: e.target.value })}
                      placeholder="Votre texte…"
                      className="rounded-xl bg-secondary text-base"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Police">
                      <select className={selectClass} style={chevron} value={c.font ?? "inter"} onChange={(e) => setC({ font: e.target.value })}>
                        {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Design">
                      <select
                        className={selectClass}
                        style={chevron}
                        value={c.design ?? "card"}
                        onChange={(e) => setC({ design: e.target.value as TextDesign })}
                      >
                        {DESIGN_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </>
              )}

              {c.contentType === "button_url" && (
                <Field label="URL de redirection">
                  <Input
                    type="url"
                    inputMode="url"
                    value={c.url ?? ""}
                    onChange={(e) => setC({ url: e.target.value })}
                    placeholder="https://…"
                    className="h-12 rounded-xl bg-secondary text-base"
                  />
                </Field>
              )}

              {c.contentType === "button_reveal" && (
                <Field label="Rectangle de contenu à révéler" hint="Au clic dans la page Méthode, ce rectangle remplacera le bouton.">
                  <select
                    className={selectClass}
                    style={chevron}
                    value={c.targetRectId ?? ""}
                    onChange={(e) => setC({ targetRectId: e.target.value })}
                  >
                    <option value="">— Choisir —</option>
                    {targets.map((r) => (
                      <option key={r.id} value={r.id}>
                        Page {pageNumberOf(r.page_id)} — {r.config.title || CONTENT_TYPES.find((t) => t.value === r.config.contentType)?.label || "sans titre"}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <Button variant="destructive" className="h-11 rounded-xl px-6 text-base font-bold" onClick={() => onDelete(rect.id)}>
            Supprimer
          </Button>
          <Button className="h-11 rounded-xl bg-brand-gold px-8 text-base font-bold text-brand-ink hover:bg-brand-gold/90" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
