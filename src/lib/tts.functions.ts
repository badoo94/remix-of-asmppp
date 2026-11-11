import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { words } from "@/components/exercises/apex-data";

type Voice = "female" | "male";
type Lang = "fr" | "en";

const isVoice = (v: unknown): v is Voice => v === "female" || v === "male";
const isLang = (v: unknown): v is Lang => v === "fr" || v === "en";

/** Exercise cues ("CONTRACTER & TENIR"…). Public, but only the fixed cue words can be spoken. */
export const getExerciseClip = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string; lang: Lang }) => {
    if (!isLang(input.lang)) throw new Error("Langue invalide");
    const allowed = Object.values(words[input.lang]) as string[];
    if (!allowed.includes(input.text)) throw new Error("Texte non autorisé");
    return input;
  })
  .handler(async ({ data }) => {
    const { speechClipUrl } = await import("./tts.server");
    return { url: await speechClipUrl(data.text.toLocaleLowerCase(data.lang), "female", data.lang) };
  });

/** One sentence of a method page, read aloud for premium members. */
export const getMethodClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; voice: Voice }) => {
    if (typeof input.text !== "string" || !input.text.trim()) throw new Error("Texte vide");
    if (input.text.length > 800) throw new Error("Texte trop long");
    if (!isVoice(input.voice)) throw new Error("Voix invalide");
    return input;
  })
  .handler(async ({ data, context }) => {
    const [{ data: premium }, { data: admin }] = await Promise.all([
      context.supabase.rpc("is_premium", { _user_id: context.userId }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (!premium && !admin) throw new Error("Lecture audio réservée aux membres premium");
    const { speechClipUrl } = await import("./tts.server");
    return { url: await speechClipUrl(data.text.trim(), data.voice, "fr") };
  });
