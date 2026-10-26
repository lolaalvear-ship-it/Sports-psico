// Kit de ilustración médica: órganos, células, fármacos y personajes dibujados con volumen y textura,
// y fondos de tejido para que cada escena parezca una lámina de anatomía animada.
//
// Fondos (ocupan toda la pantalla):
//   tissueBg    pliegues de mucosa (esófago, estómago, vaso)      bloodBg     torrente con glóbulos rojos
//   cellsBg     células desenfocadas (tono morado, rosa, azul)     shardsBg    azul profundo con fragmentos flotando
//   mouthBg     boca abierta con dientes y encías                  splitScreen pantalla partida en dos escenas
// Piezas (x, y = centro; s = tamaño en px, normalmente la altura):
//   heart       corazón anatómico que late (color libre)          brain       cerebro de perfil con lóbulos resaltables
//   lungs       pulmones con bronquios que respiran               stomach     estómago con úlcera opcional
//   kidney      riñón con uréter y vasos                          bone        hueso largo con fractura y hematoma opcionales
//   ovum        óvulo con corona y espermatozoides                rbc         glóbulo rojo
//   neuron      neurona ilustrada con impulso por el axón         pill        comprimido redondo, ovalado o cápsula
//   syringe     jeringa                                           person      personaje (de pie, corriendo, tumbado, cayendo)
// Todas reciben el contexto c; las animadas también el tiempo local lt.
import { W, H, TAU, clamp, lerp, seg, easeIO, easeOut, rng, offscreen, glow } from './core.js';

// ---------------------------------------------------------------- color y volumen
function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
// mezcla con blanco (k > 0) o con negro (k < 0)
export function tone(h, k) {
  const [r, g, b] = hex(h), t = k > 0 ? 255 : 0, a = Math.abs(k);
  const f = v => Math.round(lerp(v, t, a)).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}

// texturas de ruido precalculadas (multiplicadas sobre el color base)
function valueNoise(seed, size, cells) {
  const r = rng(seed), g = [];
  for (let i = 0; i < cells * cells; i++) g.push(r());
  const at = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
  return (x, y) => {
    const fx = x / size * cells, fy = y / size * cells, i = Math.floor(fx), j = Math.floor(fy);
    const u = fx - i, v = fy - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return lerp(lerp(at(i, j), at(i + 1, j), su), lerp(at(i, j + 1), at(i + 1, j + 1), su), sv);
  };
}
function makeTexture(kind, seed = 1) {
  const S = 256, c = offscreen(S, S), g = c.getContext('2d'), id = g.createImageData(S, S);
  const oct = [4, 8, 16, 32].map((k, i) => valueNoise(seed + i, S, k));
  const fbm = (x, y) => oct[0](x, y) * 0.5 + oct[1](x, y) * 0.25 + oct[2](x, y) * 0.15 + oct[3](x, y) * 0.1;
  const r = rng(seed + 9);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v;
    if (kind === 'marble') { // vetas suaves (hueso)
      const n = fbm(x, y);
      v = 1 - 0.55 * Math.pow(1 - Math.abs(Math.sin((x / S * 3 + n * 5) * Math.PI)), 6) - 0.18 * (1 - n);
    } else if (kind === 'speckle') { // moteado (tejido, óvulo)
      v = 0.82 + 0.18 * fbm(x, y) - (r() < 0.012 ? 0.35 * r() : 0);
    } else { // 'soft': variación orgánica suave
      v = 0.75 + 0.25 * fbm(x, y);
    }
    const p = (y * S + x) * 4, b = Math.round(clamp(v) * 255);
    id.data[p] = id.data[p + 1] = id.data[p + 2] = b; id.data[p + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return c;
}
const TEX = {};
const tex = k => (TEX[k] ||= makeTexture(k, k.length * 7));

// rellena el camino actual con volumen: base + luz desde arriba a la izquierda + sombra + textura + borde interior
export function volume(c, path, base, x, y, r, o = {}) {
  const { lx = -0.35, ly = -0.45, texture = 'soft', texA = 0.5, light = 0.55, dark = 0.55, edge = 0.5, outline = 0 } = o;
  const m = c.getTransform(), px = Math.hypot(m.a, m.b) || 1; // px reales por unidad (las piezas se dibujan escaladas)
  c.save();
  if (outline) { path(c); c.lineWidth = outline; c.strokeStyle = tone(base, -0.55); c.lineJoin = 'round'; c.stroke(); }
  path(c);
  c.fillStyle = base; c.fill();
  c.clip();
  if (texture) {
    const p = c.createPattern(tex(texture), 'repeat');
    p.setTransform(new DOMMatrix().translate(x, y).scale(Math.max(0.6, r * px / 220) / px));
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = texA;
    c.fillStyle = p; c.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const g = c.createRadialGradient(x + lx * r, y + ly * r, 0, x + lx * r * 0.4, y + ly * r * 0.4, r * 1.7);
  g.addColorStop(0, rgba(tone(base, 0.7), light)); g.addColorStop(0.35, rgba(base, 0));
  g.addColorStop(0.75, rgba(tone(base, -0.5), dark * 0.4)); g.addColorStop(1, rgba(tone(base, -0.7), dark));
  c.fillStyle = g; c.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  if (edge) { // sombra interior en el contorno
    path(c); c.lineWidth = r * 0.12; c.strokeStyle = rgba(tone(base, -0.6), edge * 0.6);
    c.filter = `blur(${Math.max(2, r * px * 0.05).toFixed(1)}px)`; c.stroke(); c.filter = 'none';
  }
  c.restore();
}
// esfera sombreada
export function ball(c, x, y, r, base, o = {}) {
  volume(c, k => { k.beginPath(); k.arc(x, y, r, 0, TAU); }, base, x, y, r, { texture: null, edge: 0.3, ...o });
}
// tubo con volumen a lo largo de un camino (vasos, bronquios, tallo)
export function tube(c, path, w, base, o = {}) {
  const { shine = 0.45 } = o;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  path(c); c.lineWidth = w; c.strokeStyle = tone(base, -0.45); c.stroke();
  path(c); c.lineWidth = w * 0.78; c.strokeStyle = base; c.stroke();
  c.translate(-w * 0.14, -w * 0.14);
  path(c); c.lineWidth = w * 0.22; c.strokeStyle = rgba(tone(base, 0.65), shine); c.stroke();
  c.restore();
}
// sombra suave bajo una pieza
function dropShadow(c, x, y, rx, ry, a = 0.35) {
  c.save(); c.globalAlpha = a; c.filter = `blur(${(ry * 0.6).toFixed(1)}px)`;
  c.fillStyle = '#000'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.restore();
}
// camino a partir de puntos unitarios [[x,y],...] con curvas suaves (cerrado)
function blobPath(c, pts, x, y, s, rot = 0) {
  const n = pts.length, cs = Math.cos(rot), sn = Math.sin(rot);
  const P = i => { const [px, py] = pts[(i + n) % n]; return [x + (px * cs - py * sn) * s, y + (px * sn + py * cs) * s]; };
  c.beginPath();
  const a = P(-1), b = P(0);
  c.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 0; i < n; i++) { const p = P(i), q = P(i + 1); c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  c.closePath();
}

// ---------------------------------------------------------------- fondos
// pliegues de mucosa: bandas onduladas con brillo en la cresta (como el interior del esófago)
export function tissueBg(c, lt, o = {}) {
  const { color = '#b8455a', deep = '#3a0d18', bands = 10, speed = 1, specks = true } = o;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, tone(color, -0.35)); g.addColorStop(0.5, color); g.addColorStop(1, deep);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(17);
  for (let i = 0; i < bands; i++) {
    const y0 = (i + 0.5) / bands * H * 1.1 - 60, amp = 30 + r() * 40, f = 0.004 + r() * 0.003, ph = r() * TAU;
    const wave = x => y0 + Math.sin(x * f + ph + lt * 0.5 * speed) * amp + Math.sin(x * f * 2.3 + ph * 2 - lt * 0.3 * speed) * amp * 0.35;
    const band = tone(color, lerp(-0.25, 0.12, r()));
    c.save();
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, wave(x));
    c.lineTo(W, H); c.closePath();
    const bg = c.createLinearGradient(0, y0 - amp, 0, y0 + 220);
    bg.addColorStop(0, rgba(tone(band, 0.35), 0.95)); bg.addColorStop(0.18, rgba(band, 0.9)); bg.addColorStop(1, rgba(tone(band, -0.5), 0.0));
    c.fillStyle = bg; c.fill();
    c.beginPath();
    for (let x = 0; x <= W; x += 20) (x ? c.lineTo : c.moveTo).call(c, x, wave(x) + 6);
    c.strokeStyle = 'rgba(255,225,230,0.28)'; c.lineWidth = 3; c.stroke();
    c.restore();
  }
  if (specks) for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, ph = r() * TAU;
    glow(c, x + Math.sin(lt * 0.4 + ph) * 20, y + Math.cos(lt * 0.3 + ph) * 14, 8 + r() * 18, '#ffd0dc', 0.25 + 0.25 * Math.sin(lt + ph));
  }
}

// torrente sanguíneo: glóbulos rojos a varias profundidades fluyendo
export function bloodBg(c, lt, o = {}) {
  const { n = 46, speed = 1, dir = 1 } = o;
  const g = c.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.5, H * 0.8);
  g.addColorStop(0, '#7a1420'); g.addColorStop(1, '#240409');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(23), cells = [];
  for (let i = 0; i < n; i++) cells.push({ x: r() * (W + 400), y: r() * H, z: 0.35 + r() * 0.9, rot: r() * TAU, sp: 0.6 + r() * 0.8, tl: r() });
  cells.sort((a, b) => a.z - b.z);
  for (const k of cells) {
    const x = ((k.x + dir * lt * 160 * k.sp * speed * k.z) % (W + 400) + W + 400) % (W + 400) - 200;
    c.save(); c.globalAlpha = clamp(0.25 + k.z * 0.75);
    if (k.z < 0.6) c.filter = `blur(${((0.6 - k.z) * 14).toFixed(1)}px)`;
    rbc(c, x, k.y + Math.sin(lt + k.tl * 6) * 10, 70 * k.z, k.rot + lt * 0.4 * k.sp, 0.45 + 0.55 * Math.abs(Math.sin(k.tl * 5 + lt * 0.5)));
    c.restore();
  }
}

// fondo de células desenfocadas (como el de la fecundación)
export function cellsBg(c, lt, o = {}) {
  const { color = '#5a2a5e', cell = '#e08aa0', n = 60 } = o;
  const g = c.createRadialGradient(W / 2, H * 0.45, 60, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, tone(color, 0.25)); g.addColorStop(1, tone(color, -0.6));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(31);
  for (let i = 0; i < n; i++) {
    const z = r(), x = r() * W, y = r() * H, ph = r() * TAU, rad = lerp(12, 46, z);
    c.save(); c.globalAlpha = lerp(0.25, 0.85, z);
    if (z < 0.5) c.filter = `blur(${((0.5 - z) * 16).toFixed(1)}px)`;
    ball(c, x + Math.sin(lt * 0.3 + ph) * 18, y + Math.cos(lt * 0.25 + ph) * 18, rad, tone(cell, lerp(-0.2, 0.15, r())), { light: 0.7 });
    c.restore();
  }
}

// azul profundo con fragmentos triangulares flotando (como el del hueso)
export function shardsBg(c, lt, o = {}) {
  const { color = '#123a6e', shard = '#e8dcc0', n = 40 } = o;
  const g = c.createRadialGradient(W / 2, H * 0.45, 80, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, tone(color, 0.25)); g.addColorStop(1, tone(color, -0.65));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(41);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, s = 10 + r() * 22, ph = r() * TAU, sp = 0.3 + r();
    c.save();
    c.translate(x + Math.sin(lt * 0.3 * sp + ph) * 30, y - lt * 12 * sp);
    c.rotate(ph + lt * 0.6 * sp);
    c.globalAlpha = 0.5 + 0.4 * r();
    c.fillStyle = shard; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.9, s * 0.6); c.lineTo(-s * 0.8, s * 0.5); c.closePath(); c.fill();
    c.restore();
  }
  for (let i = 0; i < 30; i++) glow(c, r() * W, r() * H, 4 + r() * 6, '#cfe3ff', 0.4);
}

// boca abierta vista desde dentro: dientes arriba y abajo
export function mouthBg(c, lt, o = {}) {
  const { open = 1 } = o;
  const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, H * 0.7);
  g.addColorStop(0, '#6a1a26'); g.addColorStop(1, '#2a0710');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.strokeStyle = 'rgba(255,190,200,0.18)'; c.lineWidth = 6; // arco de los labios al fondo
  c.beginPath(); c.ellipse(W / 2, H / 2, W * 0.75, H * 0.48, 0, 0, TAU); c.stroke(); c.restore();
  const gap = lerp(380, 1150, open);
  const top = H / 2 - gap / 2, bot = H / 2 + gap / 2;
  const row = (yEdge, up) => {
    // encía
    c.save();
    c.beginPath();
    if (up) { c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, yEdge - 150); } else { c.moveTo(0, H); c.lineTo(W, H); c.lineTo(W, yEdge + 150); }
    for (let i = 7; i >= 0; i--) { const x = i * W / 7 - W / 14; c.quadraticCurveTo(x + W / 14, yEdge + (up ? -110 : 110), x, yEdge + (up ? -150 : 150)); }
    c.closePath();
    const gg = c.createLinearGradient(0, up ? 0 : H, 0, yEdge);
    gg.addColorStop(0, '#a83a50'); gg.addColorStop(1, '#e27a8c');
    c.fillStyle = gg; c.fill(); c.restore();
    // dientes
    const n = 7, tw = W / n - 12;
    for (let i = 0; i < n; i++) {
      const x = 6 + i * (tw + 12), h = 210 + (i === 3 ? 20 : 0) - Math.abs(i - 3) * 6;
      const y = up ? yEdge - h : yEdge;
      volume(c, k => { roundRectP(k, x, y, tw, h, 26); }, '#efe7d6', x + tw / 2, y + h / 2, h * 0.7,
        { texture: 'soft', texA: 0.35, light: 0.6, dark: 0.5, edge: 0.6, lx: -0.2, ly: up ? 0.3 : -0.4 });
      c.save(); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x + tw * 0.3, y + h * 0.2); c.lineTo(x + tw * 0.3, y + h * 0.75); c.stroke(); c.restore();
    }
  };
  row(top, true); row(bot, false);
}
function roundRectP(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// pantalla partida: left(c) y right(c) dibujan cada mitad; divisoria luminosa
export function splitScreen(c, left, right, o = {}) {
  const { at = W / 2, line = '#cfe3ff' } = o;
  c.save(); c.beginPath(); c.rect(0, 0, at, H); c.clip(); left(c); c.restore();
  c.save(); c.beginPath(); c.rect(at, 0, W - at, H); c.clip(); right(c); c.restore();
  c.save(); c.fillStyle = line; c.globalAlpha = 0.7; c.fillRect(at - 2, 0, 4, H); c.restore();
  glow(c, at, H / 2, 40, line, 0.3);
}

// ---------------------------------------------------------------- órganos
// corazón anatómico; beat 0..1 (usa heartBeat(lt, lpm) para animarlo)
export const heartBeat = (lt, bpm = 70) => { const u = (lt * bpm / 60) % 1; return Math.exp(-Math.pow((u - 0.1) / 0.05, 2)) + 0.5 * Math.exp(-Math.pow((u - 0.3) / 0.05, 2)); };
export function heart(c, x, y, s, o = {}) {
  const { color = '#d3303d', beat = 0, rot = 0 } = o;
  const k = s * (1 + 0.05 * beat);
  const vessel = tone(color, -0.08);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k);
  const T = (pts) => cc => { cc.beginPath(); cc.moveTo(...pts[0]); for (let i = 1; i < pts.length; i += 3) cc.bezierCurveTo(...pts[i], ...pts[i + 1], ...pts[i + 2]); };
  const lw = 1 / k; // grosor en px reales dentro del espacio escalado
  // vasos de detrás: cava superior y arco aórtico con sus ramas
  tube(c, T([[-0.27, -0.16], [-0.28, -0.3], [-0.29, -0.42], [-0.3, -0.56]]), 0.1, tone(color, -0.2));
  for (const [bx, by, tx, ty] of [[0.03, -0.5, -0.01, -0.66], [0.11, -0.54, 0.11, -0.69], [0.19, -0.52, 0.24, -0.66]]) {
    tube(c, T([[bx, by], [bx, by - 0.05], [tx, ty + 0.05], [tx, ty]]), 0.05, vessel);
  }
  tube(c, T([[0.02, -0.2], [0.0, -0.44], [0.08, -0.56], [0.2, -0.53], [0.3, -0.5], [0.3, -0.4], [0.27, -0.28]]), 0.14, vessel);
  // cuerpo
  const body = T([[0.08, 0.47], [-0.16, 0.39], [-0.45, 0.16], [-0.41, -0.08], [-0.38, -0.27], [-0.22, -0.32], [-0.08, -0.24],
    [0.02, -0.31], [0.21, -0.35], [0.33, -0.24], [0.47, -0.12], [0.45, 0.13], [0.35, 0.27], [0.27, 0.39], [0.16, 0.45], [0.08, 0.47]]);
  volume(c, cc => { body(cc); cc.closePath(); }, color, 0, 0.02, 0.5, { texture: 'soft', texA: 0.45, light: 0.6, dark: 0.6, lx: -0.4, ly: -0.5 });
  // tronco pulmonar por delante
  tube(c, T([[-0.06, -0.18], [-0.1, -0.32], [-0.16, -0.44], [-0.3, -0.45]]), 0.12, tone(color, 0.05));
  // coronarias y surco interventricular
  c.lineCap = 'round';
  const cor = (pts, w) => {
    T(pts)(c); c.lineWidth = w; c.strokeStyle = rgba(tone(color, -0.55), 0.85); c.stroke();
    c.save(); c.translate(-w * 0.3, -w * 0.3); T(pts)(c); c.lineWidth = w * 0.35; c.strokeStyle = rgba(tone(color, 0.5), 0.6); c.stroke(); c.restore();
  };
  cor([[0.0, -0.2], [0.02, 0.0], [0.1, 0.25], [0.1, 0.44]], 0.024);
  cor([[0.03, -0.05], [0.13, 0.0], [0.24, 0.05], [0.33, 0.18]], 0.016);
  cor([[0.05, 0.12], [-0.05, 0.18], [-0.18, 0.2], [-0.3, 0.12]], 0.014);
  cor([[-0.08, -0.22], [-0.2, -0.12], [-0.3, 0.0], [-0.38, 0.05]], 0.018);
  void lw;
  c.restore();
}

// cerebro de perfil (frente a la derecha); hl: { frontal, parietal, temporal, occipital, cerebelo, prefrontal, motora } -> 0..1
// circunvoluciones: tubos serpenteantes con contorno, apilados como en una lámina ilustrada
const GYRI = (() => {
  const r = rng(77), list = [];
  for (let gy = -0.44; gy < 0.24; gy += 0.075) for (let gx = -0.52; gx < 0.52; gx += 0.085) {
    let x = gx + (r() - 0.5) * 0.06, y = gy + (r() - 0.5) * 0.05, a = r() * TAU;
    const pts = [[x, y]];
    for (let j = 0; j < 5; j++) { a += (r() - 0.5) * 2.2; x += Math.cos(a) * 0.045; y += Math.sin(a) * 0.045; pts.push([x, y]); }
    list.push({ pts, w: 0.06 + r() * 0.014, k: r() });
  }
  return list.sort((p, q) => p.k - q.k);
})();
const LOBES = { frontal: [0.26, -0.12, 0.24], prefrontal: [0.36, -0.06, 0.15], motora: [0.06, -0.3, 0.12], parietal: [-0.14, -0.26, 0.2],
  temporal: [0.1, 0.1, 0.18], occipital: [-0.38, -0.06, 0.15], cerebelo: [-0.27, 0.22, 0.15] };
export function brain(c, x, y, s, o = {}) {
  const { color = '#e7a3ab', hl = {}, hlColor = '#ffd25e', lt = 0 } = o;
  c.save(); c.translate(x, y); c.scale(s, s);
  const cere = cc => {
    cc.beginPath(); cc.moveTo(0.4, 0.1);
    cc.bezierCurveTo(0.53, -0.05, 0.47, -0.31, 0.25, -0.37);
    cc.bezierCurveTo(0.05, -0.43, -0.3, -0.41, -0.44, -0.2);
    cc.bezierCurveTo(-0.52, -0.06, -0.48, 0.1, -0.36, 0.14);
    cc.bezierCurveTo(-0.24, 0.17, -0.12, 0.11, -0.04, 0.15);
    cc.bezierCurveTo(0.06, 0.27, 0.22, 0.25, 0.29, 0.17);
    cc.bezierCurveTo(0.33, 0.13, 0.36, 0.12, 0.4, 0.1); cc.closePath();
  };
  // tronco y cerebelo
  tube(c, cc => { cc.beginPath(); cc.moveTo(-0.07, 0.12); cc.quadraticCurveTo(-0.09, 0.3, -0.13, 0.46); }, 0.1, tone(color, -0.1));
  const cb = cc => { cc.beginPath(); cc.ellipse(-0.27, 0.22, 0.17, 0.1, -0.15, 0, TAU); };
  volume(c, cb, tone(color, -0.08), -0.27, 0.22, 0.17, { texture: null, edge: 0.4 });
  c.save(); cb(c); c.clip(); c.strokeStyle = rgba(tone(color, -0.55), 0.6); c.lineWidth = 0.008;
  for (let i = -5; i <= 6; i++) { c.beginPath(); c.ellipse(-0.27, 0.22 + i * 0.018, 0.2, 0.06, -0.15, Math.PI * 0.05, Math.PI * 0.95); c.stroke(); }
  c.restore();
  // hemisferio
  volume(c, cere, color, 0, -0.1, 0.48, { texture: 'soft', texA: 0.35, light: 0.55, dark: 0.55, edge: 0.6 });
  c.save(); cere(c); c.clip();
  c.lineCap = 'round'; c.lineJoin = 'round';
  const stroke = (pts, w, a = 0.75) => {
    const path = cc => { cc.beginPath(); cc.moveTo(...pts[0]); for (let i = 1; i < pts.length - 1; i++) cc.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); cc.lineTo(...pts[pts.length - 1]); };
    path(c); c.lineWidth = w; c.strokeStyle = rgba(tone(color, -0.6), a); c.stroke();
    
  };
  c.fillStyle = rgba(tone(color, -0.55), 0.9); c.fillRect(-0.6, -0.6, 1.2, 1.2); // fondo de los surcos
  const gpath = pts => cc => { cc.beginPath(); cc.moveTo(...pts[0]); for (let i = 1; i < pts.length - 1; i++) cc.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); cc.lineTo(...pts[pts.length - 1]); };
  for (const g of GYRI) {
    const P = gpath(g.pts);
    P(c); c.lineWidth = g.w + 0.012; c.strokeStyle = tone(color, -0.5); c.stroke();
    P(c); c.lineWidth = g.w; c.strokeStyle = tone(color, (g.k - 0.5) * 0.12); c.stroke();
    c.save(); c.translate(-0.006, -0.008); P(c); c.lineWidth = g.w * 0.28; c.strokeStyle = rgba(tone(color, 0.55), 0.32); c.stroke(); c.restore();
  }
  // luz y sombra globales sobre los pliegues
  const sh = c.createRadialGradient(-0.15, -0.3, 0, -0.05, -0.15, 0.6);
  sh.addColorStop(0, 'rgba(255,240,240,0.25)'); sh.addColorStop(0.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(40,0,10,0.45)');
  c.fillStyle = sh; c.fillRect(-0.6, -0.6, 1.2, 1.2);
  // resaltado encima de los pliegues
  for (const [name, amt] of Object.entries(hl)) {
    const L = LOBES[name]; if (!L || amt <= 0) continue;
    const pulse = 0.85 + 0.15 * Math.sin(lt * 5);
    const g = c.createRadialGradient(L[0], L[1], 0, L[0], L[1], L[2]);
    g.addColorStop(0, rgba(hlColor, 0.95 * amt * pulse)); g.addColorStop(0.5, rgba(hlColor, 0.5 * amt * pulse)); g.addColorStop(1, rgba(hlColor, 0));
    c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(-0.6, -0.6, 1.2, 1.2); c.globalCompositeOperation = 'source-over';
  }
  stroke([[0.3, 0.1], [0.15, 0.03], [0.0, 0.0], [-0.12, -0.04], [-0.2, -0.1]], 0.02, 0.95); // cisura lateral
  c.restore();
  cere(c); c.lineWidth = 0.012; c.strokeStyle = tone(color, -0.55); c.stroke();
  c.restore();
}

// pulmones; breath 0..1 (0 = espiración, 1 = inspiración)
export function lungs(c, x, y, s, o = {}) {
  const { color = '#e48b98', breath = 0.5, airway = '#f3d6d9' } = o;
  const k = 0.94 + 0.08 * breath;
  c.save(); c.translate(x, y); c.scale(s, s);
  const R = [[-0.1, -0.4], [-0.3, -0.28], [-0.43, 0.0], [-0.45, 0.3], [-0.38, 0.4], [-0.2, 0.36], [-0.07, 0.3], [-0.06, 0.0], [-0.07, -0.25]];
  for (const side of [-1, 1]) {
    const pts = R.map(([px, py]) => [px * side * k, py * (0.98 + 0.03 * breath)]);
    if (side > 0) pts[6] = [0.13, 0.26]; // escotadura cardiaca
    volume(c, cc => blobPath(cc, pts, 0, 0, 1), color, 0.25 * side, 0, 0.4, { texture: 'speckle', texA: 0.55, light: 0.55, dark: 0.55, edge: 0.6 });
  }
  // tráquea y bronquios
  const br = (x0, y0, a, len, w, d) => {
    const x1 = x0 + Math.sin(a) * len, y1 = y0 + Math.cos(a) * len;
    tube(c, cc => { cc.beginPath(); cc.moveTo(x0, y0); cc.lineTo(x1, y1); }, w, airway, { shine: 0.35 });
    if (d > 0) { br(x1, y1, a - 0.45, len * 0.72, w * 0.7, d - 1); br(x1, y1, a + 0.35, len * 0.72, w * 0.7, d - 1); }
  };
  tube(c, cc => { cc.beginPath(); cc.moveTo(0, -0.62); cc.lineTo(0, -0.18); }, 0.075, airway);
  c.save(); c.strokeStyle = rgba(tone(airway, -0.3), 0.8); c.lineWidth = 0.008;
  for (let i = 0; i < 9; i++) { const yy = -0.58 + i * 0.045; c.beginPath(); c.moveTo(-0.03, yy); c.lineTo(0.03, yy); c.stroke(); }
  c.restore();
  br(0, -0.18, -1.0, 0.16, 0.05, 3); br(0, -0.18, 1.0, 0.16, 0.05, 3);
  c.restore();
}

// estómago (esófago arriba, duodeno a la derecha); ulcer 0..1 dibuja una úlcera en la curvatura menor
export function stomach(c, x, y, s, o = {}) {
  const { color = '#e07f86', ulcer = 0, lt = 0 } = o;
  c.save(); c.translate(x, y); c.scale(s, s);
  tube(c, cc => { cc.beginPath(); cc.moveTo(0.04, -0.7); cc.quadraticCurveTo(0.02, -0.55, 0.03, -0.42); }, 0.1, tone(color, -0.05));
  const P = cc => {
    cc.beginPath(); cc.moveTo(-0.02, -0.45);
    cc.bezierCurveTo(-0.3, -0.45, -0.44, -0.2, -0.38, 0.05);
    cc.bezierCurveTo(-0.32, 0.36, 0.08, 0.5, 0.3, 0.3);
    cc.bezierCurveTo(0.38, 0.24, 0.44, 0.2, 0.5, 0.18);
    cc.lineTo(0.5, 0.06);
    cc.bezierCurveTo(0.34, 0.1, 0.14, 0.18, 0.04, 0.05);
    cc.bezierCurveTo(-0.04, -0.06, 0.06, -0.3, 0.08, -0.45); cc.closePath();
  };
  volume(c, P, color, -0.05, -0.05, 0.5, { texture: 'soft', texA: 0.45, light: 0.6, dark: 0.55, edge: 0.6 });
  c.save(); P(c); c.clip(); c.lineCap = 'round';
  for (let i = 0; i < 7; i++) { // pliegues gástricos
    c.beginPath(); c.moveTo(-0.32 + i * 0.03, -0.25 + i * 0.07);
    c.bezierCurveTo(-0.15 + i * 0.03, -0.1 + i * 0.06, 0.05 + i * 0.03, 0.15 + i * 0.03, 0.4, 0.15 + i * 0.012);
    c.lineWidth = 0.012; c.strokeStyle = rgba(tone(color, -0.45), 0.5); c.stroke();
  }
  c.restore();
  if (ulcer > 0) {
    const ux = 0.07, uy = 0.1, pulse = 0.85 + 0.15 * Math.sin(lt * 5);
    c.save(); c.globalAlpha = ulcer;
    c.fillStyle = '#7a0a14'; c.beginPath(); c.ellipse(ux, uy, 0.06, 0.04, -0.4, 0, TAU); c.fill();
    c.strokeStyle = '#ff5a6a'; c.lineWidth = 0.012; c.shadowColor = '#ff2a3a'; c.shadowBlur = 20 * pulse; c.stroke();
    c.restore();
  }
  tube(c, cc => { cc.beginPath(); cc.moveTo(0.5, 0.12); cc.bezierCurveTo(0.62, 0.12, 0.64, 0.3, 0.56, 0.42); }, 0.1, tone(color, -0.05));
  c.restore();
}

// riñón con hilio, vasos y uréter
export function kidney(c, x, y, s, o = {}) {
  const { color = '#a83a3e', flip = false } = o;
  c.save(); c.translate(x, y); c.scale(flip ? -s : s, s);
  tube(c, cc => { cc.beginPath(); cc.moveTo(0.12, 0.05); cc.bezierCurveTo(0.28, 0.12, 0.3, 0.35, 0.26, 0.6); }, 0.05, '#e6c35a');
  tube(c, cc => { cc.beginPath(); cc.moveTo(0.1, -0.05); cc.lineTo(0.45, -0.1); }, 0.07, '#d8323a');
  tube(c, cc => { cc.beginPath(); cc.moveTo(0.1, 0.0); cc.lineTo(0.45, 0.02); }, 0.08, '#3e5ec0');
  const P = cc => {
    cc.beginPath(); cc.moveTo(0.08, -0.12);
    cc.bezierCurveTo(0.12, -0.42, -0.3, -0.48, -0.3, -0.1);
    cc.bezierCurveTo(-0.32, 0.25, 0.0, 0.48, 0.1, 0.18);
    cc.bezierCurveTo(0.02, 0.1, 0.0, -0.02, 0.08, -0.12); cc.closePath();
  };
  volume(c, P, color, -0.1, -0.03, 0.4, { texture: 'soft', texA: 0.5, light: 0.55, dark: 0.6, edge: 0.6 });
  c.restore();
}

// hueso largo (eje vertical antes de rotar). fracture 0..1 separa los fragmentos; hematoma 0..1
export function bone(c, x, y, s, o = {}) {
  const { rot = 0.35, fracture = 0, hematoma = 0, glowAmt = 1, lt = 0, color = '#e2d3b4' } = o;
  c.save(); c.translate(x, y); c.rotate(rot);
  const wS = 0.17 * s, L = s;
  const shape = cc => {
    cc.beginPath();
    cc.rect(-wS / 2, -L * 0.42, wS, L * 0.84);
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) { cc.moveTo(sx * 0.07 * s + 0.11 * s, sy * 0.45 * L); cc.arc(sx * 0.07 * s, sy * 0.45 * L, 0.11 * s, 0, TAU); }
  };
  // contorno: línea de fractura en zigzag a la mitad
  const zz = [];
  for (let i = 0; i <= 6; i++) zz.push([lerp(-wS * 0.75, wS * 0.75, i / 6), (i % 2 ? -1 : 1) * wS * 0.22 + (i === 3 ? wS * 0.1 : 0)]);
  const half = (top) => cc => { cc.beginPath(); cc.moveTo(-s, top ? -s : s); cc.lineTo(...zz[0]); zz.forEach(p => cc.lineTo(...p)); cc.lineTo(s, top ? -s : s); cc.closePath(); };
  const gap = fracture * s * 0.12, shift = fracture * s * 0.05;
  const drawHalf = (top) => {
    c.save();
    c.translate(top ? 0 : shift, top ? -gap / 2 : gap / 2); c.rotate(top ? 0 : fracture * 0.18);
    if (fracture > 0) { half(top)(c); c.clip(); }
    c.save(); shape(c); c.lineWidth = s * 0.012; c.strokeStyle = tone(color, -0.5); c.stroke(); c.restore();
    volume(c, shape, color, 0, 0, s * 0.45, { texture: 'marble', texA: 0.6, light: 0.5, dark: 0.55, edge: 0.4, lx: -0.5, ly: -0.2 });
    if (fracture > 0) { // borde roto brillante
      c.beginPath(); zz.forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, ...p));
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.shadowColor = '#ff2a3a'; c.shadowBlur = 30 * glowAmt;
      c.strokeStyle = rgba('#ff3a4a', glowAmt); c.lineWidth = s * 0.03; c.stroke();
      c.shadowBlur = 0; c.strokeStyle = rgba('#ffe0e0', glowAmt); c.lineWidth = s * 0.01; c.stroke();
    }
    c.restore();
  };
  if (fracture > 0) { drawHalf(true); drawHalf(false); } else drawHalf(true);
  if (fracture > 0 && glowAmt > 0) glow(c, shift / 2, 0, s * 0.18 * (0.8 + 0.2 * Math.sin(lt * 4)), '#ffffff', 0.7 * glowAmt * fracture);
  if (hematoma > 0) {
    c.save(); c.globalAlpha = hematoma;
    const hp = []; const r = rng(5);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; hp.push([Math.cos(a) * (0.75 + 0.3 * r()), Math.sin(a) * (0.6 + 0.25 * r())]); }
    const P = cc => blobPath(cc, hp, shift / 2, 0, s * 0.2);
    c.save(); P(c); c.shadowColor = '#ff3040'; c.shadowBlur = 30; c.strokeStyle = '#ff6a78'; c.lineWidth = s * 0.012; c.stroke(); c.restore();
    volume(c, P, '#b8121e', 0, 0, s * 0.2, { texture: null, light: 0.5, dark: 0.6, edge: 0.6 });
    c.save(); P(c); c.clip();
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * s * 0.17;
      rbc(c, shift / 2 + Math.cos(a) * d, Math.sin(a) * d * 0.8, s * 0.022, r() * TAU + lt * 0.3, 0.5 + 0.5 * r(), { flat: true });
    }
    c.strokeStyle = 'rgba(255,220,220,0.35)'; c.lineWidth = s * 0.003; // fibrina
    for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo((r() - 0.5) * s * 0.4, (r() - 0.5) * s * 0.3); c.lineTo((r() - 0.5) * s * 0.4, (r() - 0.5) * s * 0.3); c.stroke(); }
    c.restore(); c.restore();
  }
  c.restore();
}

// ---------------------------------------------------------------- células
export function rbc(c, x, y, r, rot = 0, tilt = 1, o = {}) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, Math.max(0.15, tilt));
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, '#8a0c16'); g.addColorStop(0.45, '#a8121c'); g.addColorStop(0.8, '#e2373e'); g.addColorStop(1, '#a3101a');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  if (!o.flat) {
    c.strokeStyle = 'rgba(255,170,170,0.45)'; c.lineWidth = r * 0.12;
    c.beginPath(); c.arc(0, 0, r * 0.8, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
  } else {
    c.strokeStyle = 'rgba(255,190,190,0.6)'; c.lineWidth = r * 0.18; c.beginPath(); c.arc(0, 0, r * 0.82, 0, TAU); c.stroke();
  }
  c.restore();
}

// óvulo con zona pelúcida, corona radiata y espermatozoides que nadan hacia él (approach 0..1)
export function ovum(c, x, y, r, lt, o = {}) {
  const { sperms = 14, approach = 1, color = '#f2b2a8' } = o;
  const rr = rng(13);
  // espermatozoides (detrás de la corona)
  const sp = [];
  for (let i = 0; i < sperms; i++) sp.push({ a: rr() * TAU, d0: lerp(2.6, 4.2, rr()), ph: rr() * TAU, sp: 0.7 + rr() * 0.6 });
  const drawSperm = k => {
    const d = lerp(k.d0, 1.2 + 0.05 * Math.sin(lt * 3 + k.ph), easeOut(clamp(approach * k.sp)));
    const a = k.a + 0.05 * Math.sin(lt * 2 + k.ph);
    const hx = x + Math.cos(a) * r * d, hy = y + Math.sin(a) * r * d;
    // cola ondulante hacia fuera
    c.save(); c.lineCap = 'round';
    for (let j = 0; j < 14; j++) {
      const t0 = j / 14, t1 = (j + 1) / 14;
      const pt = t => {
        const along = r * (0.08 + t * 1.1), wave = Math.sin(t * 9 - lt * 14 + k.ph) * r * 0.06 * t;
        return [hx + Math.cos(a) * along - Math.sin(a) * wave, hy + Math.sin(a) * along + Math.cos(a) * wave];
      };
      const [x0, y0] = pt(t0), [x1, y1] = pt(t1);
      c.strokeStyle = `rgba(255,240,245,${0.85 * (1 - t0 * 0.8)})`; c.lineWidth = r * 0.022 * (1 - t0 * 0.7);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    c.translate(hx, hy); c.rotate(a);
    glow(c, 0, 0, r * 0.14, '#ffffff', 0.5);
    c.fillStyle = '#fff8fa'; c.beginPath(); c.ellipse(0, 0, r * 0.075, r * 0.05, 0, 0, TAU); c.fill();
    c.restore();
  };
  sp.forEach(drawSperm);
  // corona radiata
  for (let i = 0; i < 90; i++) {
    const a = rr() * TAU, d = r * lerp(1.18, 1.55, rr()), cr = r * lerp(0.04, 0.08, rr());
    ball(c, x + Math.cos(a) * d, y + Math.sin(a) * d, cr, tone('#e9a0b4', lerp(-0.15, 0.15, rr())), { light: 0.7 });
  }
  // zona pelúcida
  c.save();
  c.fillStyle = 'rgba(255,220,235,0.16)'; c.beginPath(); c.arc(x, y, r * 1.14, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,235,245,0.55)'; c.lineWidth = r * 0.012; c.stroke();
  c.restore();
  volume(c, k => { k.beginPath(); k.arc(x, y, r, 0, TAU); }, color, x, y, r, { texture: 'speckle', texA: 0.6, light: 0.75, dark: 0.45, edge: 0.4 });
  c.save(); c.strokeStyle = 'rgba(255,240,240,0.35)'; c.lineWidth = r * 0.008; c.beginPath(); c.arc(x, y, r * 0.86, 0, TAU); c.stroke(); c.restore();
}

// neurona ilustrada; pulse 0..1 = posición del impulso a lo largo del axón (negativo = sin impulso)
export function neuron(c, x, y, s, o = {}) {
  const { color = '#7fb4ff', pulse = -1, glowColor = '#ffe27a', seed = 3, rot = 0 } = o;
  const r = rng(seed);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.lineCap = 'round';
  // dendritas ramificadas
  const dend = (x0, y0, a, len, w, d) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    const mx = (x0 + x1) / 2 + (r() - 0.5) * len * 0.4, my = (y0 + y1) / 2 + (r() - 0.5) * len * 0.4;
    tube(c, cc => { cc.beginPath(); cc.moveTo(x0, y0); cc.quadraticCurveTo(mx, my, x1, y1); }, w, color, { shine: 0.5 });
    if (d > 0) { dend(x1, y1, a - 0.5 + (r() - 0.5) * 0.3, len * 0.7, w * 0.65, d - 1); dend(x1, y1, a + 0.45 + (r() - 0.5) * 0.3, len * 0.7, w * 0.65, d - 1); }
  };
  for (let i = 0; i < 6; i++) dend(0, 0, Math.PI * 0.5 + (i / 6) * Math.PI * 1.1 + 0.3, 0.16, 0.045, 2);
  // axón con mielina hasta los botones terminales
  const ax = t => [0.08 + t * 0.85, Math.sin(t * 3) * 0.05];
  tube(c, cc => { cc.beginPath(); for (let i = 0; i <= 30; i++) { const [px, py] = ax(i / 30); i ? cc.lineTo(px, py) : cc.moveTo(px, py); } }, 0.022, color);
  for (let i = 0; i < 6; i++) {
    const t = 0.1 + i * 0.13, [px, py] = ax(t), [qx, qy] = ax(t + 0.1);
    tube(c, cc => { cc.beginPath(); cc.moveTo(px, py); cc.lineTo(qx, qy); }, 0.05, '#e9eef8', { shine: 0.6 });
  }
  const [ex, ey] = ax(1);
  for (let i = -2; i <= 2; i++) {
    const tx = ex + 0.1, ty = ey + i * 0.05;
    tube(c, cc => { cc.beginPath(); cc.moveTo(ex, ey); cc.quadraticCurveTo(ex + 0.05, ey + i * 0.02, tx, ty); }, 0.015, color);
    ball(c, tx, ty, 0.02, tone(color, 0.2));
  }
  // soma y núcleo
  volume(c, cc => blobPath(cc, [[0.11, 0], [0.06, 0.09], [-0.06, 0.1], [-0.12, 0.02], [-0.08, -0.09], [0.04, -0.1]], 0, 0, 1), color, 0, 0, 0.11, { texture: 'speckle', texA: 0.4 });
  ball(c, -0.01, 0, 0.04, tone(color, -0.35));
  if (pulse >= 0 && pulse <= 1) {
    const [px, py] = ax(pulse);
    glow(c, px, py, 0.09, glowColor, 1); glow(c, px, py, 0.03, '#ffffff', 1);
  }
  c.restore();
}

// ---------------------------------------------------------------- fármacos e instrumental
// comprimido: type 'round' (blanco ranurado), 'oval' (azul) o 'capsule' (dos colores)
export function pill(c, x, y, r, o = {}) {
  const { type = 'round', color = type === 'round' ? '#f4f4f6' : type === 'oval' ? '#2f6fe0' : '#e0443c', color2 = '#f4f1ea', rot = 0, shadow = true } = o;
  if (shadow) dropShadow(c, x + r * 0.15, y + r * 0.35, r * 0.9, r * 0.35, 0.4);
  c.save(); c.translate(x, y); c.rotate(rot);
  if (type === 'capsule') {
    const P = (a, b) => cc => { cc.beginPath(); cc.moveTo(a, -r * 0.42); cc.lineTo(b, -r * 0.42); cc.arc(b, 0, r * 0.42, -Math.PI / 2, Math.PI / 2, b < a); cc.lineTo(a, r * 0.42); cc.closePath(); };
    volume(c, P(0, -r * 0.58), color, -r * 0.4, 0, r * 0.6, { texture: null, edge: 0.3, light: 0.8 });
    volume(c, P(0, r * 0.58), color2, r * 0.4, 0, r * 0.6, { texture: null, edge: 0.3, light: 0.8 });
  } else {
    const rx = type === 'oval' ? r * 1.25 : r, ry = type === 'oval' ? r * 0.75 : r;
    const P = cc => { cc.beginPath(); cc.ellipse(0, 0, rx, ry, 0, 0, TAU); };
    volume(c, P, color, 0, 0, Math.max(rx, ry), { texture: 'soft', texA: 0.2, light: 0.75, dark: 0.45, edge: 0.45 });
    c.strokeStyle = rgba(tone(color, -0.45), 0.8); c.lineWidth = r * 0.06; // ranura
    c.beginPath(); c.moveTo(-rx * 0.75, ry * 0.15); c.lineTo(rx * 0.75, -ry * 0.15); c.stroke();
    c.strokeStyle = rgba(tone(color, 0.6), 0.7); c.lineWidth = r * 0.025;
    c.beginPath(); c.moveTo(-rx * 0.75, ry * 0.15 + r * 0.05); c.lineTo(rx * 0.75, -ry * 0.15 + r * 0.05); c.stroke();
  }
  c.restore();
}

// jeringa; fill 0..1 = líquido, plunger 0..1 = émbolo apretado
export function syringe(c, x, y, s, o = {}) {
  const { rot = 0, fill = 0.6, liquid = '#ff5a8a', plunger = 0 } = o;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const bx = -0.3, bw = 0.6, bh = 0.13;
  // aguja
  c.strokeStyle = '#c9d2de'; c.lineWidth = 0.012; c.beginPath(); c.moveTo(bx + bw + 0.04, 0); c.lineTo(bx + bw + 0.32, 0); c.stroke();
  c.fillStyle = '#9aa6b8'; c.fillRect(bx + bw, -0.025, 0.05, 0.05);
  // émbolo
  const px = bx + 0.02 + plunger * (bw - 0.1);
  c.fillStyle = '#e8ecf3'; c.fillRect(px - 0.3, -0.018, 0.3, 0.036); c.fillRect(px - 0.33, -0.08, 0.03, 0.16);
  // líquido y cilindro
  const lw = (bw - 0.04) * fill * (1 - plunger);
  c.fillStyle = rgba(liquid, 0.85); c.fillRect(bx + bw - 0.02 - lw, -bh / 2 + 0.01, lw, bh - 0.02);
  c.fillStyle = '#3a3f4a'; c.fillRect(px - 0.005, -bh / 2 + 0.005, 0.03, bh - 0.01);
  roundRectP(c, bx, -bh / 2, bw, bh, 0.03);
  c.fillStyle = 'rgba(230,240,255,0.18)'; c.fill(); c.strokeStyle = 'rgba(240,246,255,0.85)'; c.lineWidth = 0.008; c.stroke();
  c.strokeStyle = 'rgba(40,50,70,0.6)'; c.lineWidth = 0.004;
  for (let i = 1; i < 10; i++) { const gx = bx + i * bw / 10; c.beginPath(); c.moveTo(gx, -bh / 2); c.lineTo(gx, -bh / 2 + (i % 2 ? 0.03 : 0.05)); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(bx + 0.03, -bh / 2 + 0.015, bw - 0.06, 0.012);
  c.fillStyle = '#e8ecf3'; c.fillRect(bx - 0.02, -0.11, 0.02, 0.22);
  c.restore();
}

// ---------------------------------------------------------------- personaje
// pose: 'pie' | 'correr' | 'tumbado' | 'caer' | 'sentado' (o un objeto de ángulos); h = altura en px; (x, y) = cadera
const POSES = {
  pie: { torso: 0, head: 0, ua: [0.15, -0.15], la: [0.1, -0.1], ul: [0.06, -0.06], ll: [0, 0], rot: 0 },
  sentado: { torso: 0.05, head: 0.05, ua: [0.3, -0.1], la: [-0.9, -1.1], ul: [1.5, 1.45], ll: [1.5, 1.45], rot: 0 },
  tumbado: { torso: 0, head: 0.1, ua: [0.2, -0.2], la: [0.1, -0.1], ul: [0.05, -0.05], ll: [0, 0], rot: -Math.PI / 2 },
  caer: { torso: 0.35, head: 0.4, ua: [-2.2, 1.6], la: [-0.6, 0.5], ul: [-0.5, 0.4], ll: [0.6, 0.3], rot: -0.6 },
};
export function person(c, x, y, h, o = {}) {
  const { pose = 'pie', lt = 0, shirt = '#2f6fe0', pants = '#1e2a4a', skin = '#f2b48a', hair = '#2a1a12', shoes = '#f0f0f0', eyes = 'open', speed = 1 } = o;
  let P = typeof pose === 'object' ? pose : POSES[pose];
  if (pose === 'correr') {
    const ph = lt * 9 * speed, sw = Math.sin(ph);
    P = { torso: -0.18, head: -0.1, ua: [0.9 * sw, -0.9 * sw], la: [-1.4 + 0.3 * sw, -1.4 - 0.3 * sw], ul: [-0.9 * sw - 0.2, 0.9 * sw - 0.2], ll: [0.9 + 0.6 * Math.max(0, -sw), 0.9 + 0.6 * Math.max(0, sw)], rot: 0, bob: Math.abs(Math.cos(ph)) * 0.03 };
  }
  const U = h;
  c.save(); c.translate(x, y - (P.bob || 0) * U); c.rotate(P.rot || 0);
  const limb = (x0, y0, a, len, w, col) => { // a: ángulo desde la vertical hacia abajo (positivo = hacia delante/derecha)
    const x1 = x0 + Math.sin(a) * len, y1 = y0 + Math.cos(a) * len;
    tube(c, cc => { cc.beginPath(); cc.moveTo(x0, y0); cc.lineTo(x1, y1); }, w, col, { shine: 0.35 });
    return [x1, y1];
  };
  const ta = P.torso, neck = [Math.sin(ta) * -0.3 * U * -1, -Math.cos(ta) * 0.3 * U];
  const sh = [neck[0], neck[1] + 0.03 * U];
  const side = (i, back) => {
    // brazo y pierna de un lado (back = detrás, más oscuro)
    const dk = back ? -0.25 : 0;
    const [kx, ky] = limb(0, 0, P.ul[i] + ta * 0, 0.24 * U, 0.075 * U, tone(pants, dk));
    const [fx, fy] = limb(kx, ky, P.ul[i] + P.ll[i] * -1 + 0, 0.24 * U, 0.065 * U, tone(pants, dk));
    c.save(); c.fillStyle = tone(shoes, dk * 0.6); c.beginPath(); c.ellipse(fx + 0.03 * U, fy + 0.01 * U, 0.055 * U, 0.03 * U, 0, 0, TAU); c.fill(); c.restore();
    return () => {
      const [ex, ey] = limb(sh[0], sh[1], P.ua[i] + ta, 0.17 * U, 0.06 * U, tone(shirt, dk));
      const [hx, hy] = limb(ex, ey, P.ua[i] + ta + P.la[i] * -1, 0.16 * U, 0.05 * U, tone(skin, dk));
      ball(c, hx, hy, 0.033 * U, tone(skin, dk), { light: 0.5 });
    };
  };
  const backArm = side(1, true);
  backArm();
  const frontArm = side(0, false);
  // torso
  tube(c, cc => { cc.beginPath(); cc.moveTo(0, -0.02 * U); cc.lineTo(neck[0], neck[1] + 0.06 * U); }, 0.16 * U, shirt, { shine: 0.3 });
  // cabeza
  const hd = [neck[0] + Math.sin(ta + P.head) * 0.1 * U, neck[1] - Math.cos(ta + P.head) * 0.1 * U];
  ball(c, hd[0], hd[1], 0.085 * U, skin, { light: 0.5 });
  c.save(); c.beginPath(); c.arc(hd[0], hd[1], 0.088 * U, 0, TAU); c.clip();
  c.fillStyle = hair; c.beginPath(); c.ellipse(hd[0] - 0.01 * U, hd[1] - 0.075 * U, 0.1 * U, 0.06 * U, ta + P.head, 0, TAU); c.fill();
  c.restore();
  c.save(); c.translate(hd[0], hd[1]); c.rotate(ta + P.head);
  c.strokeStyle = '#3a2418'; c.fillStyle = '#3a2418'; c.lineWidth = 0.008 * U; c.lineCap = 'round';
  for (const ex of [0.015, 0.05]) {
    if (eyes === 'open') { c.beginPath(); c.arc(ex * U, 0.005 * U, 0.009 * U, 0, TAU); c.fill(); } else { c.beginPath(); c.arc(ex * U, 0.0, 0.012 * U, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  }
  c.restore();
  frontArm();
  c.restore();
}
export { POSES };
