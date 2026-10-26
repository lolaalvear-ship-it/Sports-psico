// Motor compartido de los reels: utilidades, texto, efectos 2D, subtítulos, marca y composición.
// Cada reel (reels/<slug>/scenes.js) importa de aquí, define sus escenas en un objeto SC
// y llama a start(SC). Todo se dibuja por código; window.renderFrame(t) devuelve el fotograma t.
import { drawCaptions } from './captions.js';

export const W = 1080, H = 1920;
const out = document.getElementById('out');
const ctx = out.getContext('2d');

// ---------------------------------------------------------------- utilidades
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const TAU = Math.PI * 2;
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// entra (a→a+fi) y sale (b-fo→b)
export const inOut = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));
// marca de tiempo local de una palabra clave (la rellena tools/sync.py a partir de la voz)
export const mark = (s, k, def) => (s && s.marks && s.marks[k] != null ? s.marks[k] : def);

export function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export const PAL = {
  ink: '#04060b',
  cyan: '#5fd3ff',
  violet: '#8a6bff',
  gold: '#ffbf5e',
  rose: '#ff4f7b',
  red: '#ff3b3b',
  green: '#3ad08a',
  white: '#f4f6fb',
};

// marca personal (video/marca.json): se rellena antes de READY
export const BRAND = {
  nombre: '', usuario: '', cierre: '', colores: { primario: PAL.cyan, acento: PAL.gold, fondo: PAL.ink },
  marcaAgua: true, subtitulos: 'karaoke',
};

// sprites de brillo reutilizables (tintados por color)
const glowCache = new Map();
function glowSprite(color, hard = false) {
  const key = color + hard;
  if (glowCache.has(key)) return glowCache.get(key);
  const s = 128, c = offscreen(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  if (hard) { // disco de bokeh: borde definido, centro plano
    gr.addColorStop(0, color); gr.addColorStop(0.78, color);
    gr.addColorStop(0.9, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.9;
  } else {
    gr.addColorStop(0, color); gr.addColorStop(0.25, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
  }
  g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  if (!hard) { // núcleo más caliente
    const g2 = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.18);
    g2.addColorStop(0, 'rgba(255,255,255,0.9)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = g2; g.fillRect(0, 0, s, s);
  }
  glowCache.set(key, c);
  return c;
}
export function glow(c, x, y, r, color, a = 1, hard = false) {
  if (a <= 0.003 || r <= 0.5) return;
  c.save(); c.globalAlpha *= a; c.globalCompositeOperation = 'lighter';
  c.drawImage(glowSprite(color, hard), x - r, y - r, r * 2, r * 2);
  c.restore();
}

// ---------------------------------------------------------------- texto
export function txt(c, s, x, y, o = {}) {
  const {
    size = 64, weight = 700, family = 'Inter Display', color = PAL.white, alpha = 1,
    blur = 0, align = 'center', spacing = 0, glowPx = 0, glowColor = color, italic = false,
  } = o;
  if (alpha <= 0.003) return;
  c.save();
  c.globalAlpha *= alpha;
  c.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${family}"`;
  c.textAlign = align; c.textBaseline = 'middle';
  c.letterSpacing = spacing + 'px';
  if (blur > 0.1) c.filter = `blur(${blur.toFixed(1)}px)`;
  if (glowPx) { c.shadowColor = glowColor; c.shadowBlur = glowPx; }
  c.fillStyle = color;
  c.fillText(s, x, y);
  c.restore();
}
// texto con entrada cinematográfica (desenfoque + tracking + leve subida)
export function title(c, s, x, y, lt, a, b, o = {}) {
  const k = inOut(lt, a, b, o.fi ?? 0.45, o.fo ?? 0.35);
  if (k <= 0) return;
  const e = easeOut(seg(lt, a, a + (o.fi ?? 0.45)));
  txt(c, s, x, y + (1 - e) * 26, {
    ...o, alpha: k * (o.alpha ?? 1), blur: (1 - e) * 14 + (o.blur ?? 0),
    spacing: (o.spacing ?? 0) + (1 - e) * 10,
  });
}
// párrafo centrado con salto de línea automático; devuelve la altura usada
export function wrap(c, s, x, y, maxW, o = {}) {
  const { size = 56, weight = 700, family = 'Inter Display', lh = 1.25 } = o;
  c.save();
  c.font = `${weight} ${size}px "${family}"`;
  const lines = [];
  let cur = '';
  for (const w of s.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  c.restore();
  lines.forEach((ln, i) => txt(c, ln, x, y + i * size * lh, o));
  return lines.length * size * lh;
}
// cita científica pequeña (autor · revista año)
export function cite(c, s, lt, a, b, y = 1440) {
  const k = inOut(lt, a, b, 0.4, 0.3);
  if (k <= 0) return;
  c.save();
  c.globalAlpha = k * 0.85;
  c.font = '500 26px "Inter"';
  c.letterSpacing = '1px';
  const w = c.measureText(s).width + 44;
  c.fillStyle = 'rgba(8,12,22,0.55)';
  roundRect(c, W / 2 - w / 2, y - 24, w, 48, 24); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = 'rgba(230,236,248,0.92)'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(s, W / 2, y + 1);
  c.restore();
}
export function badge(c, text, col, x, y, a) {
  if (a <= 0.01) return;
  c.save(); c.globalAlpha = a;
  c.font = '800 34px "Inter Display"'; c.letterSpacing = '6px';
  const w = c.measureText(text).width + 60;
  roundRect(c, x - w / 2, y - 30, w, 60, 30); c.strokeStyle = col; c.lineWidth = 3; c.stroke();
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x + 3, y + 1);
  c.restore();
}
export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
// etiqueta con línea guía hacia un punto (p. ej. una región del cerebro proyectada)
export function label(c, px, py, ly, text, sub, color, a) {
  if (a <= 0.01) return;
  const up = ly < py, k = easeOut(clamp(a));
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = color; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(px, py); c.lineTo(lerp(px, W / 2, k), lerp(py, ly, k)); c.stroke();
  c.fillStyle = color; c.beginPath(); c.arc(px, py, 7, 0, TAU); c.fill();
  const ty = ly + (up ? -70 : 50);
  txt(c, text, W / 2, ty, { size: 52, weight: 800, color: PAL.white, glowPx: 16, glowColor: color });
  if (sub) txt(c, sub, W / 2, ty + 52, { size: 32, weight: 500, family: 'Inter', color });
  c.restore();
}

// ---------------------------------------------------------------- post: grano, viñeta
const grains = [];
{
  const r = rng(99);
  for (let i = 0; i < 6; i++) {
    const g = offscreen(540, 960), gx = g.getContext('2d'), id = gx.createImageData(540, 960);
    for (let p = 0; p < id.data.length; p += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 120;
      id.data[p] = id.data[p + 1] = id.data[p + 2] = v; id.data[p + 3] = 255;
    }
    gx.putImageData(id, 0, 0);
    grains.push(g);
  }
}
const vignette = (() => {
  const v = offscreen(W, H), g = v.getContext('2d');
  const gr = g.createRadialGradient(W / 2, H * 0.48, H * 0.22, W / 2, H * 0.5, H * 0.72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.78)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return v;
})();
function post(c, t) {
  c.drawImage(vignette, 0, 0);
  c.save();
  c.globalCompositeOperation = 'soft-light';
  c.globalAlpha = 0.32;
  c.drawImage(grains[Math.floor(t * 30) % grains.length], 0, 0, W, H);
  c.restore();
}

// ---------------------------------------------------------------- capas reutilizables 2D
export function bokehField(c, seed, lt, n, colors, o = {}) {
  const r = rng(seed);
  const { yMin = 0, yMax = H, rMin = 20, rMax = 90, alpha = 0.5, drift = 12, hard = true, par = 1 } = o;
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = lerp(yMin, yMax, r()), rad = lerp(rMin, rMax, r() * r());
    const col = colors[Math.floor(r() * colors.length)];
    const ph = r() * TAU, sp = 0.3 + r();
    const xx = x + Math.sin(lt * 0.4 * sp + ph) * drift + lt * 14 * par * (r() - 0.3);
    const yy = y + Math.cos(lt * 0.3 * sp + ph) * drift * 0.6;
    const tw = 0.75 + 0.25 * Math.sin(lt * 1.3 * sp + ph);
    glow(c, xx, yy, rad, col, alpha * tw * (0.4 + 0.6 * r()), hard);
  }
}
export function dust(c, seed, lt, n, color, alpha = 0.6) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, s = 2 + r() * 5, sp = 8 + r() * 26, ph = r() * TAU;
    const yy = (y - lt * sp + H * 10) % H;
    const xx = x + Math.sin(lt * 0.5 + ph) * 18;
    glow(c, xx, yy, s * 3, color, alpha * (0.3 + 0.7 * Math.abs(Math.sin(lt * 0.8 + ph))));
  }
}
export function lightLeak(c, x, y, rx, ry, color, a) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
  c.translate(x, y); c.scale(rx / 100, ry / 100);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 100);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 100, 0, TAU); c.fill();
  c.restore();
}
// fondo liso con degradado vertical
export function backdrop(c, top = '#060912', bottom = '#03040a') {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- siluetas
// perfil (busto) mirando a la derecha; unidad ≈ alto de la cabeza
export const PROFILE = [
  [-0.30, 0.98], [-0.31, 0.72], [-0.40, 0.48], [-0.44, 0.18], [-0.36, -0.14], [-0.16, -0.33],
  [0.10, -0.35], [0.29, -0.24], [0.37, -0.04], [0.40, 0.10], [0.375, 0.17], [0.42, 0.25],
  [0.475, 0.335], [0.47, 0.36], [0.405, 0.385], [0.42, 0.44], [0.405, 0.475], [0.39, 0.50],
  [0.405, 0.535], [0.375, 0.58], [0.365, 0.62], [0.375, 0.67], [0.33, 0.73], [0.22, 0.77],
  [0.12, 0.82], [0.11, 1.0], [0.22, 1.14], [0.52, 1.30], [0.66, 1.9], [-0.95, 1.9], [-0.85, 1.36],
  [-0.48, 1.12],
];
export function smoothPath(c, pts, x, y, s) {
  const n = pts.length, P = i => pts[(i + n) % n];
  c.beginPath();
  const m0 = [(P(-1)[0] + P(0)[0]) / 2, (P(-1)[1] + P(0)[1]) / 2];
  c.moveTo(x + m0[0] * s, y + m0[1] * s);
  for (let i = 0; i < n; i++) {
    const p = P(i), q = P(i + 1);
    c.quadraticCurveTo(x + p[0] * s, y + p[1] * s, x + (p[0] + q[0]) / 2 * s, y + (p[1] + q[1]) / 2 * s);
  }
  c.closePath();
}
// silueta con luz de contorno (rim light) del lado de la fuente (dx,dy apuntan hacia la luz)
export function rimSilhouette(c, pts, x, y, s, rim, dx, dy, body = '#020306', soft = 10, rimA = 1) {
  c.save();
  smoothPath(c, pts, x, y, s);
  c.clip();
  c.globalAlpha = rimA;
  c.fillStyle = rim; c.fillRect(0, 0, W, H);
  c.globalAlpha = 1;
  c.filter = `blur(${soft}px)`;
  c.fillStyle = body;
  smoothPath(c, pts, x - dx, y - dy, s);
  c.fill();
  c.restore();
}
// cuerpo entero de perfil (mirando a la derecha); unidad = altura, origen = pies
export const BODY = [[-0.02, -0.865], [0.045, -0.865], [0.075, -0.82], [0.09, -0.7], [0.075, -0.56], [0.075, -0.46], [0.055, -0.28],
  [0.045, -0.1], [0.11, -0.012], [0.11, 0], [-0.06, 0], [-0.07, -0.12], [-0.06, -0.27], [-0.09, -0.45], [-0.075, -0.52],
  [-0.09, -0.62], [-0.085, -0.8]];
export function drawBody(c, x, y, h, fill, rim, a = 1, armOut = true) {
  c.save(); c.globalAlpha = a;
  c.translate(x, y);
  if (rim) { c.shadowColor = rim; c.shadowBlur = 30; }
  c.fillStyle = fill;
  smoothPath(c, BODY, 0, 0, h); c.fill();
  c.beginPath(); c.arc(0.02 * h, -0.93 * h, 0.066 * h, 0, TAU); c.fill();
  c.strokeStyle = fill; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 0.045 * h;
  c.beginPath(); c.moveTo(0.0, -0.8 * h);
  if (armOut) { c.lineTo(0.12 * h, -0.64 * h); c.lineTo(0.27 * h, -0.63 * h); } else { c.lineTo(0.02 * h, -0.6 * h); c.lineTo(0.05 * h, -0.45 * h); }
  c.stroke();
  c.restore();
}
// par de ojos: look = -1 (izquierda) … 0 (te mira) … 1 (derecha)
export function drawEyes(c, cx, cy, s, look, open = 1, glowCol = '#ff3a4a', a = 1) {
  if (a <= 0.01) return;
  c.save(); c.globalAlpha = a;
  for (const side of [-1, 1]) {
    const ex = cx + side * s * 0.95;
    c.save(); c.translate(ex, cy);
    c.beginPath();
    c.moveTo(-s * 0.62, 0);
    c.quadraticCurveTo(0, -s * 0.5 * open, s * 0.62, 0);
    c.quadraticCurveTo(0, s * 0.42 * open, -s * 0.62, 0);
    c.closePath();
    c.save(); c.clip();
    const sg = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.7);
    sg.addColorStop(0, 'rgba(200,205,220,0.85)'); sg.addColorStop(1, 'rgba(60,64,80,0.9)');
    c.fillStyle = sg; c.fillRect(-s, -s, 2 * s, 2 * s);
    const ix = look * s * 0.32;
    const ig = c.createRadialGradient(ix, 0, 0, ix, 0, s * 0.3);
    ig.addColorStop(0, '#2a1a10'); ig.addColorStop(0.55, '#5a3a20'); ig.addColorStop(1, '#120a06');
    c.fillStyle = ig; c.beginPath(); c.arc(ix, 0, s * 0.29, 0, TAU); c.fill();
    c.fillStyle = '#020102'; c.beginPath(); c.arc(ix, 0, s * 0.12, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(ix - s * 0.08, -s * 0.08, s * 0.05, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(10,8,12,0.9)'; c.lineWidth = s * 0.06; c.stroke();
    c.restore();
  }
  c.restore();
  glow(c, cx, cy, s * 3, glowCol, 0.18 * a * (1 - Math.abs(look)));
}
// puntos al azar dentro de una forma dibujada (para nubes de partículas con forma)
export function sampleShape(drawFn, w, h, n, seed) {
  const c = offscreen(w, h), g = c.getContext('2d');
  drawFn(g);
  const d = g.getImageData(0, 0, w, h).data, r = rng(seed), pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < n * 200) {
    const x = Math.floor(r() * w), y = Math.floor(r() * h);
    if (d[(y * w + x) * 4 + 3] > 128) pts.push([x / w - 0.5, y / h - 0.5]);
  }
  return pts;
}

// ---------------------------------------------------------------- marca de agua
function watermark(c) {
  if (!BRAND.marcaAgua || !BRAND.usuario) return;
  c.save();
  c.globalAlpha = 0.5;
  c.font = '600 30px "Inter"'; c.letterSpacing = '1px';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#ffffff';
  c.fillText(BRAND.usuario, W / 2, 1800);
  c.restore();
}

// ---------------------------------------------------------------- composición
// Opciones de start():
//   noCaps:  ids de escenas cuya tipografía ya dice la frase (no se dibujan subtítulos encima)
//   ready:   async () => {} que se ejecuta tras cargar fuentes (p. ej. para muestrear texto)
// Variantes: si la URL trae ?open=B y existe SC['<id>_B'], se usa en lugar de SC['<id>'] (o SC['<id>_A']).
// Cámara: cada escena hace un leve acercamiento salvo que tenga "camera": "none" en timeline.json.
const TR = 0.22; // media duración del fundido cruzado
export function start(SC, opts = {}) {
  const noCaps = new Set(opts.noCaps || []);
  const variant = new URLSearchParams(location.search).get('open');
  const layer = offscreen(W, H), layerCtx = layer.getContext('2d');
  let TL = null;
  const pick = s => {
    const v = variant || TL.opening || 'A';
    const fn = SC[`${s.id}_${v}`] || SC[s.id] || SC[`${s.id}_A`];
    if (!fn) throw new Error(`Falta la escena «${s.id}» en scenes.js`);
    return fn;
  };
  const draw = (c, s, t) => {
    const d = s.end - s.start, lt = t - s.start;
    c.save();
    if ((s.camera ?? TL.camera ?? 'push') === 'push') {
      const k = 1 + 0.035 * easeIO(clamp(lt / Math.max(d, 0.1)));
      c.translate(W / 2, H * 0.45); c.scale(k, k); c.translate(-W / 2, -H * 0.45);
    }
    pick(s)(c, lt, d, s);
    c.restore();
  };
  window.renderFrame = async (t, type = 'image/jpeg') => {
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    TL.scenes.forEach((s, i) => {
      if (t < s.start - TR || t > s.end + TR) return;
      const a = i === 0 ? 1 : clamp((t - (s.start - TR)) / (2 * TR));
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = 1;
      if (a < 1) {
        // dibuja en capa aparte para fundir sin acumular alfas internos
        layerCtx.globalAlpha = 1; layerCtx.filter = 'none'; layerCtx.globalCompositeOperation = 'source-over';
        layerCtx.clearRect(0, 0, W, H);
        draw(layerCtx, s, t);
        ctx.globalAlpha = a;
        ctx.drawImage(layer, 0, 0);
      } else {
        draw(ctx, s, t);
      }
      ctx.restore();
    });
    post(ctx, t);
    const sc = TL.scenes.find(k => t >= k.start && t < k.end);
    if (TL.showCaptions !== false && !(sc && noCaps.has(sc.id))) {
      drawCaptions(ctx, t, TL.captions || [], TL.captionStyle || BRAND.subtitulos, BRAND);
    }
    watermark(ctx);
    return out.toDataURL(type, 0.93);
  };

  (async () => {
    TL = await (await fetch('timeline.json')).json();
    try {
      const m = await (await fetch('/marca.json')).json();
      Object.assign(BRAND, m, { colores: { ...BRAND.colores, ...(m.colores || {}) } });
    } catch { /* sin marca.json: valores por defecto */ }
    window.DURATION = TL.duration;
    window.COVER_T = TL.cover ?? 1.2;
    await Promise.all([
      document.fonts.load('800 80px "Inter Display"'), document.fonts.load('700 80px "Inter Display"'),
      document.fonts.load('600 80px "Inter Display"'), document.fonts.load('italic 600 80px "Inter Display"'),
      document.fonts.load('500 40px "Inter"'), document.fonts.load('600 40px "Inter"'), document.fonts.load('700 40px "Inter"'),
    ]);
    if (opts.ready) await opts.ready();
    window.READY = true;
  })();
}
