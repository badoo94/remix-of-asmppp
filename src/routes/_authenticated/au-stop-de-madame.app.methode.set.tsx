import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { toast } from "sonner";
import { ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import {
  methodQuery,
  newPage,
  PAGE_TYPE_LABELS,
  saveMethod,
  type MethodData,
  type MethodPage,
  type MethodRect,
  type PageType,
} from "@/lib/method";
import { appSettingsQuery, DEFAULT_APP_CONFIG } from "@/lib/settings";
import { useAccess } from "@/lib/auth";
import { uploadMedia } from "@/lib/upload";
import { A4Page } from "@/components/method/A4Page";
import { PAGE_H, PAGE_W, usePageScale } from "@/components/method/useScale";
import { RectBody } from "@/components/method/RectContent";
import { MaskContent, maskVisual } from "@/components/method/MaskView";
import { RectConfigDialog } from "@/components/method/RectDialogs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/au-stop-de-madame/app/methode/set")({
  head: () => ({
    meta: [
      { title: "Éditeur de la méthode — Au stop de madame" },
      { name: "description", content: "Éditez les pages, rectangles de contenu et zones premium de la méthode." },
      { property: "og:title", content: "Éditeur de la méthode" },
      { property: "og:description", content: "Éditez les pages, rectangles de contenu et zones premium de la méthode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MethodEditor,
});

const PAGE_TYPES = Object.keys(PAGE_TYPE_LABELS) as PageType[];

function MethodEditor() {
  const { isAdmin, ready } = useAccess();
  const { data } = useQuery(methodQuery);
  const { data: settings = DEFAULT_APP_CONFIG } = useQuery(appSettingsQuery);
  const qc = useQueryClient();
  const { ref, scale } = usePageScale(1.1);
  const [state, setState] = useState<MethodData | null>(null);
  const removed = useRef({ pages: [] as string[], rects: [] as string[] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MethodRect | null>(null);

  useEffect(() => {
    if (data && !state) setState(structuredClone(data));
  }, [data, state]);

  useBlocker({ shouldBlockFn: () => dirty && !window.confirm("Des modifications ne sont pas enregistrées. Quitter ?"), enableBeforeUnload: dirty });

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

  const update = (fn: (s: MethodData) => MethodData) => {
    setState((s) => (s ? fn(s) : s));
    setDirty(true);
  };

  const pageNumberOf = (id: string) => (state?.pages.findIndex((p) => p.id === id) ?? -1) + 1;

  function addPage(index: number, type: PageType) {
    update((s) => {
      const pages = [...s.pages];
      pages.splice(index, 0, newPage(type));
      return { ...s, pages };
    });
  }

  function deletePage(id: string) {
    if (!window.confirm("Supprimer cette page et ses rectangles ?")) return;
    removed.current.pages.push(id);
    update((s) => {
      const rects = s.rects.filter((r) => r.page_id !== id);
      s.rects.filter((r) => r.page_id === id).forEach((r) => removed.current.rects.push(r.id));
      return { pages: s.pages.filter((p) => p.id !== id), rects };
    });
  }

  function addRect(pageId: string, kind: "content" | "mask") {
    const r: MethodRect = {
      id: crypto.randomUUID(),
      page_id: pageId,
      kind,
      x_percent: 15,
      y_percent: kind === "mask" ? 45 : 30,
      width_percent: 70,
      height_percent: kind === "mask" ? 30 : 20,
      full_page: false,
      config: kind === "mask" ? { style: "premium", blur: 12, opacity: 60 } : {},
    };
    update((s) => ({ ...s, rects: [...s.rects, r] }));
    toast.message(kind === "mask" ? "Zone premium ajoutée — double-cliquez pour la régler" : "Rectangle ajouté — double-cliquez pour le configurer");
  }

  function setPage(id: string, patch: Partial<MethodPage>) {
    update((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }

  function setRect(id: string, patch: Partial<MethodRect>) {
    update((s) => ({ ...s, rects: s.rects.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }

  function saveRectConfig(r: MethodRect) {
    update((s) => {
      let rects = s.rects.map((x) => (x.id === r.id ? r : x));
      if (r.config.contentType === "button_reveal" && r.config.targetRectId) {
        rects = rects.map((x) => (x.id === r.config.targetRectId ? { ...x, config: { ...x.config, revealOnly: true } } : x));
      }
      return { ...s, rects };
    });
    setEditing(null);
  }

  function deleteRect(id: string) {
    removed.current.rects.push(id);
    update((s) => ({ ...s, rects: s.rects.filter((r) => r.id !== id) }));
    setEditing(null);
  }

  async function uploadPageImage(pageId: string, file: File | undefined) {
    if (!file) return;
    const t = toast.loading("Téléversement de l'image…");
    try {
      const url = await uploadMedia(file);
      setPage(pageId, { image_url: url, image_size: 100 });
      toast.success("Image ajoutée à la page", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec", { id: t });
    }
  }

  async function saveAll() {
    if (!state) return;
    setSaving(true);
    try {
      await saveMethod(state, removed.current.pages, removed.current.rects);
      removed.current = { pages: [], rects: [] };
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["method"] });
      toast.success("Toutes les modifications sont enregistrées");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  const InsertMenu = ({ index, pageId }: { index: number; pageId?: string | undefined }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ajouter"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-ink text-page shadow-lg ring-2 ring-page/40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel>Nouvelle page ici</DropdownMenuLabel>
        {PAGE_TYPES.map((t) => (
          <DropdownMenuItem key={t} onClick={() => addPage(index, t)}>{PAGE_TYPE_LABELS[t]}</DropdownMenuItem>
        ))}
        {pageId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Rectangle sur cette page</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => addRect(pageId, "content")}>Rectangle de contenu</DropdownMenuItem>
            <DropdownMenuItem onClick={() => addRect(pageId, "mask")}>Ajouter une zone premium (floutage)</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-reader">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-page-ink/10 bg-page px-4 py-3 text-page-ink">
        <Link to="/au-stop-de-madame/edit" className="text-sm font-medium underline underline-offset-4">← Retour</Link>
        <span className="text-sm opacity-70">{state?.pages.length ?? 0} pages</span>
        <Button variant="page" onClick={saveAll} disabled={saving || !dirty}>
          <Save /> {saving ? "Enregistrement…" : "Enregistrer tout"}
        </Button>
      </header>

      <div ref={ref} className="flex flex-col items-center pb-24 pt-4">
        {!state && <p className="py-20 text-sm text-page/70">Chargement…</p>}
        {state && state.pages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-page">
            <p className="text-sm opacity-80">Aucune page. Ajoutez la première :</p>
            <InsertMenu index={0} />
          </div>
        )}
        {state?.pages.map((page, i) => {
          const n = i + 1;
          const pageRects = state.rects.filter((r) => r.page_id === page.id);
          return (
            <div key={page.id} className="relative flex w-full flex-col items-center">
              <div className="relative z-30 flex h-6 w-full items-center justify-center bg-brand-ink">
                <div className="absolute flex flex-col items-center gap-0.5" style={{ top: i > 0 ? -16 : -2 }}>
                  {i > 0 && <InsertMenu index={i} pageId={state.pages[i - 1]?.id} />}
                  <InsertMenu index={i} pageId={page.id} />
                </div>
              </div>
              <div className="relative">
                <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5">
                  <label className="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-page-ink px-2.5 text-xs text-page shadow" title="Téléverser une image pleine page">
                    <ImagePlus className="h-3.5 w-3.5" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPageImage(page.id, e.target.files?.[0])} />
                  </label>
                  <button
                    type="button"
                    onClick={() => deletePage(page.id)}
                    aria-label="Supprimer la page"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {page.image_url && (
                  <div className="absolute left-2 top-2 z-30 flex w-52 items-center gap-2 rounded-full bg-page-ink px-3 py-1.5 text-page shadow">
                    <span className="text-[10px]">Taille</span>
                    <Slider min={20} max={100} step={1} value={[page.image_size]} onValueChange={([v]) => setPage(page.id, { image_size: v ?? 100 })} />
                    <button type="button" aria-label="Retirer l'image" onClick={() => setPage(page.id, { image_url: null })}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <A4Page
                  page={page}
                  pageNumber={n}
                  scale={scale}
                  fontSize={settings.fontSize}
                  footerText={settings.footerText}
                  editable
                  onFieldChange={(f, v) => setPage(page.id, { [f]: v } as Partial<MethodPage>)}
                  overlay={pageRects.map((r) => {
                    const box = r.full_page
                      ? { x: 0, y: 0, width: PAGE_W, height: PAGE_H }
                      : {
                          x: (r.x_percent / 100) * PAGE_W,
                          y: (r.y_percent / 100) * PAGE_H,
                          width: (r.width_percent / 100) * PAGE_W,
                          height: (r.height_percent / 100) * PAGE_H,
                        };
                    return (
                      <Rnd
                        key={r.id}
                        scale={scale}
                        bounds="parent"
                        size={{ width: box.width, height: box.height }}
                        position={{ x: box.x, y: box.y }}
                        disableDragging={r.full_page}
                        enableResizing={!r.full_page}
                        style={{ zIndex: r.kind === "mask" ? 25 : 15 }}
                        onDragStop={(_e, d) =>
                          setRect(r.id, { x_percent: (d.x / PAGE_W) * 100, y_percent: (d.y / PAGE_H) * 100 })
                        }
                        onResizeStop={(_e, _dir, el: HTMLElement, _delta, pos: { x: number; y: number }) =>
                          setRect(r.id, {
                            width_percent: (el.offsetWidth / PAGE_W) * 100,
                            height_percent: (el.offsetHeight / PAGE_H) * 100,
                            x_percent: (pos.x / PAGE_W) * 100,
                            y_percent: (pos.y / PAGE_H) * 100,
                          })
                        }
                      >
                        <div
                          onDoubleClick={() => setEditing(r)}
                          className={
                            r.kind === "mask"
                              ? "relative h-full w-full border-2 border-dashed border-brand-alert"
                              : "relative h-full w-full border-2 border-dashed border-page-badge bg-page/40"
                          }
                          style={r.kind === "mask" ? maskVisual(r) : { opacity: r.config.revealOnly ? 0.6 : 1 }}
                        >
                          <span className="absolute -top-5 left-0 rounded bg-page-ink px-1.5 py-0.5 text-[10px] text-page">
                            {r.kind === "mask" ? "Zone premium" : r.config.revealOnly ? "Révélé par bouton" : "Contenu"} · double-clic
                          </span>
                          <div className="pointer-events-none h-full w-full">
                            {r.kind === "mask" ? <MaskContent rect={r} /> : <RectBody rect={r} interactive={false} />}
                          </div>
                        </div>
                      </Rnd>
                    );
                  })}
                />
              </div>
              {i === state.pages.length - 1 && (
                <div className="relative z-30 flex h-6 w-full items-center justify-center bg-brand-ink">
                  <div className="absolute -top-2"><InsertMenu index={i + 1} pageId={page.id} /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <RectConfigDialog
        rect={editing}
        allRects={state?.rects ?? []}
        pageNumberOf={pageNumberOf}
        onClose={() => setEditing(null)}
        onSave={saveRectConfig}
        onDelete={deleteRect}
      />
    </div>
  );
}
