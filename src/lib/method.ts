import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PageType = "blank" | "frame" | "chapter" | "subchapter" | "full" | "custom";

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  blank: "Page vierge sans cadre",
  frame: "Page avec cadre uniquement",
  chapter: "Page avec chapitre et cadre",
  subchapter: "Page avec sous-chapitre et cadre",
  full: "Page avec partie, chapitre, sous-chapitre et cadre",
  custom: "Page personnalisée",
};

/** One card of a "Page personnalisée" carousel: free HTML rendered as a web page. */
export interface CustomCard {
  id: string;
  color: string;
  html: string;
}

export const CARD_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#e11d48", "#84cc16"];

export function newCard(index: number): CustomCard {
  return {
    id: crypto.randomUUID(),
    color: CARD_COLORS[index % CARD_COLORS.length]!,
    html: '<div style="padding:30px; text-align:center; font-family:sans-serif;"><h3>Nouvelle Carte</h3><p>Modifiez ce code dans la configuration</p></div>',
  };
}

export function defaultCards(): CustomCard[] {
  const names = ["Mexican Buddha Bowl", "Avocado & Green Salad", "Quinoa Power Bowl"];
  return names.map((name, i) => ({
    id: crypto.randomUUID(),
    color: CARD_COLORS[i]!,
    html: `<div style="padding:40px;text-align:center;font-family:sans-serif;"><h2>${name}</h2><p style="color:#666;margin-top:10px;">Rendu HTML personnalisé ${i + 1}</p></div>`,
  }));
}

export interface MethodPage {
  id: string;
  position: number;
  type: PageType;
  partie: string;
  chapitre: string;
  titre: string;
  sous_chapitre: string;
  body: string;
  image_url: string | null;
  image_size: number;
  cards: CustomCard[];
}

export type ContentType = "image" | "video" | "html" | "text" | "button_url" | "button_reveal";
export type MaskStyle = "blur" | "opaque" | "gradient" | "premium";
export type TextDesign = "plain" | "card" | "highlight" | "quote" | "dark";

export interface RectConfig {
  // content
  contentType?: ContentType;
  title?: string;
  mediaUrl?: string;
  html?: string;
  text?: string;
  font?: string;
  design?: TextDesign;
  url?: string;
  targetRectId?: string;
  revealOnly?: boolean;
  // mask
  style?: MaskStyle;
  blur?: number;
  opacity?: number;
  ctaText?: string;
  ctaUrl?: string;
}

export interface MethodRect {
  id: string;
  page_id: string;
  kind: "content" | "mask";
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  full_page: boolean;
  config: RectConfig;
}

export interface MethodData {
  pages: MethodPage[];
  rects: MethodRect[];
}

export const methodQuery = queryOptions({
  queryKey: ["method"],
  queryFn: async (): Promise<MethodData> => {
    const [pagesRes, rectsRes] = await Promise.all([
      supabase.from("method_pages").select("*").order("position"),
      supabase.from("method_rects").select("*").order("created_at"),
    ]);
    if (pagesRes.error) throw pagesRes.error;
    if (rectsRes.error) throw rectsRes.error;
    return {
      pages: (pagesRes.data ?? []).map((p) => ({
        ...p,
        type: p.type as PageType,
        cards: Array.isArray(p.cards) ? (p.cards as unknown as CustomCard[]) : [],
      })),
      rects: (rectsRes.data ?? []).map((r) => ({
        ...r,
        kind: r.kind as "content" | "mask",
        x_percent: Number(r.x_percent),
        y_percent: Number(r.y_percent),
        width_percent: Number(r.width_percent),
        height_percent: Number(r.height_percent),
        config: (r.config ?? {}) as RectConfig,
      })),
    };
  },
});

export function showsHeader(type: PageType) {
  return type !== "blank";
}

/** Persist the whole editor state: upsert everything, delete what was removed. */
export async function saveMethod(data: MethodData, removedPageIds: string[], removedRectIds: string[]) {
  if (removedRectIds.length) {
    const { error } = await supabase.from("method_rects").delete().in("id", removedRectIds);
    if (error) throw error;
  }
  if (removedPageIds.length) {
    const { error } = await supabase.from("method_pages").delete().in("id", removedPageIds);
    if (error) throw error;
  }
  if (data.pages.length) {
    const { error } = await supabase.from("method_pages").upsert(
      data.pages.map((p, i) => ({
        id: p.id,
        position: i + 1,
        type: p.type,
        partie: p.partie,
        chapitre: p.chapitre,
        titre: p.titre,
        sous_chapitre: p.sous_chapitre,
        body: p.body,
        image_url: p.image_url,
        image_size: p.image_size,
        cards: p.cards as unknown as Json,
        updated_at: new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }
  if (data.rects.length) {
    const { error } = await supabase.from("method_rects").upsert(
      data.rects.map((r) => ({
        id: r.id,
        page_id: r.page_id,
        kind: r.kind,
        x_percent: r.x_percent,
        y_percent: r.y_percent,
        width_percent: r.width_percent,
        height_percent: r.height_percent,
        full_page: r.full_page,
        config: r.config as unknown as Json,
      })),
    );
    if (error) throw error;
  }
}

export function newPage(type: PageType): MethodPage {
  return {
    id: crypto.randomUUID(),
    position: 0,
    type,
    partie: type === "full" ? "Partie :" : "",
    chapitre: type === "chapter" || type === "full" ? "Chapitre :" : "",
    titre: type === "chapter" || type === "full" ? "Titre du chapitre" : "",
    sous_chapitre: type === "subchapter" || type === "full" ? "1.1 SOUS-CHAPITRE" : "",
    body: type === "custom" ? "" : "<p>Votre texte…</p>",
    image_url: null,
    image_size: 100,
    cards: type === "custom" ? defaultCards() : [],
  };
}

/** Do two rectangles (in page percent) overlap? */
export function rectsOverlap(a: MethodRect, b: MethodRect) {
  const ax = a.full_page ? 0 : a.x_percent, ay = a.full_page ? 0 : a.y_percent;
  const aw = a.full_page ? 100 : a.width_percent, ah = a.full_page ? 100 : a.height_percent;
  const bx = b.full_page ? 0 : b.x_percent, by = b.full_page ? 0 : b.y_percent;
  const bw = b.full_page ? 100 : b.width_percent, bh = b.full_page ? 100 : b.height_percent;
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
