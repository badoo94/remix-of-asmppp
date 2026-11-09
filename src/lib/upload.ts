import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-");
}

/** Upload a public media file (images/videos of the method) and return a long-lived URL. */
export async function uploadMedia(file: File): Promise<string> {
  const path = `${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (signErr || !data) throw signErr ?? new Error("URL indisponible");
  return data.signedUrl;
}

/** Upload a premium-only file; returns its storage path (signed at view time). */
export async function uploadPremiumFile(file: File): Promise<string> {
  const path = `${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from("premium").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedPremiumUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("premium").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
