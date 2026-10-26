// Kit 2D: piezas listas para escenas de datos y de psicología del deporte.
//   bigNumber   cifra que cuenta hasta su valor          bars       comparación en barras animadas
//   pulseLine   electrocardiograma con pulsaciones       breathRing círculo de respiración (inhala/exhala)
//   stopwatch   cronómetro con aguja                     stadium    fondo de estadio de noche
//   target      diana con impacto                        chip       etiqueta «A · texto» como en un examen
//   endCard     cierre con la marca (nombre, frase de siempre, usuario)
// Todas reciben el contexto c y el tiempo local lt de la escena, y se pueden combinar.
import {
  W, H, TAU, clamp, seg, easeOut, easeIO, inOut, rng, glow, txt, roundRect, bokehField, BRAND, PAL,
} from './core.js';

// cifra que cuenta desde 0 entre a y a+dur
export function bigNumber(c, value, lt, a, o = {}) {
  const { x = W / 2, y = 900, dur = 1.2, prefix = '', suffix = '', decimals = 0, size = 260, color = BRAND.colores.acento, until = 1e9 } = o;
  const k = inOut(lt, a, until, 0.3, 0.3);
  if (k <= 0) return;
  const v = value * easeOut(seg(lt, a, a + dur));
  const s = prefix + v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  txt(c, s, x, y, { size, weight: 800, color, alpha: k, glowPx: 40, glowColor: color });
}

// items: [{ label, value, color? }]; las barras crecen escalonadas desde a
export function bars(c, items, lt, a, o = {}) {
  const { x = 140, y = 1350, w = 800, h = 620, max = Math.max(...items.map(i => i.value)), unit = '%', decimals = 0 } = o;
  const n = items.length, gap = 50, bw = (w - gap * (n - 1)) / n;
  items.forEach((it, i) => {
    const k = easeOut(seg(lt, a + i * 0.25, a + i * 0.25 + 0.9));
    const col = it.color || (i === n - 1 ? BRAND.colores.acento : BRAND.colores.primario);
    const bh = h * (it.value / max) * k, bx = x + i * (bw + gap);
    c.save();
    c.globalAlpha = seg(lt, a + i * 0.25, a + i * 0.25 + 0.2);
    const g = c.createLinearGradient(0, y - bh, 0, y);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0.05)');
    c.fillStyle = g; roundRect(c, bx, y - bh, bw, Math.max(bh, 1), 18); c.fill();
    glow(c, bx + bw / 2, y - bh, bw * 0.6, col, 0.35 * k);
    c.restore();
    const v = (it.value * k).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    txt(c, v + unit, bx + bw / 2, y - bh - 60, { size: 72, weight: 800, alpha: k });
    txt(c, it.label, bx + bw / 2, y + 60, { size: 40, weight: 600, family: 'Inter', color: '#c9d4ea', alpha: seg(lt, a, a + 0.4) });
  });
}

// electrocardiograma que se desplaza; bpm puede variar con el tiempo (función o número)
export function pulseLine(c, lt, o = {}) {
  const { y = 960, amp = 160, color = PAL.rose, bpm = 70, alpha = 1, showBpm = true } = o;
  const rate = typeof bpm === 'function' ? bpm(lt) : bpm;
  const per = 60 / rate, speed = 520; // px/s
  const beat = u => { // forma de un latido en [0,1)
    if (u < 0.08) return -0.12 * Math.sin(u / 0.08 * Math.PI);
    if (u < 0.12) return 0.25 * seg(u, 0.08, 0.12);
    if (u < 0.15) return 0.25 - 1.25 * seg(u, 0.12, 0.15);
    if (u < 0.19) return -1 + 1.35 * seg(u, 0.15, 0.19);
    if (u < 0.22) return 0.35 - 0.35 * seg(u, 0.19, 0.22);
    if (u > 0.35 && u < 0.5) return -0.22 * Math.sin(seg(u, 0.35, 0.5) * Math.PI);
    return 0;
  };
  c.save(); c.globalAlpha = alpha;
  c.strokeStyle = color; c.lineWidth = 6; c.lineJoin = 'round'; c.shadowColor = color; c.shadowBlur = 24;
  c.beginPath();
  for (let x = 0; x <= W; x += 4) {
    const tt = lt - (W - x) / speed;
    const u = (((tt / per) % 1) + 1) % 1;
    const yy = y + beat(u) * amp;
    x ? c.lineTo(x, yy) : c.moveTo(x, yy);
  }
  c.stroke();
  c.restore();
  const u = (((lt / per) % 1) + 1) % 1;
  glow(c, W - 4, y + beat(u) * amp, 60, color, alpha);
  if (showBpm) txt(c, `${Math.round(rate)} lpm`, W / 2, y + amp + 120, { size: 64, weight: 800, color, alpha, glowPx: 20, glowColor: color });
}

// círculo de respiración: crece al inhalar, se encoge al exhalar (period = segundos por ciclo completo)
export function breathRing(c, lt, o = {}) {
  const { x = W / 2, y = 950, r = 260, period = 8, color = BRAND.colores.primario, alpha = 1, labels = true } = o;
  const u = ((lt / period) % 1 + 1) % 1, inhale = u < 0.5;
  const k = easeIO(inhale ? u * 2 : 2 - u * 2);
  const rr = r * (0.55 + 0.45 * k);
  c.save(); c.globalAlpha = alpha;
  glow(c, x, y, rr * 1.8, color, 0.35);
  c.strokeStyle = color; c.lineWidth = 8; c.shadowColor = color; c.shadowBlur = 30;
  c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
  c.globalAlpha = alpha * 0.25; c.lineWidth = 3;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  c.restore();
  if (labels) txt(c, inhale ? 'inhala' : 'exhala', x, y, { size: 64, weight: 700, alpha: alpha * (0.6 + 0.4 * k) });
}

// cronómetro: speed = vueltas por segundo de la aguja
export function stopwatch(c, lt, o = {}) {
  const { x = W / 2, y = 950, r = 280, speed = 0.25, color = BRAND.colores.primario, alpha = 1, text = '' } = o;
  c.save(); c.globalAlpha = alpha; c.translate(x, y);
  c.strokeStyle = '#dfe7f5'; c.lineWidth = 14;
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  c.fillStyle = '#dfe7f5'; roundRect(c, -40, -r - 70, 80, 50, 10); c.fill();
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU, l = i % 5 ? 18 : 40;
    c.lineWidth = i % 5 ? 3 : 7; c.strokeStyle = i % 5 ? 'rgba(223,231,245,0.5)' : '#dfe7f5';
    c.beginPath(); c.moveTo(Math.sin(a) * (r - 30), -Math.cos(a) * (r - 30));
    c.lineTo(Math.sin(a) * (r - 30 - l), -Math.cos(a) * (r - 30 - l)); c.stroke();
  }
  const ang = lt * speed * TAU;
  c.strokeStyle = color; c.lineWidth = 8; c.lineCap = 'round'; c.shadowColor = color; c.shadowBlur = 20;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ang) * (r - 50), -Math.cos(ang) * (r - 50)); c.stroke();
  c.fillStyle = color; c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fill();
  c.restore();
  if (text) txt(c, text, x, y + r + 110, { size: 70, weight: 800, alpha });
}

// fondo de estadio de noche: focos, público en bokeh y césped
export function stadium(c, lt, o = {}) {
  const { seed = 3, light = 1, grass = '#0d3b22' } = o;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#02040a'); g.addColorStop(0.55, '#08111f'); g.addColorStop(0.62, '#0a1a14'); g.addColorStop(1, grass);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (const fx of [140, 940]) { // haces de los focos
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.16 * light;
    const bg = c.createLinearGradient(fx, 180, W / 2, 1400);
    bg.addColorStop(0, '#cfe3ff'); bg.addColorStop(1, 'rgba(207,227,255,0)');
    c.fillStyle = bg; c.beginPath(); c.moveTo(fx - 30, 180); c.lineTo(fx + 30, 180); c.lineTo(W / 2 + 420, 1400); c.lineTo(W / 2 - 420, 1400); c.closePath(); c.fill();
    c.restore();
    for (let i = 0; i < 6; i++) glow(c, fx - 75 + (i % 3) * 75, 160 + Math.floor(i / 3) * 50, 46, '#eaf2ff', 0.9 * light);
  }
  bokehField(c, seed, lt, 70, ['#ffd27a', '#ff8a5c', '#9fc8ff', '#ffffff'], { yMin: 760, yMax: 1120, rMin: 6, rMax: 22, alpha: 0.55, drift: 4 });
  c.save(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 4; // líneas del campo
  c.beginPath(); c.moveTo(0, 1500); c.lineTo(W, 1500); c.stroke();
  c.beginPath(); c.ellipse(W / 2, 1500, 300, 70, 0, 0, TAU); c.stroke();
  c.restore();
}

// diana: hit en [0,1] marca el impacto (0 = sin impacto); spread separa el impacto del centro
export function target(c, lt, o = {}) {
  const { x = W / 2, y = 950, r = 300, hit = 1, spread = 0, color = PAL.red, alpha = 1, seed = 1 } = o;
  c.save(); c.globalAlpha = alpha;
  const cols = ['#f4f6fb', color, '#f4f6fb', color, '#f4f6fb'];
  cols.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r * (1 - i * 0.2), 0, TAU); c.fill(); });
  c.restore();
  if (hit > 0) {
    const rr = rng(seed), a = rr() * TAU, d = spread * r * 0.85;
    const hx = x + Math.cos(a) * d, hy = y + Math.sin(a) * d, k = easeOut(clamp(hit));
    glow(c, hx, hy, 120 * k, '#ffffff', 0.8 * alpha);
    c.save(); c.globalAlpha = alpha * k; c.fillStyle = '#111';
    c.beginPath(); c.arc(hx, hy, 18, 0, TAU); c.fill(); c.restore();
  }
}

// etiqueta tipo respuesta de examen: círculo con letra + texto en una barra oscura
export function chip(c, letter, text, x, y, a, o = {}) {
  if (a <= 0.01) return;
  const { color = BRAND.colores.primario, w = 680 } = o;
  c.save(); c.globalAlpha = a;
  c.fillStyle = 'rgba(10,12,24,0.85)'; roundRect(c, x - w / 2, y - 40, w, 80, 16); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = color; c.beginPath(); c.arc(x - w / 2 + 46, y, 26, 0, TAU); c.fill();
  c.restore();
  txt(c, letter, x - w / 2 + 46, y + 1, { size: 30, weight: 800, alpha: a });
  txt(c, text, x - w / 2 + 92, y + 1, { size: 40, weight: 700, align: 'left', alpha: a });
}

// cierre con la marca personal (marca.json)
export function endCard(c, lt, d, o = {}) {
  const { accent = BRAND.colores.primario } = o;
  const g = c.createRadialGradient(W / 2, 880, 0, W / 2, 880, 1100);
  g.addColorStop(0, '#0c1630'); g.addColorStop(1, '#02040a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  glow(c, W / 2, 880, 520, accent, 0.25);
  const k = seg(lt, 0.1, 0.7);
  if (BRAND.cierre) {
    const e = easeOut(k);
    txt(c, BRAND.cierre, W / 2, 860 + (1 - e) * 30, { size: 74, weight: 800, alpha: k, glowPx: 30, glowColor: accent });
  }
  if (BRAND.nombre) txt(c, BRAND.nombre, W / 2, 1010, { size: 46, weight: 600, family: 'Inter', color: '#c9d4ea', alpha: seg(lt, 0.5, 1.0) });
  if (BRAND.usuario) txt(c, BRAND.usuario, W / 2, 1080, { size: 40, weight: 700, family: 'Inter', color: accent, alpha: seg(lt, 0.7, 1.2) });
  const fade = seg(lt, d - 0.4, d);
  if (fade > 0) { c.fillStyle = `rgba(0,0,0,${fade})`; c.fillRect(0, 0, W, H); }
}

