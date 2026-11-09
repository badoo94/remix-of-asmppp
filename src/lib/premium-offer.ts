import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TIMER_COLORS = ["#F5B53D", "#F08A2E", "#E5482F", "#C21F1F"] as const;
export type DayPrice = { day: number; amount: number };

export const dayPricesQuery = queryOptions({
  queryKey: ["day_prices"],
  queryFn: async (): Promise<DayPrice[]> => {
    const { data, error } = await supabase.from("day_prices").select("day, amount").order("day");
    if (error) throw error;
    return (data ?? []).map((r) => ({ day: r.day, amount: Number(r.amount) }));
  },
});

/** Day number (1-based) since `start`, clamped to [1, totalDays]. */
export function dayFromStart(start: Date, totalDays: number, now: Date = new Date()): number {
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.min(Math.max(1, totalDays), Math.max(1, days));
}

/** The amount the user must pay today: the rule for the current day, or the last rule reached. */
export function priceForDay(prices: DayPrice[], day: number): number {
  const sorted = [...prices].sort((a, b) => a.day - b.day);
  let amount = sorted[0]?.amount ?? 0;
  for (const p of sorted) if (p.day <= day) amount = p.amount;
  return amount;
}

export function splitElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function formatMoney(n: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
