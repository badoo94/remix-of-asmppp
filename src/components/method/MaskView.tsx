import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import type { MethodRect } from "@/lib/method";

/** Visual of a premium mask (blur layer). Sits in an absolute layer above the page. */
export function maskVisual(rect: MethodRect): CSSProperties {
  const c = rect.config;
  const blur = c.blur ?? 12;
  const opacity = (c.opacity ?? 60) / 100;
  const tint = `color-mix(in oklch, var(--page-bg) ${Math.round(opacity * 100)}%, transparent)`;
  switch (c.style) {
    case "opaque":
      return { background: `color-mix(in oklch, var(--page-bg) ${Math.max(85, Math.round(opacity * 100))}%, transparent)` };
    case "gradient":
      return {
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        background: `linear-gradient(180deg, transparent 0%, ${tint} 35%, var(--page-bg) 100%)`,
      };
    case "premium":
    case "blur":
    default:
      return { backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, background: tint };
  }
}

export function MaskContent({ rect, onCta }: { rect: MethodRect; onCta?: () => void }) {
  const c = rect.config;
  if (c.style !== "premium") return null;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center text-page-ink">
      <Lock className="h-8 w-8" />
      <p className="max-w-md font-display text-lg font-bold leading-tight">{c.text || "Contenu réservé aux membres premium"}</p>
      <button
        type="button"
        onClick={onCta}
        className="rounded-xl bg-cta px-5 py-3 text-sm font-bold text-brand-ink shadow-glow transition active:scale-95"
      >
        {c.ctaText || "Débloquer avec l'offre premium"}
      </button>
    </div>
  );
}
