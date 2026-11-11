/** Extract text page by page from a PDF in the browser (pdf.js). */
export async function extractPdfPages(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) text += "\n";
      text += item.str;
      if (item.hasEOL) text += "\n";
      lastY = y;
    }
    pages.push(text.replace(/\n{3,}/g, "\n\n").trim());
  }
  return pages;
}

/** Split text into pieces of at most `max` chars, cutting at paragraph, line or sentence ends. */
function splitText(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const win = rest.slice(0, max);
    let cut = win.lastIndexOf("\n\n");
    if (cut < max * 0.5) cut = win.lastIndexOf("\n");
    if (cut < max * 0.5) cut = Math.max(win.lastIndexOf(". "), win.lastIndexOf("! "), win.lastIndexOf("? ")) + 1;
    if (cut < max * 0.5) cut = win.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Group PDF pages into chunks small enough for one quick AI call
 * (long calls get cut by the network before the AI answers).
 */
export function chunkPages(pages: string[], maxChars = 4_500): string[] {
  const chunks: string[] = [];
  let buf = "";
  for (const p of pages.flatMap((x) => splitText(x, maxChars))) {
    if (buf && buf.length + p.length + 2 > maxChars) {
      chunks.push(buf);
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + p;
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}
