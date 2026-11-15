import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState, type MouseEvent } from "react";
import { ArrowLeft, ChevronsDown, ChevronsUp, Maximize2 } from "lucide-react";
import { methodQuery, rectsOverlap, type MethodRect } from "@/lib/method";
import { appSettingsQuery, DEFAULT_APP_CONFIG } from "@/lib/settings";
import { useAccess } from "@/lib/auth";
import { A4Page } from "@/components/method/A4Page";
import { usePageScale } from "@/components/method/useScale";
import { RectContent, rectStyle } from "@/components/method/RectContent";
import { MaskContent, maskVisual } from "@/components/method/MaskView";
import { TTSBar } from "@/components/method/TTSBar";
import { useTTS } from "@/components/method/useTTS";
import { usePremiumCheckout } from "@/components/PaymentProvider";
import { CustomPageFullscreen } from "@/components/method/CustomPage";

export const Route = createFileRoute("/au-stop-de-madame/app/methode/")({
  head: () => ({
    meta: [
      { title: "La méthode — Au stop de madame" },
      { name: "description", content: "Lisez la méthode Au stop de madame, page par page, au format A4." },
      { property: "og:title", content: "La méthode — Au stop de madame" },
      { property: "og:description", content: "Lisez la méthode Au stop de madame, page par page, au format A4." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MethodReader,
});

type Reveal = { target: MethodRect; x: number; y: number };

function MethodReader() {
  const { data, isLoading } = useQuery(methodQuery);
  const { data: settings = DEFAULT_APP_CONFIG } = useQuery(appSettingsQuery);
  const { isPremium, user } = useAccess();
  const { startCheckout } = usePremiumCheckout();
  const { ref, scale } = usePageScale(1.15);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const [revealed, setRevealed] = useState<Record<string, Reveal>>({});
  const [fullId, setFullId] = useState<string | null>(null);
  const closeFull = useCallback(() => setFullId(null), []);

  const pages = data?.pages ?? [];
  const rects = data?.rects ?? [];
  const getPageEl = useCallback((n: number) => pageEls.current.get(n) ?? null, []);
  const tts = useTTS(getPageEl, pages.length);

  /** "Sauter cette page": from the top edge jump down to the next page, from the bottom edge jump up to the previous one. */
  function skipPage(n: number, dir: "down" | "up") {
    const target = pageEls.current.get(dir === "down" ? n + 1 : n - 1);
    const top = target
      ? target.getBoundingClientRect().top + window.scrollY - 64
      : dir === "down"
        ? document.documentElement.scrollHeight
        : 0;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function onButton(rect: MethodRect, pageNumber: number, e: MouseEvent) {
    const c = rect.config;
    if (c.contentType === "button_url") {
      if (c.url) window.open(c.url, "_blank", "noopener");
      return;
    }
    if (c.contentType === "button_reveal" && c.targetRectId) {
      const target = rects.find((r) => r.id === c.targetRectId);
      const pageEl = pageEls.current.get(pageNumber);
      if (!target || !pageEl) return;
      const box = pageEl.getBoundingClientRect();
      const px = ((e.clientX - box.left) / box.width) * 100;
      const py = ((e.clientY - box.top) / box.height) * 100;
      const w = target.full_page ? 100 : target.width_percent;
      const h = target.full_page ? 100 : target.height_percent;
      setRevealed((prev) => ({
        ...prev,
        [rect.id]: {
          target,
          x: Math.min(Math.max(0, px - w / 2), 100 - w),
          y: Math.min(Math.max(0, py - h / 2), 100 - h),
        },
      }));
    }
  }

  return (
    <div className="bg-reader min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/40 bg-reader/95 px-4 py-3 text-page backdrop-blur">
        <Link to={user ? "/au-stop-de-madame/app" : "/auth"} className="flex items-center gap-1.5 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> {user ? "Tableau de bord" : "Connexion"}
        </Link>
        <span className="font-display text-base font-bold">Méthode</span>
        <span className="text-xs opacity-70">{pages.length} pages</span>
      </header>

      <div ref={ref} className="mp-reader">
        {isLoading && <p className="py-20 text-sm text-page/70">Chargement de la méthode…</p>}
        {!isLoading && pages.length === 0 && <p className="py-20 text-sm text-page/70">La méthode sera bientôt disponible.</p>}
        {pages.map((page, i) => {
          const n = i + 1;
          const pageRects = rects.filter((r) => r.page_id === page.id);
          const masks = isPremium ? [] : pageRects.filter((r) => r.kind === "mask");
          const contents = pageRects.filter((r) => r.kind === "content" && !r.config.revealOnly && !revealed[r.id]);
          const reveals = Object.entries(revealed)
            .filter(([btnId]) => pageRects.some((r) => r.id === btnId))
            .map(([btnId, rv]) => ({ btnId, ...rv }));

          const custom = page.type === "custom";
          const sheet = (
            <A4Page
              key={page.id}
              page={page}
              pageNumber={n}
              scale={scale}
              fontSize={settings.fontSize}
              footerText={settings.footerText}
              reading={tts.playing && tts.page === n}
              pageRef={(el) => {
                if (el) pageEls.current.set(n, el);
                else pageEls.current.delete(n);
              }}
              controls={
                custom && masks.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setFullId(page.id)}
                    className="absolute right-3 top-0 z-30 flex -translate-y-1/2 items-center gap-1 rounded-full bg-page-ink px-3 py-1.5 text-xs font-bold text-page shadow-lg"
                  >
                    <Maximize2 className="h-3.5 w-3.5" /> Agrandir la page
                  </button>
                ) : null
              }
              overlay={
                <>
                  {contents.map((r) => (
                    <RectContent
                      key={r.id}
                      rect={r}
                      style={rectStyle(r)}
                      canExpand={!masks.some((m) => rectsOverlap(m, r))}
                      onButton={(e) => onButton(r, n, e)}
                    />
                  ))}
                  {reveals.map(({ btnId, target, x, y }) => (
                    <RectContent
                      key={`rv-${btnId}`}
                      rect={target}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        width: `${target.full_page ? 100 : target.width_percent}%`,
                        height: `${target.full_page ? 100 : target.height_percent}%`,
                      }}
                      canExpand={!masks.some((m) => rectsOverlap(m, { ...target, x_percent: x, y_percent: y, full_page: false }))}
                      onButton={(e) => onButton(target, n, e)}
                    />
                  ))}
                  {masks.map((m) => (
                    <div key={m.id} className="absolute z-20" style={{ ...rectStyle(m), ...maskVisual(m) }}>
                      <MaskContent rect={m} onCta={() => startCheckout({ url: m.config.ctaUrl })} />
                    </div>
                  ))}
                </>
              }
            />
          );
          if (!custom) return sheet;
          const skip = (pos: "top" | "bottom") => (
            <button
              type="button"
              onClick={() => skipPage(n, pos === "top" ? "down" : "up")}
              className={`absolute left-3 z-30 flex items-center gap-1 rounded-full bg-cta px-3 py-1.5 text-xs font-bold text-brand-ink shadow-glow ${pos === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"}`}
            >
              {pos === "top" ? <ChevronsDown className="h-3.5 w-3.5" /> : <ChevronsUp className="h-3.5 w-3.5" />} Sauter cette page
            </button>
          );
          return (
            <div key={page.id} className="relative w-full">
              {skip("top")}
              {sheet}
              {skip("bottom")}
            </div>
          );
        })}
      </div>

      {fullId && <CustomPageFullscreen cards={pages.find((p) => p.id === fullId)?.cards ?? []} onClose={closeFull} />}

      {pages.length > 0 && (
        <TTSBar
          premium={isPremium}
          playing={tts.playing}
          loading={tts.loading}
          page={tts.page}
          total={pages.length}
          auto={tts.auto}
          gender={tts.gender}
          onPlay={tts.play}
          onPause={tts.pause}
          onStop={tts.stop}
          onAuto={tts.setAuto}
          onGender={tts.setGender}
          onUpgrade={() => startCheckout()}
        />
      )}
    </div>
  );
}
