import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CARD_COLORS, newCard, type CustomCard } from "@/lib/method";
import { cn } from "@/lib/utils";

/** The "Page personnalisée" web carousel: one card per HTML snippet, rendered in an iframe. */
export function CustomCarousel({ cards, interactive = true }: { cards: CustomCard[]; interactive?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = wrap.current;
    const first = el?.querySelector<HTMLElement>(".cp-card");
    if (!el || !first) return;
    setActive(Math.round(el.scrollLeft / (first.offsetWidth + 16)));
  };

  const goTo = (i: number) => {
    const card = wrap.current?.querySelectorAll<HTMLElement>(".cp-card")[i];
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className="cp-root">
      <div ref={wrap} className="cp-carousel" onScroll={onScroll}>
        <div className="cp-track">
          {cards.map((card, i) => (
            <div key={card.id} className="cp-card" style={{ ["--cp-color" as string]: card.color || CARD_COLORS[i % CARD_COLORS.length] }}>
              <span className="cp-beam" />
              <iframe
                title={`Carte ${i + 1}`}
                className={cn("cp-frame", !interactive && "pointer-events-none")}
                srcDoc={card.html}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            </div>
          ))}
        </div>
      </div>
      {cards.length > 1 && (
        <div className="cp-dots">
          {cards.map((c, i) => (
            <button key={c.id} type="button" aria-label={`Carte ${i + 1}`} className={cn("cp-dot", i === active && "is-active")} onClick={() => goTo(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Full-screen view of a custom page, like a regular web page. */
export function CustomPageFullscreen({ cards, onClose }: { cards: CustomCard[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    el?.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onFs = () => !document.fullscreenElement && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prev;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  return createPortal(
    <div ref={box} className="fixed inset-0 z-[90]">
      <CustomCarousel cards={cards} />
      <button
        type="button"
        aria-label="Réduire"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-page-ink text-page shadow-lg"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}

/** Configuration popup of a custom page (same panel as the original "/set" view). */
export function CustomPageDialog({
  cards,
  open,
  saving,
  onApply,
  onPublish,
  onClose,
}: {
  cards: CustomCard[];
  open: boolean;
  saving: boolean;
  onApply: (cards: CustomCard[]) => void;
  onPublish: (cards: CustomCard[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CustomCard[]>(cards);

  useEffect(() => {
    if (open) setDraft(cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const close = () => {
    onApply(draft);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-page-ink/50 p-3 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-label="Configuration dynamique des Cartes"
        className="cp-set relative max-h-[92vh] w-full max-w-[800px] overflow-y-auto rounded-2xl px-5 py-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Fermer" onClick={close} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-page-ink text-page">
          <X className="h-4 w-4" />
        </button>
        <h2 className="pr-10">Configuration dynamique des Cartes</h2>
        <p className="cp-intro">
          Ajoutez de nouvelles cartes avec le bouton <b>+</b> et renseignez leur code HTML pour le rendu Web. Vos modifications seront
          synchronisées sur tous les appareils.
        </p>

        <div className="mb-7 flex flex-wrap gap-3">
          <button type="button" className="cp-btn-add" onClick={() => setDraft((d) => [...d, newCard(d.length)])}>
            + Ajouter une carte
          </button>
          <button type="button" className="cp-btn-save" disabled={saving} onClick={() => onPublish(draft)}>
            {saving ? "Publication..." : "Enregistrer & Publier globalement"}
          </button>
        </div>

        {draft.length === 0 && <p className="cp-intro">Aucune carte. Ajoutez-en une avec le bouton ci-dessus.</p>}
        {draft.map((card, i) => (
          <div key={card.id} className="cp-group">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor={`card-${card.id}`}>Carte {i + 1} (Code HTML / Rendu Web)</label>
              <button type="button" className="cp-btn-del shrink-0" onClick={() => setDraft((d) => d.filter((c) => c.id !== card.id))}>
                Supprimer cette carte
              </button>
            </div>
            <textarea
              id={`card-${card.id}`}
              value={card.html}
              placeholder="Ex: <div style='padding:20px;'><h1>Mon Titre</h1></div>"
              onChange={(e) => {
                const html = e.target.value;
                setDraft((d) => d.map((c) => (c.id === card.id ? { ...c, html } : c)));
              }}
            />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
