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

/** Group PDF pages into chunks small enough for one AI call. */
export function chunkPages(pages: string[], maxChars = 12_000): string[] {
  const chunks: string[] = [];
  let buf = "";
  for (const p of pages) {
    if (buf && buf.length + p.length > maxChars) {
      chunks.push(buf);
      buf = "";
    }
    if (p.length > maxChars) {
      for (let i = 0; i < p.length; i += maxChars) chunks.push(p.slice(i, i + maxChars));
      continue;
    }
    buf += (buf ? "\n\n" : "") + p;
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}
