import { describe, expect, it } from "vitest";
import { dayFromStart, priceForDay, splitElapsed } from "@/lib/premium-offer";

const prices = Array.from({ length: 10 }, (_, i) => ({ day: i + 1, amount: (i + 1) * 5 }));

describe("Prix = Temps", () => {
  it("day 1 on signup day costs 5 €", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    expect(dayFromStart(start, 10, new Date("2026-01-01T22:00:00Z"))).toBe(1);
    expect(priceForDay(prices, 1)).toBe(5);
  });

  it("the price rises to 10 € after one full day on the free plan", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    const day = dayFromStart(start, 10, new Date("2026-01-02T10:00:01Z"));
    expect(day).toBe(2);
    expect(priceForDay(prices, day)).toBe(10);
  });

  it("stays at the last configured price (50 €) after day 10", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const day = dayFromStart(start, 10, new Date("2026-03-01T00:00:00Z"));
    expect(day).toBe(10);
    expect(priceForDay(prices, day)).toBe(50);
  });

  it("formats elapsed time as days/hours/minutes/seconds", () => {
    expect(splitElapsed(((1 * 24 + 2) * 3600 + 3 * 60 + 4) * 1000)).toEqual({ days: 1, hours: 2, minutes: 3, seconds: 4 });
  });
});
