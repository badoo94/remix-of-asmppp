import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateChatCompletion, GatewayError } from "@lovable.dev/ai-gateway";
import { mergeAdminConfig } from "./settings";

export interface AiPage {
  type: string;
  partie: string;
  chapitre: string;
  titre: string;
  sousChapitre: string;
  body: string;
}

const PAGE_TYPES = ["blank", "frame", "chapter", "subchapter", "full"];

function parsePages(raw: string): AiPage[] {
  let txt = raw.trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) txt = fence[1];
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start >= 0 && end > start) txt = txt.slice(start, end + 1);
  const json = JSON.parse(txt) as { pages?: Partial<AiPage>[] };
  return (json.pages ?? []).map((p) => ({
    type: PAGE_TYPES.includes(String(p.type)) ? String(p.type) : "frame",
    partie: String(p.partie ?? ""),
    chapitre: String(p.chapitre ?? ""),
    titre: String(p.titre ?? ""),
    sousChapitre: String(p.sousChapitre ?? ""),
    body: String(p.body ?? ""),
  }));
}

/** Distributes one chunk of PDF text into A4 template pages (admin only). */
export const distributeTextChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; note?: string; part: number; total: number }) => {
    if (typeof input.text !== "string" || input.text.length === 0) throw new Error("Texte vide");
    if (input.text.length > 60_000) throw new Error("Morceau trop long");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Accès réservé à l'administrateur");

    const { data: row } = await context.supabase.from("admin_settings").select("config").eq("id", 1).maybeSingle();
    const cfg = mergeAdminConfig(row?.config);

    const userMsg =
      `Partie ${data.part}/${data.total} du PDF.` +
      (data.note ? `\nConsigne de l'administrateur : ${data.note}` : "") +
      (data.part > 1 ? `\nCette partie suit directement la précédente : si le texte continue un chapitre, commence par une page "frame".` : "") +
      `\n\nTEXTE DU PDF :\n"""\n${data.text}\n"""`;

    let content = "";
    if (cfg.aiProvider === "gemini") {
      if (!cfg.geminiKey) throw new Error("Clé Gemini manquante dans les paramètres");
      const model = cfg.geminiModel || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: cfg.aiInstruction }] },
            contents: [{ role: "user", parts: [{ text: userMsg }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
        },
      );
      const json = (await res.json()) as {
        error?: { message?: string };
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      if (!res.ok) throw new Error(`Gemini : ${json.error?.message ?? res.statusText}`);
      content = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    } else {
      try {
        const completion = await generateChatCompletion({
          model: "google/gemini-3.8-flash",
          messages: [
            { role: "system", content: cfg.aiInstruction },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
        });
        const msg = completion.choices?.[0]?.message?.content;
        content = typeof msg === "string" ? msg : "";
      } catch (e) {
        if (e instanceof GatewayError) {
          if (e.httpStatus === 402) throw new Error("Crédits IA épuisés : ajoutez des crédits à votre espace Lovable.");
          if (e.httpStatus === 429) throw new Error("Trop de requêtes IA, réessayez dans un instant.");
          throw new Error(`IA : ${e.message}`);
        }
        throw e;
      }
    }

    try {
      return { pages: parsePages(content) };
    } catch {
      throw new Error("La réponse de l'IA n'est pas un JSON valide. Réessayez.");
    }
  });
