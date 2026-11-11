import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getMethodClip } from "@/lib/tts.functions";
import { cachedClip, hasNativeSpeech, markNativeBroken, sharedAudio, unlockAudio } from "@/lib/speech";

export type VoiceGender = "female" | "male";

const FEMALE = /(amelie|amélie|audrey|marie|julie|hortense|virginie|denise|celine|céline|léa|lea|chantal|aurelie|aurélie|female|femme|eloise|brigitte|vivienne|yvette|google français)/i;
const MALE = /(thomas|paul|henri|claude|daniel|nicolas|jacques|male|homme|antoine|jean|guillaume|alain|remy|rémy|mathieu|fabrice|gerard|gérard)/i;

function pickVoice(gender: VoiceGender): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  const pool = fr.length ? fr : voices;
  const re = gender === "female" ? FEMALE : MALE;
  return pool.find((v) => re.test(v.name)) ?? pool[gender === "female" ? 0 : pool.length - 1] ?? null;
}

type Seg = { node: Text; start: number; end: number };
type Chunk = { text: string; start: number; words: { start: number; end: number }[] };
type PageData = { segs: Seg[]; chunks: Chunk[]; full: string };

function collect(pageEl: HTMLElement): PageData {
  const roots = pageEl.querySelectorAll<HTMLElement>("[data-tts-header], [data-tts]");
  const segs: Seg[] = [];
  let full = "";
  roots.forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = (n as Text).data;
      if (!t.trim()) continue;
      segs.push({ node: n as Text, start: full.length, end: full.length + t.length });
      full += t;
      full += " ";
    }
    full += " ";
  });
  // Sentence-sized chunks (long utterances are cut by some browsers, and cloud clips stay short).
  const chunks: Chunk[] = [];
  const re = /[^.!?…:\n]+[.!?…:\n]*\s*/g;
  let m: RegExpExecArray | null;
  let buf = "";
  let bufStart = 0;
  const push = () => {
    if (!buf.trim()) return;
    const words: Chunk["words"] = [];
    const wr = /\S+/g;
    let w: RegExpExecArray | null;
    while ((w = wr.exec(buf))) words.push({ start: w.index, end: w.index + w[0].length });
    chunks.push({ text: buf, start: bufStart, words });
  };
  while ((m = re.exec(full))) {
    if (!buf) bufStart = m.index;
    buf += m[0];
    if (buf.length > 160) {
      push();
      buf = "";
    }
  }
  push();
  return { segs, chunks, full };
}

function rangeAt(segs: Seg[], from: number, to: number): Range | null {
  const a = segs.find((s) => from >= s.start && from < s.end);
  const b = segs.find((s) => to > s.start && to <= s.end) ?? a;
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.node, Math.max(0, from - a.start));
  r.setEnd(b.node, Math.max(0, Math.min(b.node.length, to - b.start)));
  return r;
}

const clearHighlight = () => {
  if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.delete("tts-word");
};

/** Highlight the spoken word and keep it on screen. */
function showWord(segs: Seg[], from: number, to: number) {
  const r = rangeAt(segs, from, to);
  if (!r) return;
  if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.set("tts-word", new Highlight(r));
  const box = r.getBoundingClientRect();
  if (box.height && (box.top < 90 || box.bottom > window.innerHeight - 140)) {
    window.scrollBy({ top: box.top - window.innerHeight / 3, behavior: "smooth" });
  }
}

const clipKey = (gender: VoiceGender, text: string) => `method|${gender}|${text.trim()}`;
const loadClip = (gender: VoiceGender, text: string) =>
  cachedClip(clipKey(gender, text), () => getMethodClip({ data: { text: text.trim(), voice: gender } }).then((r) => r.url));

export function useTTS(getPageEl: (n: number) => HTMLElement | null, totalPages: number) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [auto, setAuto] = useState(true);
  const [gender, setGender] = useState<VoiceGender>("female");
  const state = useRef({
    page: 1,
    chunk: 0,
    token: 0,
    data: null as PageData | null,
    mode: null as "native" | "cloud" | null,
    utter: null as SpeechSynthesisUtterance | null,
    raf: 0,
    cloudPaused: false,
  });
  const autoRef = useRef(auto);
  const genderRef = useRef(gender);
  const totalRef = useRef(totalPages);
  autoRef.current = auto;
  genderRef.current = gender;
  totalRef.current = totalPages;

  const haltAudio = () => {
    cancelAnimationFrame(state.current.raf);
    window.speechSynthesis?.cancel();
    const a = sharedAudio();
    a.onended = null;
    a.onerror = null;
    a.pause();
  };

  const startPageRef = useRef<(n: number, token: number) => void>(() => {});

  const pageFinished = (token: number) => {
    const s = state.current;
    if (token !== s.token) return;
    if (autoRef.current && s.page < totalRef.current) startPageRef.current(s.page + 1, token);
    else {
      setPlaying(false);
      clearHighlight();
    }
  };

  const fail = (token: number, msg: string) => {
    if (token !== state.current.token) return;
    setPlaying(false);
    setLoading(false);
    toast.error(msg);
  };

  // ----- cloud voice (works everywhere, incl. in-app browsers) -----
  const speakCloud = (token: number) => {
    const s = state.current;
    if (token !== s.token || !s.data) return;
    const chunk = s.data.chunks[s.chunk];
    if (!chunk) return pageFinished(token);
    const data = s.data;
    const voice = genderRef.current;
    setLoading(true);
    loadClip(voice, chunk.text)
      .then((url) => {
        if (token !== state.current.token) return;
        setLoading(false);
        const a = sharedAudio();
        a.onended = () => {
          if (token !== state.current.token) return;
          cancelAnimationFrame(state.current.raf);
          state.current.chunk++;
          speakCloud(token);
        };
        a.onerror = () => fail(token, "Lecture audio impossible sur cet appareil");
        a.src = url;
        state.current.cloudPaused = false;
        a.play().catch(() => fail(token, "Appuyez à nouveau sur Lecture pour démarrer l'audio"));
        // Estimated word highlight from the audio position.
        const tick = () => {
          if (token !== state.current.token) return;
          if (a.duration && isFinite(a.duration)) {
            const pos = (a.currentTime / a.duration) * chunk.text.length;
            let w = chunk.words[0];
            for (const x of chunk.words) {
              if (x.start <= pos) w = x;
              else break;
            }
            if (w) showWord(data.segs, chunk.start + w.start, chunk.start + w.end);
          }
          state.current.raf = requestAnimationFrame(tick);
        };
        cancelAnimationFrame(state.current.raf);
        state.current.raf = requestAnimationFrame(tick);
        // Prepare the next sentence while this one plays.
        const next = data.chunks[state.current.chunk + 1];
        if (next) loadClip(voice, next.text).catch(() => {});
      })
      .catch((e: unknown) => fail(token, e instanceof Error ? e.message : "Lecture audio indisponible"));
  };

  // ----- device voice (exact word boundaries) -----
  const speakNative = (token: number) => {
    const s = state.current;
    if (token !== s.token || !s.data) return;
    const chunk = s.data.chunks[s.chunk];
    if (!chunk) return pageFinished(token);
    const data = s.data;
    const u = new SpeechSynthesisUtterance(chunk.text);
    s.utter = u; // keep a reference: some browsers drop events of collected utterances
    u.lang = "fr-FR";
    const v = pickVoice(genderRef.current);
    if (v) u.voice = v;
    u.pitch = genderRef.current === "male" ? 0.85 : 1.1;
    u.rate = 1;
    let started = false;
    const watchdog = window.setTimeout(() => {
      if (started || token !== state.current.token) return;
      // The device voice never started: switch to the cloud voice for this session.
      markNativeBroken();
      state.current.mode = "cloud";
      window.speechSynthesis.cancel();
      speakCloud(token);
    }, 2500);
    u.onstart = () => {
      started = true;
      window.clearTimeout(watchdog);
      setLoading(false);
    };
    u.onboundary = (e) => {
      if (token !== state.current.token || e.name !== "word") return;
      const from = chunk.start + e.charIndex;
      let to = from + (e.charLength || 0);
      if (!e.charLength) {
        const m = data.full.slice(from).match(/^\S+/);
        to = from + (m ? m[0].length : 1);
      }
      showWord(data.segs, from, to);
    };
    u.onend = () => {
      if (token !== state.current.token) return;
      window.clearTimeout(watchdog);
      state.current.chunk++;
      speakNative(token);
    };
    u.onerror = (e) => {
      window.clearTimeout(watchdog);
      if (token !== state.current.token || e.error === "interrupted" || e.error === "canceled") return;
      markNativeBroken();
      state.current.mode = "cloud";
      speakCloud(token);
    };
    window.speechSynthesis.speak(u);
  };

  const speak = (token: number) => (state.current.mode === "native" ? speakNative(token) : speakCloud(token));

  const startPage = useCallback(
    (n: number, token: number) => {
      const el = getPageEl(n);
      if (!el) return;
      Object.assign(state.current, { page: n, chunk: 0, token, data: collect(el) });
      setPage(n);
      setPlaying(true);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      speak(token);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getPageEl],
  );
  startPageRef.current = startPage;

  /** Must be called from the user's tap (unlocks audio). */
  const play = useCallback(
    (n?: number) => {
      unlockAudio();
      const s = state.current;
      if (!s.mode) s.mode = hasNativeSpeech() ? "native" : "cloud";
      if (s.mode === "native" && !hasNativeSpeech()) s.mode = "cloud";
      const target = n ?? s.page;
      // Resume a paused cloud sentence where it stopped.
      if (n === undefined && s.mode === "cloud" && s.cloudPaused && s.data) {
        const a = sharedAudio();
        s.cloudPaused = false;
        setPlaying(true);
        a.play().catch(() => fail(s.token, "Lecture audio impossible"));
        return;
      }
      haltAudio();
      const token = ++s.token;
      setLoading(true);
      if (n === undefined && s.data && s.page === target) {
        setPlaying(true);
        // Small delay: some browsers drop speak() called right after cancel().
        window.setTimeout(() => speak(token), 80);
        return;
      }
      const page = Math.min(Math.max(1, target), totalRef.current);
      window.setTimeout(() => startPage(page, token), 80);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startPage],
  );

  const pause = useCallback(() => {
    const s = state.current;
    setPlaying(false);
    setLoading(false);
    if (s.mode === "cloud" && sharedAudio().src && !sharedAudio().paused) {
      sharedAudio().pause();
      s.cloudPaused = true;
      return;
    }
    s.token++;
    haltAudio();
  }, []);

  const stop = useCallback(() => {
    state.current.token++;
    state.current.cloudPaused = false;
    state.current.data = null;
    haltAudio();
    setPlaying(false);
    setLoading(false);
    clearHighlight();
  }, []);

  // Changing voice restarts the current sentence with the new voice.
  useEffect(() => {
    const s = state.current;
    if (!playing || !s.data) return;
    haltAudio();
    s.cloudPaused = false;
    const token = ++s.token;
    window.setTimeout(() => speak(token), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender]);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => {
      state.current.token++;
      haltAudio();
      clearHighlight();
    };
  }, []);

  return { playing, loading, page, auto, setAuto, gender, setGender, play, pause, stop };
}
