import type { ReactNode } from "react";
import type { MethodPage } from "@/lib/method";
import { FitBody } from "./FitBody";
import { Editable } from "./Editable";
import { CustomCarousel } from "./CustomPage";
import { PAGE_H, PAGE_W } from "./useScale";
import { cn } from "@/lib/utils";

type Field = "partie" | "chapitre" | "titre" | "sous_chapitre" | "body";

interface Props {
  page: MethodPage;
  pageNumber: number;
  scale: number;
  fontSize: number;
  footerText: string;
  editable?: boolean;
  reading?: boolean;
  onFieldChange?: (field: Field, value: string) => void;
  overlay?: ReactNode;
  pageRef?: (el: HTMLDivElement | null) => void;
  /** Extra controls drawn on top of a custom page (e.g. fullscreen button). */
  controls?: ReactNode;
}

/**
 * The "Méthode" A4 design template. Any text content is rendered through this layout.
 * Section titles sit above the frame; continuation pages leave the header empty.
 */
export function A4Page({ page, pageNumber, scale, fontSize, footerText, editable, reading, onFieldChange, overlay, pageRef, controls }: Props) {
  if (page.type === "custom") {
    // Web page: rendered at real device size (not scaled) so its HTML stays readable; overlays keep page percentages.
    return (
      <div ref={pageRef} data-page={pageNumber} className="mp-page-shell" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
        <CustomCarousel cards={page.cards} interactive={!editable} />
        {controls}
        <div
          className="pointer-events-none absolute left-0 top-0 z-20 origin-top-left [&>*]:pointer-events-auto"
          style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
        >
          {overlay}
        </div>
      </div>
    );
  }

  const showPartie = page.type === "full" && (editable || page.partie);
  const showChapitre = (page.type === "chapter" || page.type === "full") && (editable || page.chapitre || page.titre);
  const showSous = (page.type === "subchapter" || page.type === "full") && (editable || page.sous_chapitre);
  const set = (f: Field) => (v: string) => onFieldChange?.(f, v);

  const text = (field: Field, value: string, className: string, placeholder: string) =>
    editable ? (
      <Editable html={value} onChange={set(field)} className={className} placeholder={placeholder} />
    ) : value ? (
      <div className={className} dangerouslySetInnerHTML={{ __html: value }} />
    ) : null;

  return (
    <div className="mp-page-shell" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
      <div
        ref={pageRef}
        data-page={pageNumber}
        className={cn("mp-page", reading && "is-reading")}
        style={{ transform: `scale(${scale})` }}
      >
        <div className="mp-zone">
          {page.type === "blank" ? (
            <FitBody fontSize={fontSize} className="mp-blank" deps={[page.body]}>
              {editable ? (
                <Editable html={page.body} onChange={set("body")} className="w-full" placeholder="Texte de la page" />
              ) : (
                <div className="w-full" data-tts dangerouslySetInnerHTML={{ __html: page.body }} />
              )}
            </FitBody>
          ) : (
            <>
              <div className="header-outside" data-tts-header>
                {showPartie && text("partie", page.partie, "mp-partie", "Partie")}
                {showChapitre && (
                  <>
                    {editable ? (
                      <Editable html={page.chapitre} onChange={set("chapitre")} className="mp-badge" placeholder="Chapitre :" />
                    ) : (
                      page.chapitre && <div className="mp-badge" dangerouslySetInnerHTML={{ __html: page.chapitre }} />
                    )}
                    {text("titre", page.titre, "mp-titre", "Titre du chapitre")}
                  </>
                )}
                {showSous && text("sous_chapitre", page.sous_chapitre, "mp-sous", "1.1 Sous-chapitre")}
              </div>
              <FitBody fontSize={fontSize} className="cadre" deps={[page.body, page.type]}>
                {editable ? (
                  <Editable html={page.body} onChange={set("body")} className="min-h-full" placeholder="Texte du cadre" />
                ) : (
                  <div data-tts dangerouslySetInnerHTML={{ __html: page.body }} />
                )}
              </FitBody>
            </>
          )}
        </div>
        <div className="mp-footer">
          <span>{footerText}</span>
          <span>page {pageNumber}</span>
        </div>

        {page.image_url && (
          <div className="mp-full-image">
            <img
              src={page.image_url}
              alt=""
              style={{ width: `${page.image_size}%`, height: `${page.image_size}%` }}
            />
          </div>
        )}
        {overlay}
      </div>
    </div>
  );
}
