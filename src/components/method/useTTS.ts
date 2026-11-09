import { useCallback, useEffect, useRef, useState } from "react";

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
type Chunk = { text: string; start: number };

function collect(pageEl: HTMLElement) {
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
  // Split into sentence-sized chunks (long utterances are cut by some browsers).
  const chunks: Chunk[] = [];
  const re = /[^.!?…:\n]+[.!?…:\n]*\s*/g;
  let m: RegExpExecArray | null;
  let buf = "";
  let bufStart = 0;
  while ((m = re.exec(full))) {
    if (!buf) bufStart = m.index;
    buf += m[0];
    if (buf.length > 160) {
      if (buf.trim()) chunks.push({ text: buf, start: bufStart });
      buf = "";
    }
  }
  if (buf.trim()) chunks.push({ text: buf, start: bufStart });
  return { segs, chunks, full };
}

function rangeAt(segs: Seg[], from: number, to: number): Range | null {
  const a = segs.find((s) => from >= s.start && from < s.end);
  const b = segs.find((s) => to > s.start && to <= s.end) ?? a;
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.node, from - a.start);
  r.setEnd(b.node, Math.min(b.node.length, to - b.start));
  return r;
}

export function useTTS(getPageEl: (n: number) => HTMLElement | null, totalPages: number) {
  const [playing, setPlaying] = useState(false);
  const [page, setPage] = useState(1);
  const [auto, setAuto] = useState(true);
  const [gender, setGender] = useState<VoiceGender>("female");
  const state = useRef({ page: 1, chunk: 0, token: 0, data: null as ReturnType<typeof collect> | null });
  const autoRef = useRef(auto);
  const genderRef = useRef(gender);
  autoRef.current = auto;
  genderRef.current = gender;

  const clearHighlight = () => {
    if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.delete("tts-word");
  };

  const stop = useCallback(() => {
    state.current.token++;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    clearHighlight();
  }, []);

  const speakChunk = useCallback(
    (token: number) => {
      const s = state.current;
      if (token !== s.token || !s.data) return;
      const chunk = s.data.chunks[s.chunk];
      if (!chunk) {
        // page finished
        if (autoRef.current && s.page < totalPages) {
          startPage(s.page + 1, token);
        } else {
          setPlaying(false);
          clearHighlight();
        }
        return;
      }
      const u = new SpeechSynthesisUtterance(chunk.text);
      u.lang = "fr-FR";
      const v = pickVoice(genderRef.current);
      if (v) u.voice = v;
      u.pitch = genderRef.current === "male" ? 0.85 : 1.1;
      u.rate = 1;
      const segs = s.data.segs;
      const full = s.data.full;
      u.onboundary = (e) => {
        if (token !== state.current.token || e.name !== "word") return;
        const from = chunk.start + e.charIndex;
        let to = from + (e.charLength || 0);
        if (!e.charLength) {
          const rest = full.slice(from);
          const m = rest.match(/^\S+/);
          to = from + (m ? m[0].length : 1);
        }
        const r = rangeAt(segs, from, to);
        if (!r) return;
        if (typeof CSS !== "undefined" && "highlights" in CSS) {
          CSS.highlights.set("tts-word", new Highlight(r));
        }
        const box = r.getBoundingClientRect();
        if (box.top < 90 || box.bottom > window.innerHeight - 140) {
          window.scrollBy({ top: box.top - window.innerHeight / 3, behavior: "smooth" });
        }
      };
      u.onend = () => {
        if (token !== state.current.token) return;
        state.current.chunk++;
        speakChunk(token);
      };
      u.onerror = () => {
        if (token !== state.current.token) return;
        setPlaying(false);
      };
      window.speechSynthesis.speak(u);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totalPages],
  );

  const startPage = useCallback(
    (n: number, token?: number) => {
      const el = getPageEl(n);
      if (!el) return;
      const t = token ?? ++state.current.token;
      state.current = { page: n, chunk: 0, token: t, data: collect(el) };
      setPage(n);
      setPlaying(true);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      speakChunk(t);
    },
    [getPageEl, speakChunk],
  );

  const play = useCallback(
    (n?: number) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const target = n ?? state.current.page;
      if (n === undefined && state.current.data && state.current.page === target) {
        // resume at the current sentence
        const t = ++state.current.token;
        setPlaying(true);
        speakChunk(t);
        return;
      }
      startPage(Math.min(Math.max(1, target), totalPages));
    },
    [startPage, speakChunk, totalPages],
  );

  const pause = useCallback(() => {
    state.current.token++;
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }, []);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => {
      state.current.token++;
      window.speechSynthesis?.cancel();
      clearHighlight();
    };
  }, []);

  return { playing, page, auto, setAuto, gender, setGender, play, pause, stop };
}
