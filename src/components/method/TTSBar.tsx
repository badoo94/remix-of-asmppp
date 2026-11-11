import { useState } from "react";
import { Loader2, Lock, Pause, Play, Square } from "lucide-react";
import type { VoiceGender } from "./useTTS";
import { cn } from "@/lib/utils";

interface Props {
  premium: boolean;
  playing: boolean;
  loading?: boolean;
  page: number;
  total: number;
  auto: boolean;
  gender: VoiceGender;
  onPlay: (page?: number) => void;
  onPause: () => void;
  onStop: () => void;
  onAuto: (v: boolean) => void;
  onGender: (g: VoiceGender) => void;
  onUpgrade: () => void;
}

export function TTSBar(p: Props) {
  const [target, setTarget] = useState("");
  const shell =
    "fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 items-center gap-2 rounded-2xl border border-border bg-popover/95 px-3 py-2 text-popover-foreground shadow-2xl backdrop-blur";

  if (!p.premium) {
    return (
      <div className={shell}>
        <Lock className="h-4 w-4 shrink-0 text-brand-gold" />
        <p className="flex-1 text-xs leading-tight">Lecture audio de la méthode réservée aux membres premium.</p>
        <button type="button" onClick={p.onUpgrade} className="shrink-0 rounded-lg bg-cta px-3 py-2 text-xs font-bold text-brand-ink">
          Passer premium
        </button>
      </div>
    );
  }

  const go = () => {
    const n = parseInt(target, 10);
    if (n >= 1 && n <= p.total) p.onPlay(n);
  };

  return (
    <div className={shell}>
      <button
        type="button"
        aria-label={p.playing ? "Pause" : "Lecture"}
        onClick={() => (p.playing ? p.onPause() : p.onPlay())}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta text-brand-ink shadow-glow"
      >
        {p.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : p.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" aria-label="Arrêter" onClick={p.onStop} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Square className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => p.onAuto(!p.auto)}
        className={cn("shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-semibold", p.auto ? "bg-brand-gold/20 text-brand-gold" : "bg-secondary text-muted-foreground")}
        title="Lecture séquentielle automatique"
      >
        Auto {p.auto ? "on" : "off"}
      </button>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-border text-[11px] font-semibold">
        {(["female", "male"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => p.onGender(g)}
            className={cn("px-2 py-1.5", p.gender === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}
          >
            {g === "female" ? "Femme" : "Homme"}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <input
          aria-label="Page à lire"
          inputMode="numeric"
          value={target}
          placeholder={String(p.page)}
          onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && go()}
          className="h-8 w-11 rounded-md border border-input bg-background text-center text-xs"
        />
        <button type="button" onClick={go} className="h-8 rounded-md bg-secondary px-2 text-[11px] font-semibold">
          Lire
        </button>
      </div>
    </div>
  );
}
