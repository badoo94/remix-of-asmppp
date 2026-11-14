import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

/**
 * Cards a visitor closed with their button: never shown to them again.
 * Kept in this browser for everyone, and in the account for signed-in users (follows them on any device).
 */
const KEY = "asm-dismissed-cards";
const EMPTY: ReadonlySet<string> = new Set();
let ids: ReadonlySet<string> = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(raw)) ids = new Set(raw.filter((x) => typeof x === "string"));
  } catch {
    /* ignore corrupt storage */
  }
}

function update(add: string[]) {
  load();
  const next = new Set(ids);
  add.forEach((id) => next.add(id));
  if (next.size === ids.size) return;
  ids = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDismissedCards() {
  const { user } = useSession();
  const dismissed = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return ids;
    },
    () => EMPTY,
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("dismissed_cards")
      .select("card_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (active && data) update(data.map((r) => r.card_id));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const dismiss = (cardId: string) => {
    update([cardId]);
    if (user) void supabase.from("dismissed_cards").upsert({ user_id: user.id, card_id: cardId }).then(() => undefined);
  };

  return { dismissed, dismiss };
}
