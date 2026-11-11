import { generateSpeech, GatewayError } from "@lovable.dev/ai-gateway";

export type ClipVoice = "female" | "male";
export type ClipLang = "fr" | "en";

const VOICE_NAMES: Record<ClipVoice, string> = { female: "Kore", male: "Charon" };

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns a signed URL to a spoken audio clip of `text`.
 * Clips are generated once with the cloud voice, then cached in the private media bucket.
 */
export async function speechClipUrl(text: string, voice: ClipVoice, lang: ClipLang): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("media");
  const path = `tts/${await sha256(`v1|${voice}|${lang}|${text}`)}.wav`;

  const cached = await bucket.createSignedUrl(path, 60 * 60 * 24);
  if (cached.data?.signedUrl) return cached.data.signedUrl;

  const prompt =
    lang === "fr"
      ? `Lis exactement ce texte en français, d'une voix naturelle et posée :\n${text}`
      : `Read exactly this text in English, in a natural, calm voice:\n${text}`;
  let audio: Blob;
  try {
    const res = await generateSpeech({
      model: "google/gemini-3.1-flash-tts-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAMES[voice] } } },
      },
    });
    audio = await res.blob();
  } catch (e) {
    if (e instanceof GatewayError) {
      if (e.httpStatus === 402) throw new Error("Crédits IA épuisés : la lecture audio est momentanément indisponible.");
      if (e.httpStatus === 429) throw new Error("Trop de demandes de lecture, réessayez dans un instant.");
      throw new Error(`Lecture audio : ${e.message}`);
    }
    throw e;
  }

  const up = await bucket.upload(path, audio, { contentType: "audio/wav", upsert: true });
  if (up.error) throw new Error(`Lecture audio : ${up.error.message}`);
  const signed = await bucket.createSignedUrl(path, 60 * 60 * 24);
  if (!signed.data?.signedUrl) throw new Error("Lecture audio indisponible");
  return signed.data.signedUrl;
}
