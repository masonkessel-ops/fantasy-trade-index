/**
 * Reads a roster screenshot in the browser (free, no AI, nothing uploaded) and
 * returns its text, one line per row, for lib/rosterMatch to find the players.
 *
 * 1. The whole picture, cleaned up (grayscale, dark mode flipped, more contrast).
 * 2. Lineup-slot tags drawn as colored pills (Yahoo's blue "QB", "BN", "W/R/T"…)
 *    can't be read that way, so each pill is found by its solid color, cut out,
 *    and read on its own; its slot is then added to the start of the row it sits on.
 */
import type { Worker } from "tesseract.js";

type Progress = (p: { pct: number; label: string }) => void;
interface TextLine {
  text: string;
  y0: number;
  y1: number;
  x0: number;
}
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/* ============================== KNOBS ==================================== */

/** A pixel this colorful (max - min channel) counts as part of a colored tag. */
const COLOR_MIN = 90;
/** Tags only appear in the left part of roster pages. */
const TAG_REGION = 0.45;

export async function readScreenshot(file: File, onProgress: Progress): Promise<string> {
  const img = await loadImage(file);
  // Small screenshots read better enlarged; huge ones are capped to stay fast.
  const scale = Math.min(2, Math.max(1, 1600 / img.width), 4000 / Math.max(img.width, img.height));
  const W = Math.round(img.width * scale);
  const H = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const color = ctx.getImageData(0, 0, W, H).data.slice(); // keep the original colors for finding tags

  onProgress({ pct: 0, label: "Getting the photo reader ready…" });
  const { createWorker } = await import("tesseract.js");
  let stage = "Reading your roster…";
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress({ pct: m.progress, label: stage });
      else if (m.status.startsWith("loading")) onProgress({ pct: 0, label: "Getting the photo reader ready (first time takes a few seconds)…" });
    },
  });
  try {
    const lines = await readLines(worker, cleanUp(ctx, W, H), scale);
    const pills = findPills(color, W, H, scale);
    if (pills.length >= 3) {
      stage = "Reading lineup spots…";
      await worker.setParameters({ tessedit_pageseg_mode: "7" as never, tessedit_char_whitelist: "QBRWTEFLXKDNIS/P" });
      for (const box of pills) {
        const image = pillImage(color, W, box);
        let slot = slotFromTag((await worker.recognize(image)).data.text);
        if (!slot) {
          // One-letter tags ("K") read better in single-character mode.
          await worker.setParameters({ tessedit_pageseg_mode: "10" as never });
          slot = slotFromTag((await worker.recognize(image)).data.text);
          await worker.setParameters({ tessedit_pageseg_mode: "7" as never });
        }
        if (slot) attach(lines, slot, box);
      }
    }
    return lines
      .sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0)
      .map((l) => l.text)
      .join("\n");
  } finally {
    await worker.terminate();
  }
}

function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("That file isn't an image."));
    i.src = url;
  }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 0));
}

/** Grayscale, dark-mode screenshots flipped to dark-on-light, and boosted contrast. */
function cleanUp(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = y;
    sum += y;
  }
  const dark = sum / (px.length / 4) < 128;
  for (let i = 0; i < px.length; i += 4) {
    let y = dark ? 255 - px[i] : px[i];
    y = Math.max(0, Math.min(255, (y - 128) * 1.5 + 128));
    px[i] = px[i + 1] = px[i + 2] = y;
  }
  ctx.putImageData(data, 0, 0);
  return ctx.canvas;
}

async function readLines(worker: Worker, canvas: HTMLCanvasElement, scale: number): Promise<TextLine[]> {
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
  const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  if (!lines.length) return data.text.split("\n").map((text, i) => ({ text, y0: i * 20 * scale, y1: i * 20 * scale + 10, x0: 0 }));
  return lines.map((l) => ({ text: l.text.trim(), y0: l.bbox.y0, y1: l.bbox.y1, x0: l.bbox.x0 }));
}

/** Solid colored, pill-sized shapes in the left part of the picture. */
function findPills(px: Uint8ClampedArray, W: number, H: number, scale: number): Box[] {
  const colorful = (i: number) => Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) > COLOR_MIN;
  const maxGap = Math.round(14 * scale);
  const minW = Math.round(16 * scale);
  const boxes: Box[] = [];
  let open: Box[] = [];
  for (let y = 0; y < H; y++) {
    // Runs of mostly-colored pixels in this row (letters inside a pill leave small gaps).
    const spans: [number, number][] = [];
    let start = -1;
    let last = -1;
    let count = 0;
    const flush = () => {
      if (start >= 0 && last - start + 1 >= minW && count / (last - start + 1) > 0.5) spans.push([start, last]);
      start = last = -1;
      count = 0;
    };
    for (let x = 0; x < W * TAG_REGION; x++) {
      if (!colorful((y * W + x) * 4)) continue;
      if (start < 0 || x - last > maxGap) {
        flush();
        start = x;
      }
      last = x;
      count++;
    }
    flush();
    // Stack overlapping runs from neighboring rows into boxes.
    const next: Box[] = [];
    for (const [a, b] of spans) {
      const box = open.find((o) => o.y1 >= y - 2 && Math.min(o.x1, b) - Math.max(o.x0, a) > 0.5 * Math.min(o.x1 - o.x0, b - a));
      if (box) {
        box.x0 = Math.min(box.x0, a);
        box.x1 = Math.max(box.x1, b);
        box.y1 = y;
        if (!next.includes(box)) next.push(box);
      } else {
        const nb = { x0: a, x1: b, y0: y, y1: y };
        boxes.push(nb);
        next.push(nb);
      }
    }
    open = [...next, ...open.filter((o) => o.y1 >= y - 2 && !next.includes(o))];
  }
  return boxes.filter((b) => {
    const w = b.x1 - b.x0 + 1;
    const h = b.y1 - b.y0 + 1;
    return h >= 10 * scale && h <= 60 * scale && w <= 170 * scale && w / h <= 7;
  });
}

/** The letters inside a pill, black on white and enlarged, with the rounded edges trimmed off. */
function pillImage(px: Uint8ClampedArray, W: number, b: Box) {
  const h0 = b.y1 - b.y0 + 1;
  const iy = Math.max(2, Math.round(h0 * 0.18));
  const ix = Math.round(h0 * 0.45);
  const x0 = b.x0 + ix;
  const y0 = b.y0 + iy;
  const bw = Math.max(1, b.x1 - ix - x0 + 1);
  const bh = Math.max(1, b.y1 - iy - y0 + 1);
  const colorful = (i: number) => Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) > COLOR_MIN;
  // The tag's own color, and whether its letters are light (Yahoo's white on blue) or dark.
  const bg = [0, 0, 0];
  let n = 0;
  for (let y = y0; y < y0 + bh; y++)
    for (let x = x0; x < x0 + bw; x++) {
      const i = (y * W + x) * 4;
      if (!colorful(i)) continue;
      bg[0] += px[i];
      bg[1] += px[i + 1];
      bg[2] += px[i + 2];
      n++;
    }
  if (n) for (let j = 0; j < 3; j++) bg[j] /= n;
  const ink = (bg[0] + bg[1] + bg[2]) / 3 < 170 ? [255, 255, 255] : [0, 0, 0];
  // A pixel is part of a letter if it's closer to the letter color than to the tag color,
  // which keeps thin, soft-edged letters like "K" whole.
  const dist = (i: number, t: number[]) => (px[i] - t[0]) ** 2 + (px[i + 1] - t[1]) ** 2 + (px[i + 2] - t[2]) ** 2;

  const k = 3;
  const pad = 16;
  const c = document.createElement("canvas");
  c.width = bw * k + pad * 2;
  c.height = bh * k + pad * 2;
  const ctx = c.getContext("2d")!;
  const out = ctx.createImageData(c.width, c.height);
  out.data.fill(255);
  for (let y = 0; y < bh * k; y++)
    for (let x = 0; x < bw * k; x++) {
      const i = ((y0 + Math.floor(y / k)) * W + x0 + Math.floor(x / k)) * 4;
      if (dist(i, ink) >= dist(i, bg)) continue;
      const o = ((y + pad) * c.width + x + pad) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = 0;
    }
  ctx.putImageData(out, 0, 0);
  return c;
}

/** What a tag says -> a slot label the roster matcher understands (tolerating common misreads). */
export function slotFromTag(raw: string): string | null {
  const t = raw.toUpperCase().replace(/[^A-Z/]/g, "");
  const flat = t.replace(/\//g, "");
  if (!flat) return null;
  if (/^(QB|OB|DB)$/.test(t)) return "QB";
  if (/^(RB|RE|R8|PB|KB|K8|RR8)$/.test(t)) return "RB";
  if (/^(WR|WK|WP|VR)$/.test(t)) return "WR";
  if (/^(TE|TT|TF|STE|IE)$/.test(t)) return "TE";
  if (/^(SF|SFLEX|SUPERFLEX|OP)$/.test(flat) || (/^[QO]WI?RI?T$/.test(flat))) return "Q/W/R/T";
  if (/^WI?RI?TE?$/.test(flat) || flat === "FLEX" || flat === "FLX") return "W/R/T";
  if (/^WI?R$/.test(flat) && t.includes("/")) return "W/R";
  if (/^WI?T$/.test(flat)) return "W/T";
  if (/^(K|PK)$/.test(flat)) return "K";
  if (/^(DEF|DEE|DST|DIST|DS)$/.test(flat)) return "DEF";
  if (/^(S?BN|BE|BENCH)$/.test(flat)) return "BN";
  if (/^(IR|RR|LR|IK|IRP)$/.test(flat)) return "IR";
  return null;
}

/** Put the slot at the start of the row the tag sits on (or its own line if no row lines up). */
function attach(lines: TextLine[], slot: string, box: Box) {
  const mid = (box.y0 + box.y1) / 2;
  const h = box.y1 - box.y0 + 1;
  let best: TextLine | null = null;
  for (const l of lines) {
    const d = Math.abs((l.y0 + l.y1) / 2 - mid);
    if (d <= h && (!best || d < Math.abs((best.y0 + best.y1) / 2 - mid))) best = l;
  }
  if (best) best.text = `${slot} ${best.text}`;
  else lines.push({ text: slot, y0: box.y0, y1: box.y1, x0: box.x0 });
}
