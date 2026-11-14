import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Film, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CARD_COLORS, newCard, newMediaCard, newTextLine, type CustomCard } from "@/lib/method";
import { useDismissedCards } from "@/lib/dismissed-cards";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** A "carte personnalisée": video/GIF background, texts that follow each other, and a button that swipes the card away. */
function MediaCard({ card, interactive, onButton }: { card: CustomCard; interactive: boolean; onButton: () => void }) {
  const texts = (card.texts ?? []).filter((t) => t.text.trim());
  const [i, setI] = useState(0);
  const current = texts.length ? texts[i % texts.length] : undefined;

  useEffect(() => {
    if (texts.length < 2) return;
    const ms = Math.max(0.5, Number(current?.seconds) || 4) * 1000;
    const t = setTimeout(() => setI((n) => (n + 1) % texts.length), ms);
    return () => clearTimeout(t);
  }, [i, texts.length, current?.seconds]);

  return (
    <div className={cn("cp-media", !interactive && "pointer-events-none")}>
      {card.mediaUrl ? (
        card.mediaType === "video" ? (
          <video className="cp-media-bg" src={card.mediaUrl} autoPlay muted loop playsInline />
        ) : (
          <img className="cp-media-bg" src={card.mediaUrl} alt="" />
        )
      ) : (
        <div className="cp-media-bg cp-media-empty">
          <Film className="h-10 w-10" />
        </div>
      )}
      <div className="cp-media-shade" />
      <div className="cp-media-body">
        {current && (
          <p key={`${current.id}-${i}`} className="cp-media-text">
            {current.text}
          </p>
        )}
        <button type="button" className="cp-media-btn" onClick={onButton}>
          {card.buttonText?.trim() || "Continuer"}
        </button>
      </div>
    </div>
  );
}

/** The "Page personnalisée" web carousel: one card per HTML snippet (iframe) or media card. */
export function CustomCarousel({ cards, interactive = true }: { cards: CustomCard[]; interactive?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState<string | null>(null);
  const { dismissed, dismiss } = useDismissedCards();
  // In the editor every card stays visible; readers no longer see the cards they closed.
  const visible = interactive ? cards.filter((c) => !dismissed.has(c.id)) : cards;

  const onScroll = () => {
    const el = wrap.current;
    const first = el?.querySelector<HTMLElement>(".cp-card");
    if (!el || !first) return;
    setActive(Math.round(el.scrollLeft / (first.offsetWidth + 16)));
  };

  useEffect(onScroll, [visible.length]);

  const goTo = (i: number) => {
    const card = wrap.current?.querySelectorAll<HTMLElement>(".cp-card")[i];
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className="cp-root">
      <div ref={wrap} className="cp-carousel" onScroll={onScroll}>
        <div className="cp-track">
          {visible.map((card, i) => (
            <div
              key={card.id}
              className={cn("cp-card", leaving === card.id && "is-leaving")}
              style={{ ["--cp-color" as string]: card.color || CARD_COLORS[i % CARD_COLORS.length] }}
              onAnimationEnd={(e) => {
                if (e.target !== e.currentTarget || leaving !== card.id) return;
                setLeaving(null);
                dismiss(card.id);
              }}
            >
              <span className="cp-beam" />
              {card.kind === "media" ? (
                <MediaCard card={card} interactive={interactive} onButton={() => !leaving && setLeaving(card.id)} />
              ) : (
                <iframe
                  title={`Carte ${i + 1}`}
                  className={cn("cp-frame", !interactive && "pointer-events-none")}
                  srcDoc={card.html}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              )}
            </div>
          ))}
          {visible.length === 0 && <p className="cp-done">Vous avez parcouru toutes les cartes de cette page.</p>}
        </div>
      </div>
      {visible.length > 1 && (
        <div className="cp-dots">
          {visible.map((c, i) => (
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

/** Settings of one media card: video/GIF upload, timed texts, button label. */
function MediaCardFields({ card, index, onChange, onDelete }: { card: CustomCard; index: number; onChange: (c: CustomCard) => void; onDelete: () => void }) {
  const [uploading, setUploading] = useState(false);
  const texts = card.texts ?? [];

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const t = toast.loading("Téléversement…");
    try {
      const url = await uploadMedia(file);
      onChange({ ...card, mediaUrl: url, mediaType: file.type.startsWith("video/") ? "video" : "image" });
      toast.success("Fichier ajouté à la carte", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléversement", { id: t });
    } finally {
      setUploading(false);
    }
  }

  const setText = (id: string, patch: Partial<{ text: string; seconds: number }>) =>
    onChange({ ...card, texts: texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  return (
    <div className="cp-group">
      <div className="mb-3 flex items-center justify-between gap-2">
        <label>Carte {index + 1} (Carte personnalisée)</label>
        <button type="button" className="cp-btn-del shrink-0" onClick={onDelete}>
          Supprimer cette carte
        </button>
      </div>

      <span className="cp-sub">Vidéo ou GIF</span>
      <div className="mb-4 flex items-center gap-3">
        {card.mediaUrl &&
          (card.mediaType === "video" ? (
            <video src={card.mediaUrl} muted playsInline className="h-16 w-12 rounded-md bg-black object-cover" />
          ) : (
            <img src={card.mediaUrl} alt="" className="h-16 w-12 rounded-md bg-black object-cover" />
          ))}
        <label className="cp-btn-file">
          {uploading ? "Téléversement…" : card.mediaUrl ? "Changer le fichier" : "Choisir un fichier"}
          <input type="file" accept="video/*,image/gif,image/*" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>

      <span className="cp-sub">Textes (chacun laisse place au suivant après sa durée)</span>
      <div className="mb-3 space-y-3">
        {texts.map((t, ti) => (
          <div key={t.id} className="cp-text-row">
            <textarea
              aria-label={`Texte ${ti + 1}`}
              value={t.text}
              placeholder={`Texte ${ti + 1}`}
              onChange={(e) => setText(t.id, { text: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <label className="cp-sec">
                Durée
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={t.seconds}
                  onChange={(e) => setText(t.id, { seconds: parseFloat(e.target.value) || 0 })}
                />
                s
              </label>
              <button
                type="button"
                aria-label={`Supprimer le texte ${ti + 1}`}
                className="ml-auto text-[#e74c3c]"
                onClick={() => onChange({ ...card, texts: texts.filter((x) => x.id !== t.id) })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="cp-btn-text mb-4" onClick={() => onChange({ ...card, texts: [...texts, newTextLine()] })}>
        <Plus className="h-4 w-4" /> Texte
      </button>

      <span className="cp-sub">Libellé du bouton</span>
      <input
        type="text"
        className="cp-input"
        value={card.buttonText ?? ""}
        placeholder="Continuer"
        onChange={(e) => onChange({ ...card, buttonText: e.target.value })}
      />
    </div>
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
  const replace = (c: CustomCard) => setDraft((d) => d.map((x) => (x.id === c.id ? c : x)));
  const remove = (id: string) => setDraft((d) => d.filter((c) => c.id !== id));

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
          Ajoutez de nouvelles cartes avec le bouton <b>+</b> et renseignez leur code HTML pour le rendu Web, ou ajoutez une carte personnalisée
          (vidéo/GIF, textes et bouton). Vos modifications seront synchronisées sur tous les appareils.
        </p>

        <div className="mb-7 flex flex-wrap gap-3">
          <button type="button" className="cp-btn-add" onClick={() => setDraft((d) => [...d, newCard(d.length)])}>
            + Ajouter une carte
          </button>
          <button type="button" className="cp-btn-add cp-btn-media" onClick={() => setDraft((d) => [...d, newMediaCard(d.length)])}>
            + Ajouter une carte personnalisée
          </button>
          <button type="button" className="cp-btn-save" disabled={saving} onClick={() => onPublish(draft)}>
            {saving ? "Publication..." : "Enregistrer & Publier globalement"}
          </button>
        </div>

        {draft.length === 0 && <p className="cp-intro">Aucune carte. Ajoutez-en une avec les boutons ci-dessus.</p>}
        {draft.map((card, i) =>
          card.kind === "media" ? (
            <MediaCardFields key={card.id} card={card} index={i} onChange={replace} onDelete={() => remove(card.id)} />
          ) : (
            <div key={card.id} className="cp-group">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor={`card-${card.id}`}>Carte {i + 1} (Code HTML / Rendu Web)</label>
                <button type="button" className="cp-btn-del shrink-0" onClick={() => remove(card.id)}>
                  Supprimer cette carte
                </button>
              </div>
              <textarea
                id={`card-${card.id}`}
                value={card.html}
                placeholder="Ex: <div style='padding:20px;'><h1>Mon Titre</h1></div>"
                onChange={(e) => replace({ ...card, html: e.target.value })}
              />
            </div>
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}
