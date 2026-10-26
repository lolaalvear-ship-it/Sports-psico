import { clamp, rng, smooth, window01 } from './math';
import type { VisualStyle } from './styles';

export const FONT = 'system-ui, Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export interface Ctx2 {
  c: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** unidad: 1 px de un lienzo de 1080 de lado corto */
  u: number;
  style: VisualStyle;
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function drawBackground({ c, W, H, style }: Ctx2) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, style.bgTop);
  g.addColorStop(1, style.bgBottom);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const rg = c.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.6);
  rg.addColorStop(0, style.primary + '1c');
  rg.addColorStop(1, style.primary + '00');
  c.fillStyle = rg;
  c.fillRect(0, 0, W, H);
}

/** Título: grande y centrado en escenas de título; encabezado superior en las demás. */
export function drawTitle(x: Ctx2, title: string, subtitle: string | undefined, lt: number, dur: number, hero: boolean) {
  const { c, W, H, u, style } = x;
  if (!title) return;
  const a = window01(lt, hero ? 0.3 : 0.4, dur, 0.6);
  if (a <= 0) return;
  const portrait = H > W;
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const size = hero ? (portrait ? 78 : 70) * u : (portrait ? 50 : 44) * u;
  c.font = `700 ${size}px ${FONT}`;
  const maxW = W * (portrait ? 0.84 : 0.7);
  const lines = wrap(c, title, maxW);
  const lh = size * 1.18;
  const rise = (1 - smooth(0, 1, (lt - 0.3) / 0.9)) * 30 * u;
  let y = hero ? H * 0.44 - ((lines.length - 1) * lh) / 2 : H * (portrait ? 0.13 : 0.14);
  c.globalAlpha = a;
  c.shadowColor = style.secondary;
  c.shadowBlur = 28 * u * style.glow;
  c.fillStyle = style.text;
  for (const l of lines) { c.fillText(l, W / 2, y + rise); y += lh; }
  c.shadowBlur = 0;
  if (hero) {
    // línea decorativa que se extiende
    const lw = W * 0.22 * smooth(0.6, 1.6, lt);
    c.strokeStyle = style.accent;
    c.lineWidth = 3 * u;
    c.beginPath();
    c.moveTo(W / 2 - lw, y - lh * 0.55 + rise);
    c.lineTo(W / 2 + lw, y - lh * 0.55 + rise);
    c.stroke();
    if (subtitle) {
      c.globalAlpha = a * smooth(0.9, 1.7, lt);
      c.font = `500 ${size * 0.42}px ${FONT}`;
      c.fillStyle = style.textDim;
      let sy = y + size * 0.2;
      for (const l of wrap(c, subtitle, maxW)) { c.fillText(l, W / 2, sy); sy += size * 0.56; }
    }
  }
  c.restore();
}

/** Texto científico breve, abajo, con las palabras apareciendo en secuencia. */
export function drawCaption(x: Ctx2, text: string, lt: number, dur: number) {
  const { c, W, H, u, style } = x;
  if (!text) return;
  const a = window01(lt, 0.7, dur, 0.5);
  if (a <= 0) return;
  const portrait = H > W;
  c.save();
  const size = (portrait ? 40 : 36) * u;
  c.font = `500 ${size}px ${FONT}`;
  const maxW = W * (portrait ? 0.82 : 0.62);
  const lines = wrap(c, text, maxW);
  const lh = size * 1.32;
  const boxH = lines.length * lh + size * 1.0;
  const top = H * (portrait ? 0.7 : 0.74) - boxH / 2;
  const boxW = Math.min(maxW + size * 1.6, W * 0.94);
  c.globalAlpha = a * 0.72;
  c.fillStyle = 'rgba(2,4,10,0.72)';
  roundRect(c, (W - boxW) / 2, top, boxW, boxH, 18 * u);
  c.fill();
  c.globalAlpha = a;
  c.fillStyle = style.accent;
  c.fillRect((W - boxW) / 2, top + 14 * u, 5 * u, boxH - 28 * u);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let wi = 0;
  lines.forEach((line, li) => {
    const words = line.split(' ');
    const total = c.measureText(line).width;
    let cx = W / 2 - total / 2;
    for (const w of words) {
      const wa = smooth(0.7 + wi * 0.06, 1.0 + wi * 0.06, lt);
      c.globalAlpha = a * wa;
      c.fillStyle = style.text;
      c.textAlign = 'left';
      c.fillText(w, cx, top + size * 0.5 + lh * (li + 0.5));
      cx += c.measureText(w + ' ').width;
      wi++;
    }
  });
  c.restore();
}

export interface ScreenLabel { x: number; y: number; text: string; color?: string; visible: boolean }

/** Etiquetas con línea guía hacia el punto 3D. */
export function drawLabels(x: Ctx2, labels: ScreenLabel[], lt: number, dur: number) {
  const { c, W, H, u, style } = x;
  const size = (H > W ? 28 : 26) * u;
  c.save();
  c.font = `600 ${size}px ${FONT}`;
  const placed: { y0: number; y1: number; side: number }[] = [];
  const order = labels.map((l, i) => ({ l, i })).filter((o) => o.l.visible).sort((a, b) => a.l.y - b.l.y);
  for (const { l, i } of order) {
    const a = window01(lt, 1.0 + i * 0.35, dur, 0.4);
    if (a <= 0) continue;
    const side = l.x < W / 2 ? -1 : 1;
    const tw = c.measureText(l.text).width;
    let ly = clamp(l.y - 70 * u, H * 0.2, H * 0.62);
    for (const p of placed) if (p.side === side && ly < p.y1 + 8 * u && ly + size * 1.6 > p.y0) ly = p.y1 + 8 * u;
    const lx = side < 0 ? Math.max(24 * u, Math.min(l.x - 60 * u - tw, l.x - 120 * u - tw)) : Math.min(W - 24 * u - tw - 28 * u, l.x + 120 * u);
    const bx = side < 0 ? lx - 14 * u : lx - 14 * u;
    placed.push({ y0: ly, y1: ly + size * 1.6, side });
    const col = l.color ?? style.secondary;
    const k = smooth(0, 1, a);
    // punto y línea guía
    c.globalAlpha = a;
    c.fillStyle = col;
    c.beginPath(); c.arc(l.x, l.y, 6 * u, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col;
    c.lineWidth = 2 * u;
    const ex = side < 0 ? bx + tw + 28 * u : bx;
    const ey = ly + size * 0.8;
    c.beginPath();
    c.moveTo(l.x, l.y);
    c.lineTo(l.x + (ex - l.x) * k, l.y + (ey - l.y) * k);
    c.stroke();
    c.globalAlpha = a * 0.85;
    c.fillStyle = 'rgba(3,6,14,0.8)';
    roundRect(c, bx, ly, tw + 28 * u, size * 1.6, 10 * u);
    c.fill();
    c.globalAlpha = a;
    c.strokeStyle = col + 'aa';
    c.lineWidth = 1.5 * u;
    c.stroke();
    c.fillStyle = style.text;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText(l.text, bx + 14 * u, ly + size * 0.82);
  }
  c.restore();
}

export function drawLegend(x: Ctx2, items: { color: string; text: string }[], lt: number, dur: number) {
  const { c, W, H, u, style } = x;
  if (!items.length) return;
  const a = window01(lt, 1.6, dur, 0.5);
  if (a <= 0) return;
  const size = 24 * u;
  c.save();
  c.font = `500 ${size}px ${FONT}`;
  let y = H * (H > W ? 0.205 : 0.25);
  const x0 = 40 * u;
  for (const it of items) {
    c.globalAlpha = a;
    c.fillStyle = it.color;
    c.beginPath(); c.arc(x0 + 8 * u, y, 8 * u, 0, Math.PI * 2); c.fill();
    c.fillStyle = style.textDim;
    c.textBaseline = 'middle';
    c.fillText(it.text, x0 + 26 * u, y);
    y += size * 1.45;
  }
  c.restore();
}

export function drawBadge(x: Ctx2, text: string, a: number) {
  const { c, W, u, style } = x;
  if (a <= 0) return;
  c.save();
  const size = 22 * u;
  c.font = `600 ${size}px ${FONT}`;
  const tw = c.measureText(text).width;
  const bx = W - tw - 64 * u, by = 40 * u;
  c.globalAlpha = a * 0.9;
  c.fillStyle = 'rgba(3,6,14,0.7)';
  roundRect(c, bx, by, tw + 30 * u, size * 1.7, size * 0.85);
  c.fill();
  c.strokeStyle = style.textDim + '88';
  c.lineWidth = 1.5 * u;
  c.stroke();
  c.fillStyle = style.textDim;
  c.textBaseline = 'middle';
  c.fillText(text, bx + 15 * u, by + size * 0.88);
  c.restore();
}

export function drawFooter(x: Ctx2, text: string, a: number) {
  const { c, W, H, u, style } = x;
  if (!text || a <= 0) return;
  c.save();
  const size = 22 * u;
  c.font = `400 ${size}px ${FONT}`;
  c.globalAlpha = a * 0.85;
  c.fillStyle = style.textDim;
  c.textAlign = 'center';
  let y = H * (H > W ? 0.86 : 0.9);
  for (const l of wrap(c, text, W * 0.86)) { c.fillText(l, W / 2, y); y += size * 1.35; }
  c.restore();
}

let grainTiles: HTMLCanvasElement[] = [];
/** Viñeta, grano de película y líneas de escaneo. El grano depende del número de fotograma. */
export function drawPost(x: Ctx2, frame: number) {
  const { c, W, H, u, style } = x;
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${style.vignette})`);
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
  if (style.scanlines) {
    c.save();
    c.globalAlpha = 0.07;
    c.fillStyle = '#000';
    for (let y = (frame * 2) % (6 * u); y < H; y += 6 * u) c.fillRect(0, y, W, 2 * u);
    c.restore();
  }
  if (style.grain > 0) {
    if (!grainTiles.length) {
      const r = rng(5);
      grainTiles = Array.from({ length: 6 }, () => {
        const g = document.createElement('canvas');
        g.width = g.height = 256;
        const gc = g.getContext('2d')!;
        const img = gc.createImageData(256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = r() * 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        gc.putImageData(img, 0, 0);
        return g;
      });
    }
    c.save();
    c.globalAlpha = style.grain;
    c.globalCompositeOperation = 'overlay';
    const pat = c.createPattern(grainTiles[frame % grainTiles.length], 'repeat')!;
    c.fillStyle = pat;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
}

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
