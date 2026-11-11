/**
 * Browser speech helpers. The device voice (Web Speech API) is used when it really works;
 * otherwise (Android WebView, in-app browsers, no voices…) we fall back to cloud audio clips
 * played through one shared <audio> element unlocked by the user's tap.
 */

let nativeBroken = false;
let audioEl: HTMLAudioElement | null = null;

// 0.1s of silence, used to unlock audio playback inside the user's tap.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

export function markNativeBroken() {
  nativeBroken = true;
}

export function hasNativeSpeech() {
  return !nativeBroken && typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Resolves true when the device voice is available and has at least one voice. */
export function nativeSpeechReady(timeout = 1200): Promise<boolean> {
  if (!hasNativeSpeech()) return Promise.resolve(false);
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener?.("voiceschanged", done);
      resolve(!nativeBroken && synth.getVoices().length > 0);
    };
    synth.addEventListener?.("voiceschanged", done);
    window.setTimeout(done, timeout);
  });
}

export function sharedAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
  }
  return audioEl;
}

/** Must be called synchronously inside a click/tap handler. */
export function unlockAudio() {
  const a = sharedAudio();
  if (a.dataset.unlocked) return;
  a.dataset.unlocked = "1";
  a.src = SILENT_WAV;
  a.play().catch(() => {
    delete a.dataset.unlocked;
  });
}

const blobCache = new Map<string, Promise<string>>();

/** Fetch a clip once and keep it as a local blob URL (instant replay, no network). */
export function cachedClip(key: string, getUrl: () => Promise<string>): Promise<string> {
  let p = blobCache.get(key);
  if (!p) {
    p = (async () => {
      const url = await getUrl();
      const res = await fetch(url);
      if (!res.ok) throw new Error("Audio indisponible");
      return URL.createObjectURL(await res.blob());
    })();
    p.catch(() => blobCache.delete(key));
    blobCache.set(key, p);
  }
  return p;
}
