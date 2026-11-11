import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { appSettingsQuery, DEFAULT_APP_CONFIG } from "@/lib/settings";
import { signedPremiumUrl } from "@/lib/upload";
import { usePremiumCheckout } from "@/components/PaymentProvider";
import { cn } from "@/lib/utils";
import {
  belly,
  classic,
  goals,
  initProgress,
  onboardSteps,
  squat,
  STORAGE_KEY,
  words,
  type BellyDay,
  type ClassicLevel,
  type ExType,
  type Lang,
  type Progress,
  type SquatDay,
  type WordKey,
} from "./apex-data";

type Screen = "lang" | "onboard" | "home" | "levels" | "days" | "custom" | "training" | "premium";
type PremiumKey = "flux" | "respiratory";
type Data = ClassicLevel | SquatDay | BellyDay;

const PHASE_COLORS: Record<string, string> = {
  squeeze: "var(--apex-emerald)",
  rest: "var(--apex-pink)",
  descent: "var(--apex-cyan)",
  ascent: "var(--apex-emerald)",
  breath: "var(--apex-purple)",
  inflate: "var(--apex-amber)",
  deflate: "var(--apex-cyan)",
};
const IDLE = "var(--apex-line)";
const CIRC = 2 * Math.PI * 45;

export function ApexTrainer({ isPremium, signedIn }: { isPremium: boolean; signedIn: boolean }) {
  const { data: settings = DEFAULT_APP_CONFIG } = useQuery(appSettingsQuery);
  const { startCheckout } = usePremiumCheckout();
  const { data: contentStatus = [] } = useQuery({
    queryKey: ["premium_content_status"],
    queryFn: async () => {
      const { data } = await supabase.rpc("premium_content_status");
      return (data ?? []) as { key: string; ready: boolean }[];
    },
  });
  const isReady = (k: PremiumKey) => contentStatus.some((c) => c.key === k && c.ready);

  const [screen, setScreen] = useState<Screen>("lang");
  const [lang, setLangState] = useState<Lang>("fr");
  const [type, setType] = useState<ExType>("classic");
  const [levelIndex, setLevelIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [progress, setProgress] = useState<Progress>(initProgress);
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState(true);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(1);
  const [comingSoon, setComingSoon] = useState<PremiumKey | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [premiumKey, setPremiumKey] = useState<PremiumKey | null>(null);
  const [customVals, setCustomVals] = useState<Record<string, string>>({});

  // training display
  const [timer, setTimer] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [ringP, setRingP] = useState(0);
  const [ringColor, setRingColor] = useState(IDLE);
  const [repText, setRepText] = useState("");
  const [repBar, setRepBar] = useState(0);
  const [pausedUI, setPausedUI] = useState(true);
  const [setInfo, setSetInfo] = useState("");

  const w = (k: WordKey) => words[lang][k] ?? k;

  // live context for the timing engine
  const ctx = useRef({ lang, type, levelIndex, dayIndex, custom: false, customData: null as Data | null, sound, voice, setIndex: 0, returnTo: "days" as "days" | "custom" });
  ctx.current.lang = lang;
  ctx.current.type = type;
  ctx.current.levelIndex = levelIndex;
  ctx.current.dayIndex = dayIndex;
  ctx.current.sound = sound;
  ctx.current.voice = voice;
  const E = useRef({ paused: true, phase: null as string | null, phaseStart: 0, duration: 0, raf: 0, rep: 0, cycle: 0, startedAt: 0, pausedAt: 0, elapsedPaused: 0, left: 0 });
  const audio = useRef<AudioContext | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // ---------- persistence ----------
  useEffect(() => {
    try {
      const x = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (x) {
        setLangState(x.lang || "fr");
        setSound(x.sound ?? true);
        setVoice(x.voice ?? true);
        setDone(!!x.done);
        const base = initProgress();
        if (x.progress) for (const k of ["classic", "squat", "belly"] as ExType[]) if (x.progress[k]?.length === base[k].length) base[k] = x.progress[k];
        setProgress(base);
      }
    } catch {
      /* ignore */
    }
    return () => {
      cancelAnimationFrame(E.current.raf);
      hush();
    };
  }, []);

  const save = (patch: Partial<{ lang: Lang; progress: Progress; sound: boolean; voice: boolean }> = {}) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ lang: patch.lang ?? lang, progress: patch.progress ?? progressRef.current, sound: patch.sound ?? sound, voice: patch.voice ?? voice, done: true }),
      );
    } catch {
      /* ignore */
    }
  };

  // ---------- audio ----------
  const actx = () => {
    if (!audio.current) audio.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audio.current.state === "suspended") audio.current.resume();
    return audio.current;
  };
  const tone = (freq: number, dur: number, wave: OscillatorType = "sine", vol = 0.35, delay = 0) => {
    if (!ctx.current.sound) return;
    const c = actx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const ding = () => tone(880, 0.3);
  const bellyDing = () => tone(1000, 0.1, "square", 0.25);
  const doubleDing = () => {
    tone(400, 0.2, "sine", 0.35);
    tone(600, 0.2, "sine", 0.35, 0.25);
  };
  // ---------- voice cues ----------
  // Device voice when it works, otherwise cloud clips (in-app browsers have no device voice).
  const sayToken = useRef(0);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const exerciseClip = (text: string, l: Lang) =>
    cachedClip(`ex|${l}|${text}`, () => getExerciseClip({ data: { text, lang: l } }).then((r) => r.url));
  function hush() {
    sayToken.current++;
    window.speechSynthesis?.cancel();
    sharedAudio().pause();
  }
  const sayCloud = (text: string, l: Lang, t: number) => {
    exerciseClip(text, l)
      .then((url) => {
        if (t !== sayToken.current) return;
        const a = sharedAudio();
        a.src = url;
        a.play().catch(() => {});
      })
      .catch(() => {});
  };
  const nativeOk = () => hasNativeSpeech() && window.speechSynthesis.getVoices().length > 0;
  const say = (text: string) => {
    if (!ctx.current.voice) return;
    const l = ctx.current.lang;
    const t = ++sayToken.current;
    sharedAudio().pause();
    if (!nativeOk()) return sayCloud(text, l, t);
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.toLocaleLowerCase(l));
    u.lang = l === "fr" ? "fr-FR" : "en-US";
    utterRef.current = u;
    let started = false;
    u.onstart = () => {
      started = true;
    };
    // Some browsers drop speak() right after cancel().
    window.setTimeout(() => t === sayToken.current && synth.speak(u), 60);
    window.setTimeout(() => {
      if (started || t !== sayToken.current) return;
      markNativeBroken();
      synth.cancel();
      sayCloud(text, l, t);
    }, 2000);
  };
  const prefetchCues = () => {
    if (!ctx.current.voice || nativeOk()) return;
    const l = ctx.current.lang;
    (["squeeze", "relax", "down", "up", "breathe", "inflateText", "deflateText", "rest"] as const).forEach((k) =>
      exerciseClip(words[l][k], l).catch(() => {}),
    );
  };

  // ---------- engine ----------
  const plan = (t: ExType = ctx.current.type) => (t === "classic" ? classic : t === "squat" ? squat : belly);
  const activeData = (): Data => {
    const c = ctx.current;
    if (c.custom && c.customData) return c.customData;
    if (c.type === "classic") return classic[c.levelIndex] ?? classic[0]!;
    return ((plan() as typeof squat)[c.levelIndex]?.days[c.dayIndex] ?? squat[0]!.days[0]!) as Data;
  };
  const wl = (k: WordKey) => words[ctx.current.lang][k];

  const ring = (p: number, color: string) => {
    setRingP(p);
    setRingColor(color);
  };

  function startPhase(sec: number, name: string, label: string, fn: (() => void) | null) {
    const e = E.current;
    e.duration = sec * 1000;
    e.phaseStart = performance.now();
    e.phase = name;
    setPrompt(label);
    fn?.();
    if (!e.paused) e.raf = requestAnimationFrame(loop);
    say(label);
  }

  function loop(now: number) {
    const e = E.current;
    if (e.paused) return;
    const p = Math.min((now - e.phaseStart) / e.duration, 1);
    const left = Math.max(0, Math.ceil((e.duration - (now - e.phaseStart)) / 1000));
    e.left = left;
    setTimer(left);
    ring(p, PHASE_COLORS[e.phase ?? ""] ?? IDLE);
    const t = ctx.current.type;
    const d = activeData() as ClassicLevel & SquatDay & BellyDay;
    const total =
      t === "classic" ? d.r * (d.hold + d.rest) : t === "squat" ? d.r * (d.d + 2) + Math.floor(d.r / d.b) * 4 : d.r * ((d.g + d.d) * d.c + 8);
    if (e.startedAt) setRepBar(Math.min(100, ((now - e.startedAt - e.elapsedPaused) / 1000 / total) * 100));
    if (p >= 1) nextPhase();
    else e.raf = requestAnimationFrame(loop);
  }

  function nextRep() {
    const e = E.current;
    const d = activeData() as ClassicLevel & SquatDay & BellyDay;
    if (e.rep >= d.r) {
      endSet();
      return;
    }
    e.rep++;
    e.cycle = 0;
    setRepText(`${wl("reps")}: ${e.rep} / ${d.r}`);
    const t = ctx.current.type;
    if (t === "classic") startPhase(d.hold, "squeeze", wl("squeeze"), ding);
    else if (t === "squat") startPhase(d.d, "descent", wl("down"), ding);
    else startPhase(d.g, "inflate", wl("inflateText"), bellyDing);
  }

  function nextPhase() {
    const e = E.current;
    const d = activeData() as ClassicLevel & SquatDay & BellyDay;
    const t = ctx.current.type;
    if (t === "classic") {
      if (e.phase === "squeeze") startPhase(d.rest, "rest", wl("relax"), ding);
      else nextRep();
    } else if (t === "squat") {
      if (e.phase === "descent") startPhase(2, "ascent", wl("up"), ding);
      else if (e.phase === "ascent" && e.rep % d.b === 0) startPhase(4, "breath", wl("breathe"), doubleDing);
      else nextRep();
    } else {
      if (e.phase === "inflate") startPhase(d.d, "deflate", wl("deflateText"), bellyDing);
      else if (e.phase === "deflate") {
        e.cycle++;
        if (e.cycle < d.c) startPhase(d.g, "inflate", wl("inflateText"), bellyDing);
        else startPhase(4, "breath", wl("breathe"), doubleDing);
      } else if (e.phase === "breath") startPhase(4, "rest", wl("rest"), null);
      else nextRep();
    }
  }

  function togglePause() {
    unlockAudio();
    const e = E.current;
    e.paused = !e.paused;
    setPausedUI(e.paused);
    if (e.paused) {
      cancelAnimationFrame(e.raf);
      e.pausedAt = performance.now();
      setPrompt(wl("paused"));
      hush();
    } else {
      if (!e.startedAt) {
        e.startedAt = performance.now();
        nextRep();
      } else {
        e.elapsedPaused += performance.now() - e.pausedAt;
        e.phaseStart = performance.now() - (e.duration - e.left * 1000);
        e.raf = requestAnimationFrame(loop);
      }
    }
  }

  function endSet() {
    cancelAnimationFrame(E.current.raf);
    hush();
    const c = ctx.current;
    E.current.paused = true;
    setPausedUI(true);
    if (!c.custom) {
      const next = structuredClone(progressRef.current);
      const daySets = next[c.type][c.levelIndex]?.days[c.dayIndex]?.sets;
      if (daySets) daySets[c.setIndex] = true;
      setProgress(next);
      save({ progress: next });
      setScreen("days");
    } else setScreen("custom");
  }

  function initTraining() {
    const e = E.current;
    Object.assign(e, { rep: 0, cycle: 0, paused: true, phase: null, startedAt: 0, elapsedPaused: 0, left: 0 });
    setPausedUI(true);
    const d = activeData() as ClassicLevel & SquatDay & BellyDay;
    const t = ctx.current.type;
    setSetInfo(`${wl("set")} ${ctx.current.setIndex + 1}`);
    setRepText(`${wl("reps")}: 0 / ${d.r}`);
    setPrompt(wl("play"));
    setTimer(t === "classic" ? d.hold : t === "squat" ? d.d : d.g);
    setRepBar(0);
    ring(0, IDLE);
    prefetchCues();
    setScreen("training");
  }

  function startSet(d: number) {
    const sets = progress[type][levelIndex]?.days[d]?.sets ?? [];
    const idx = sets.findIndex((x) => !x);
    if (idx < 0) return;
    setDayIndex(d);
    Object.assign(ctx.current, { dayIndex: d, custom: false, setIndex: idx, returnTo: "days" });
    initTraining();
  }

  const read = (k: string, def: number) => Math.max(1, Math.min(100, parseInt(customVals[k] ?? "") || def));
  function startCustom() {
    let data: Data;
    if (type === "classic") data = { level: 0, hold: read("hold", 5), rest: read("release", 5), r: read("reps", 10), sets: 1 };
    else if (type === "squat") data = { d: read("descent", 3), a: 2, r: read("reps", 10), b: read("breath", 5), s: 1 };
    else data = { g: read("inflate", 2), d: read("deflate", 2), c: read("cycles", 3), r: read("reps", 5), s: 1 };
    Object.assign(ctx.current, { custom: true, customData: data, setIndex: 0, returnTo: "custom" });
    initTraining();
  }

  function goBack() {
    const e = E.current;
    e.paused = true;
    setPausedUI(true);
    if (e.raf) cancelAnimationFrame(e.raf);
    e.raf = 0;
    hush();
    e.phase = null;
    setScreen(ctx.current.returnTo === "custom" ? "custom" : "days");
  }

  function setLang(l: Lang) {
    setLangState(l);
    save({ lang: l });
    if (done) setScreen("home");
    else {
      setStep(1);
      setScreen("onboard");
    }
  }

  function resetAll() {
    if (!window.confirm(w("confirm"))) return;
    const p = initProgress();
    setProgress(p);
    localStorage.removeItem(STORAGE_KEY);
    setDone(false);
    setStep(1);
    setScreen("onboard");
  }

  function chooseExercise(k: ExType) {
    setType(k);
    ctx.current.type = k;
    setScreen("levels");
  }

  function openExercise(k: string) {
    if (k === "classic") return chooseExercise("classic");
    if (k === "squat" || k === "belly") {
      if (!isPremium) return setLocked(k === "squat" ? w("squat") : w("belly"));
      return chooseExercise(k);
    }
    const pk = k as PremiumKey;
    if (!isReady(pk)) return setComingSoon(pk);
    if (!isPremium) return setLocked(pk === "flux" ? "Kegel FluxControl ⚡ Premium" : "Kegel respiratoire 💨 Premium");
    setPremiumKey(pk);
    setScreen("premium");
  }

  const fields: [string, number, number, number][] =
    type === "classic"
      ? [["hold", 5, 60, 5], ["release", 5, 60, 5], ["reps", 10, 100, 10]]
      : type === "squat"
        ? [["descent", 3, 5, 3], ["reps", 10, 100, 10], ["breath", 5, 20, 5]]
        : [["inflate", 2, 10, 2], ["deflate", 2, 10, 2], ["cycles", 3, 20, 3], ["reps", 5, 100, 5]];

  const exercises: { key: string; icon: string; title: string; desc: string; premium: boolean; soon?: boolean }[] = [
    { key: "classic", icon: "🧘", title: w("classic"), desc: w("classicDesc"), premium: false },
    { key: "squat", icon: "🏋️‍♂️", title: w("squat"), desc: w("squatDesc"), premium: true },
    { key: "belly", icon: "🌊", title: w("belly"), desc: w("bellyDesc"), premium: true },
    {
      key: "flux",
      icon: "⚡",
      title: "Kegel FluxControl ⚡ Premium",
      desc: isReady("flux") ? (lang === "fr" ? "Contenu exclusif premium." : "Exclusive premium content.") : lang === "fr" ? "Bientôt disponible" : "Coming soon",
      premium: true,
      soon: !isReady("flux"),
    },
    {
      key: "respiratory",
      icon: "🌬️",
      title: lang === "fr" ? "Kegel respiratoire 💨 Premium" : "Breathing Kegel 💨 Premium",
      desc: isReady("respiratory") ? (lang === "fr" ? "Contenu exclusif premium." : "Exclusive premium content.") : lang === "fr" ? "Bientôt disponible" : "Coming soon",
      premium: true,
      soon: !isReady("respiratory"),
    },
  ];

  const ob = onboardSteps[lang][step - 1];
  const levelPlan = plan(type);
  const dayPlan = progress[type][levelIndex]?.days ?? [];

  return (
    <div className="min-h-screen bg-apex-bg font-sans text-foreground">
      {comingSoon && (
        <Modal onClose={() => setComingSoon(null)}>
          <div className="mb-3 text-4xl">🚧</div>
          <h2 className="mb-2 text-2xl font-black">{comingSoon === "flux" ? "Kegel FluxControl" : "Kegel respiratoire"}</h2>
          <p className="mb-6 text-apex-soft">
            {lang === "fr" ? "Cet exercice est en préparation et sera disponible dans une prochaine mise à jour." : "This exercise is in development and will be available in a future update."}
          </p>
          <button onClick={() => setComingSoon(null)} className="w-full rounded-xl bg-apex-pink py-3 font-bold">OK</button>
        </Modal>
      )}
      {locked && (
        <Modal onClose={() => setLocked(null)}>
          <div className="mb-3 flex justify-center"><Lock className="h-10 w-10 text-apex-amber" /></div>
          <h2 className="mb-2 text-xl font-black">{locked}</h2>
          <p className="mb-6 text-apex-soft">{lang === "fr" ? "Cet exercice est réservé aux membres premium." : "This exercise is for premium members."}</p>
          {signedIn ? (
            <button
              onClick={() => {
                setLocked(null);
                startCheckout();
              }}
              className="w-full rounded-xl bg-cta py-3 font-bold text-brand-ink"
            >
              {lang === "fr" ? "Obtenir l'offre premium" : "Get premium"}
            </button>
          ) : (
            <Link to="/auth" search={{ redirect: "/au-stop-de-madame/app/exercices" }} className="block w-full rounded-xl bg-cta py-3 font-bold text-brand-ink">
              {lang === "fr" ? "Se connecter" : "Sign in"}
            </Link>
          )}
        </Modal>
      )}

      <main className="mx-auto flex min-h-screen max-w-md flex-col p-4">
        {screen === "lang" && (
          <section className="flex flex-grow flex-col items-center justify-center text-center">
            <h1 className="mb-4 bg-apex-title bg-clip-text text-5xl font-black text-transparent">APEX POWER</h1>
            <p className="mb-10 text-apex-soft">Choose your language / Choisissez votre langue</p>
            <button className="mb-3 w-full rounded-xl bg-apex-medium p-4 font-bold" onClick={() => setLang("fr")}>🇫🇷 Français</button>
            <button className="w-full rounded-xl bg-apex-medium p-4 font-bold" onClick={() => setLang("en")}>🇬🇧 English</button>
            <Link to="/au-stop-de-madame/app" className="mt-8 text-sm text-apex-soft underline underline-offset-4">← Tableau de bord</Link>
          </section>
        )}

        {screen === "onboard" && ob && (
          <section className="flex flex-grow flex-col justify-center text-center">
            <h1 className="mb-3 text-4xl font-bold">Apex Power</h1>
            <p className="mb-8 text-apex-soft">{w("intro")}</p>
            <h2 className="mb-4 text-2xl font-semibold">{ob[0]}</h2>
            <p className="mb-4 text-apex-soft">{ob[1]}</p>
            {ob[2] && <p className="mb-7 text-sm text-apex-amber">{ob[2]}</p>}
            <button
              className="w-full rounded-full bg-apex-pink px-8 py-3 font-bold"
              onClick={() => {
                if (step === 3) {
                  setDone(true);
                  save();
                  setScreen("home");
                } else setStep(step + 1);
              }}
            >
              {step === 3 ? w("ready") : w("next")}
            </button>
          </section>
        )}

        {screen === "home" && (
          <section className="flex flex-grow flex-col">
            <header className="my-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{w("choose")}</h2>
              <div className="flex gap-2">
                <Link to="/au-stop-de-madame/app" className="rounded-full border border-apex-line px-3 py-1 text-sm">🏠</Link>
                <button onClick={() => setScreen("lang")} className="rounded-full border border-apex-line px-3 py-1 text-sm">🌐 Lang</button>
              </div>
            </header>
            <div className="flex-grow space-y-4">
              {exercises.map((a) => (
                <button key={a.key} className="w-full rounded-xl border border-apex-medium bg-apex-card p-6 text-left" onClick={() => openExercise(a.key)}>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{a.icon}</span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{a.title}</h3>
                      <p className="text-sm text-apex-soft">{a.desc}</p>
                    </div>
                    {a.soon ? (
                      <span className="rounded-full border border-apex-amber/40 px-2 py-1 text-xs font-bold text-apex-amber">SOON</span>
                    ) : a.premium ? (
                      <span className="flex items-center gap-1 rounded-full border border-apex-amber/40 px-2 py-1 text-[10px] font-bold text-apex-amber">
                        {!isPremium && <Lock className="h-3 w-3" />}PREMIUM
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={resetAll} className="py-5 font-semibold text-apex-danger">{w("delete")}</button>
          </section>
        )}

        {screen === "levels" && (
          <section className="flex flex-grow flex-col">
            <header className="flex justify-between p-3">
              <h2 className="text-2xl font-bold">{w("levels")}</h2>
              <button onClick={() => setScreen("home")} className="text-3xl text-apex-pink">&times;</button>
            </header>
            <div className="space-y-3 overflow-y-auto pb-5">
              <div className="mb-3.5 rounded-xl border border-apex-fuchsia/35 bg-apex-fuchsia/10 p-3">
                <p className="mb-2 font-bold text-apex-fuchsia">{lang === "fr" ? "📌 Règle de pratique" : "📌 How to practice"}</p>
                <p className="text-sm leading-relaxed">{settings.practiceRules[lang][type]}</p>
              </div>
              <button className="mb-2 w-full rounded-lg border border-apex-purple bg-apex-purple/20 p-4 text-left" onClick={() => setScreen("custom")}>
                ⭐ {w("custom")}
              </button>
              {levelPlan.map((l, i) => {
                const complete = (progress[type][i]?.days ?? []).every((d) => d.sets.every(Boolean));
                return (
                  <button
                    key={i}
                    className="mb-2 flex w-full justify-between rounded-lg bg-apex-medium p-4 text-left"
                    onClick={() => {
                      setLevelIndex(i);
                      setScreen("days");
                    }}
                  >
                    <span>
                      <b>{w("level")} {l.level}</b>
                      <small className="block text-apex-soft">{goals[lang][type][i]}</small>
                    </span>
                    <span>{complete ? "⭐" : "○"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {screen === "days" && (
          <section className="flex flex-grow flex-col">
            <header className="flex justify-between p-3">
              <h2 className="text-2xl font-bold">{w("level")} {levelPlan[levelIndex]?.level}</h2>
              <button onClick={() => setScreen("levels")} className="text-3xl text-apex-pink">&times;</button>
            </header>
            <div className="space-y-3 overflow-y-auto">
              {dayPlan.map((d, j) => {
                const unlocked = j === 0 || !!dayPlan[j - 1]?.sets.every(Boolean);
                return (
                  <button
                    key={j}
                    disabled={!unlocked}
                    className="mb-2 flex w-full justify-between rounded-lg bg-apex-medium p-4 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => startSet(j)}
                  >
                    <b>{w("day")} {j + 1}</b>
                    <span className="flex gap-2">
                      {d.sets.map((v, k) => (
                        <i key={k} className={cn("h-2.5 w-2.5 rounded-full border-2", v ? "border-apex-emerald bg-apex-emerald" : "border-apex-line")} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {screen === "custom" && (
          <section className="flex flex-grow flex-col">
            <header className="flex justify-between p-3">
              <h2 className="text-2xl font-bold">{w("custom")}</h2>
              <button onClick={() => setScreen("levels")} className="text-3xl text-apex-pink">&times;</button>
            </header>
            <div className="my-auto space-y-4">
              {fields.map(([k, v, max, min]) => (
                <label key={k} className="block text-apex-soft">
                  {w(k as WordKey)}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={customVals[k] ?? String(v)}
                    onChange={(e) => setCustomVals({ ...customVals, [k]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-apex-line bg-apex-bg p-3 text-center text-lg font-bold text-foreground"
                  />
                </label>
              ))}
            </div>
            <button onClick={startCustom} className="mt-6 rounded-full bg-apex-pink p-4 font-bold">{w("start")}</button>
          </section>
        )}

        {screen === "training" && (
          <section className="flex flex-grow flex-col">
            <header className="flex items-center justify-between p-3">
              <div>
                <h2 className="text-lg font-bold">{ctx.current.custom ? w("custom") : `${w("level")} ${levelPlan[levelIndex]?.level}`}</h2>
                <p className="text-sm text-apex-soft">{ctx.current.custom ? "" : goals[lang][type][levelIndex]}</p>
              </div>
              <div>{setInfo}</div>
            </header>
            <div className="mb-6 px-3">
              <div className="h-3 rounded-full bg-apex-medium p-1">
                <div className="h-full rounded-full bg-apex-bar" style={{ width: `${repBar}%` }} />
              </div>
            </div>
            <div className="flex flex-grow flex-col items-center justify-center">
              <div className="relative h-64 w-64">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" stroke="var(--apex-line)" strokeWidth="8" fill="none" opacity=".35" />
                  <circle
                    className="apex-ring"
                    cx="50"
                    cy="50"
                    r="45"
                    stroke={ringColor}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${CIRC} ${CIRC}`}
                    strokeDashoffset={CIRC * (1 - ringP)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-center">
                  <div>
                    <p className="text-7xl font-bold">{timer}</p>
                    <p className="text-apex-soft">{w("sec")}</p>
                  </div>
                </div>
              </div>
              <p className="mt-8 text-center text-xl font-bold tracking-wide">{prompt}</p>
            </div>
            <p className="p-4 text-center font-semibold">{repText}</p>
            <div className="flex items-center justify-around rounded-full bg-apex-medium/60 p-4">
              <IconBtn
                onClick={() => {
                  const v = !sound;
                  setSound(v);
                  ctx.current.sound = v;
                  save({ sound: v });
                }}
              >
                {sound ? "🔊" : "🔇"}
              </IconBtn>
              <IconBtn
                onClick={() => {
                  const v = !voice;
                  setVoice(v);
                  ctx.current.voice = v;
                  if (!v) hush();
                  save({ voice: v });
                }}
              >
                {voice ? "🗣️" : "🔕"}
              </IconBtn>
              <button onClick={togglePause} className="flex h-16 w-16 items-center justify-center rounded-full bg-apex-pink text-2xl">
                {pausedUI ? "▶" : "Ⅱ"}
              </button>
              <IconBtn onClick={goBack} label="Retour à l’écran précédent">
                <span className="text-apex-cyan">↩</span>
              </IconBtn>
            </div>
          </section>
        )}

        {screen === "premium" && premiumKey && (
          <PremiumExercise keyName={premiumKey} lang={lang} onClose={() => setScreen("home")} />
        )}
      </main>
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-foreground/10">
      {children}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-apex-bg/80 p-5" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl border border-apex-medium bg-apex-card p-6 text-center">{children}</div>
    </div>
  );
}

function PremiumExercise({ keyName, lang, onClose }: { keyName: "flux" | "respiratory"; lang: Lang; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["premium_content", keyName],
    queryFn: async () => {
      const { data } = await supabase.from("premium_content").select("mode,html,pdf_path").eq("key", keyName).maybeSingle();
      if (!data) return null;
      const pdfUrl = data.mode === "pdf" && data.pdf_path ? await signedPremiumUrl(data.pdf_path) : null;
      return { ...data, pdfUrl };
    },
  });
  const title = keyName === "flux" ? "Kegel FluxControl ⚡ Premium" : lang === "fr" ? "Kegel respiratoire 💨 Premium" : "Breathing Kegel 💨 Premium";
  return (
    <section className="flex flex-grow flex-col">
      <header className="flex items-center justify-between p-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <button onClick={onClose} className="text-3xl text-apex-pink">&times;</button>
      </header>
      <div className="min-h-[70vh] flex-grow overflow-hidden rounded-xl border border-apex-medium bg-page">
        {isLoading && <p className="p-6 text-center text-sm text-page-ink">…</p>}
        {data?.mode === "pdf" && data.pdfUrl && <iframe title={title} src={data.pdfUrl} className="h-[75vh] w-full border-0" />}
        {data?.mode !== "pdf" && data?.html && (
          <iframe title={title} srcDoc={data.html} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" className="h-[75vh] w-full border-0 bg-page" />
        )}
      </div>
    </section>
  );
}
