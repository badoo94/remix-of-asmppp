import { describe, expect, it } from "vitest";
import { chunkPages } from "@/lib/pdf-text";

describe("chunkPages", () => {
  const para = "Une phrase du livre qui doit rester mot pour mot. ";
  const pages = [para.repeat(200), "Courte page.", para.repeat(30)];

  it("keeps every AI part at 4500 characters or less", () => {
    for (const c of chunkPages(pages)) expect(c.length).toBeLessThanOrEqual(4500);
  });

  it("loses no words of the PDF", () => {
    const words = (s: string) => s.split(/\s+/).filter(Boolean);
    expect(words(chunkPages(pages).join(" "))).toEqual(words(pages.join(" ")));
  });
});
