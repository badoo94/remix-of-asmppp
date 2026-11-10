import { useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import type { MethodRect, TextDesign } from "@/lib/method";
import { cn } from "@/lib/utils";

export const FONT_OPTIONS: { value: string; label: string; css: string }[] = [
  { value: "inter", label: "Inter", css: '"Inter", sans-serif' },
  { value: "spartan", label: "League Spartan", css: '"League Spartan", sans-serif' },
  { value: "serif", label: "Serif (Georgia)", css: "Georgia, 'Times New Roman', serif" },
  { value: "mono", label: "Monospace", css: "ui-monospace, Menlo, monospace" },
];

export const DESIGN_OPTIONS: { value: TextDesign; label: string }[] = [
  { value: "plain", label: "Simple" },
  { value: "card", label: "Carte claire" },
  { value: "highlight", label: "Surligné" },
  { value: "quote", label: "Citation" },
  { value: "dark", label: "Bloc sombre" },
];

const designClass: Record<TextDesign, string> = {
  plain: "bg-transparent text-page-ink",
  card: "bg-page-badge-ink/90 text-page-ink rounded-xl shadow-lg border border-page-ink/10",
  highlight: "bg-brand-gold/35 text-page-ink rounded-md",
  quote: "border-l-4 border-page-badge bg-page-badge-ink/50 text-page-ink italic",
  dark: "bg-page-ink text-page rounded-xl",
};

/** Body of a content rectangle (shared by reader, editor and fullscreen view). */
export function RectBody({ rect, onButton, interactive = true }: { rect: MethodRect; onButton?: ((e: MouseEvent) => void) | undefined; interactive?: boolean }) {
  const c = rect.config;
  const font = FONT_OPTIONS.find((f) => f.value === c.font)?.css;
  const title = c.title ? <div className="mb-1 shrink-0 font-display text-sm font-bold leading-tight">{c.title}</div> : null;

  switch (c.contentType) {
    case "image":
      return (
        <div className="flex h-full w-full flex-col">
          {title}
          {c.mediaUrl ? (
            <img src={c.mediaUrl} alt={c.title ?? ""} className="min-h-0 w-full flex-1 object-contain" />
          ) : (
            <Empty label="Image" />
          )}
        </div>
      );
    case "video":
      return (
        <div className="flex h-full w-full flex-col">
          {title}
          {c.mediaUrl ? (
            <video src={c.mediaUrl} controls playsInline className="min-h-0 w-full flex-1 bg-page-ink object-contain" />
          ) : (
            <Empty label="Vidéo" />
          )}
        </div>
      );
    case "html":
      return (
        <div className="flex h-full w-full flex-col">
          {title}
          {c.html ? (
            <iframe
              title={c.title || "Contenu"}
              srcDoc={c.html}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              className={cn("min-h-0 w-full flex-1 border-0 bg-page-badge-ink", !interactive && "pointer-events-none")}
              scrolling="yes"
            />
          ) : (
            <Empty label="Script HTML" />
          )}
        </div>
      );
    case "text":
      return (
        <div
          className={cn("h-full w-full overflow-auto p-3", designClass[c.design ?? "card"])}
          style={{ fontFamily: font }}
        >
          {title}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{c.text}</div>
        </div>
      );
    case "button_url":
    case "button_reveal":
      return (
        <div className="flex h-full w-full items-center justify-center">
          <button
            type="button"
            onClick={onButton}
            className="h-full max-h-20 w-full rounded-xl bg-cta px-3 font-display text-base font-bold text-brand-ink shadow-glow transition active:scale-95"
          >
            {c.title || "Bouton"}
          </button>
        </div>
      );
    default:
      return <Empty label="Double-cliquez pour configurer" />;
  }
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center rounded-md border border-dashed border-page-ink/40 text-center text-xs text-page-ink/60">
      {label}
    </div>
  );
}

/** Reader-side content rectangle with fullscreen toggle. */
export function RectContent({
  rect,
  canExpand,
  onButton,
  style,
}: {
  rect: MethodRect;
  canExpand: boolean;
  onButton?: (e: MouseEvent) => void;
  style?: React.CSSProperties;
}) {
  const [full, setFull] = useState(false);
  const isButton = rect.config.contentType === "button_url" || rect.config.contentType === "button_reveal";
  return (
    <>
      <div className="absolute z-10 overflow-hidden" style={style}>
        <RectBody rect={rect} onButton={onButton} />
        {canExpand && !isButton && (
          <button
            type="button"
            aria-label="Agrandir"
            onClick={() => setFull(true)}
            className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-page-ink/75 text-page shadow"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {full &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex flex-col bg-page p-3 text-page-ink">
            <button
              type="button"
              aria-label="Réduire"
              onClick={() => setFull(false)}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-page-ink text-page shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="min-h-0 flex-1 pt-12">
              <RectBody rect={rect} onButton={onButton} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function rectStyle(r: MethodRect): React.CSSProperties {
  return r.full_page
    ? { left: 0, top: 0, width: "100%", height: "100%" }
    : { left: `${r.x_percent}%`, top: `${r.y_percent}%`, width: `${r.width_percent}%`, height: `${r.height_percent}%` };
}
