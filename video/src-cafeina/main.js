// Short 9:16 · «¿Por qué la cafeína te quita el sueño?» (versión 100 % código)
// Mismo guion que la versión con IA (video/ia/proyectos/cafeina): cerebro → receptor → cafeína.
// Three.js dibuja el tejido brillante (materiales físicos con clearcoat y sheen, mapa de entorno procedural)
// en tres pasadas por profundidad (fondo desenfocado, plano nítido, primer plano desenfocado).
// Canvas 2D añade fondo, bokeh, etiquetas, palabra clave, grano y viñeta.
// window.renderFrame(t) dibuja el instante t (segundos) y devuelve el fotograma.
import * as THREE from '/three/three.module.js';

const W = 1080, H = 1920;
const out = document.getElementById('out');
const ctx = out.getContext('2d');

// ---------------------------------------------------------------- utilidades
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const TAU = Math.PI * 2;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const inOut = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));
function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// ruido suave determinista (suma de senos) para deformar superficies orgánicas
const nz = (x, y, z) => Math.sin(x * 1.7 + Math.sin(y * 2.3)) * Math.sin(y * 1.9 + Math.sin(z * 2.1)) * Math.sin(z * 2.2 + Math.sin(x * 1.6));
const fbm = (x, y, z) => nz(x, y, z) * 0.6 + nz(x * 2.1 + 3, y * 2.1, z * 2.1) * 0.28 + nz(x * 4.3, y * 4.3 + 7, z * 4.3) * 0.12;

// ---------------------------------------------------------------- 2D: brillos, texto, etiquetas
const glowCache = new Map();
function glowSprite(color, hard = false) {
  const key = color + hard;
  if (glowCache.has(key)) return glowCache.get(key);
  const s = 128, c = offscreen(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  if (hard) {
    gr.addColorStop(0, color); gr.addColorStop(0.8, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    gr.addColorStop(0, color); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  }
  g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  glowCache.set(key, c);
  return c;
}
function glow(c, x, y, r, color, a = 1, hard = false) {
  if (a <= 0.003 || r <= 0.5) return;
  c.save(); c.globalAlpha *= a; c.globalCompositeOperation = 'lighter';
  c.drawImage(glowSprite(color, hard), x - r, y - r, r * 2, r * 2);
  c.restore();
}
function bokehField(c, seed, lt, n, colors, o = {}) {
  const r = rng(seed);
  const { rMin = 10, rMax = 60, alpha = 0.35, drift = 14 } = o;
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, rad = lerp(rMin, rMax, r() * r());
    const col = colors[Math.floor(r() * colors.length)];
    const ph = r() * TAU, sp = 0.3 + r();
    const xx = x + Math.sin(lt * 0.4 * sp + ph) * drift, yy = y + Math.cos(lt * 0.3 * sp + ph) * drift - lt * 10 * sp;
    glow(c, xx, yy, rad, col, alpha * (0.4 + 0.6 * r()), true);
  }
}
function dust(c, seed, lt, n, color, alpha = 0.6) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, s = 2 + r() * 4, sp = 6 + r() * 20, ph = r() * TAU;
    const yy = (y - lt * sp + H * 10) % H, xx = x + Math.sin(lt * 0.5 + ph) * 16;
    glow(c, xx, yy, s * 3, color, alpha * (0.3 + 0.7 * Math.abs(Math.sin(lt * 0.8 + ph))));
  }
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
// píldora oscura con texto y línea guía hacia un punto (mismo estilo que video/ia/montar.py)
function pill(c, text, x, y, a, anchor) {
  if (a <= 0.01) return;
  c.save();
  c.globalAlpha = a;
  c.font = '600 38px "Inter"';
  const w = c.measureText(text).width + 52, h = 64;
  const bx = x - w / 2, by = y - h / 2;
  if (anchor) {
    const [px, py] = anchor;
    const ex = clamp(px, bx, bx + w), ey = py > by + h ? by + h : py < by ? by : py;
    const k = easeOut(clamp(a));
    c.strokeStyle = 'rgba(255,255,255,0.88)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(lerp(ex, px, k), lerp(ey, py, k)); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(lerp(ex, px, k), lerp(ey, py, k), 7, 0, TAU); c.fill();
  }
  c.fillStyle = 'rgba(20,20,24,0.66)';
  roundRect(c, bx, by, w, h, 14); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x, y + 1);
  c.restore();
}
function keyword(c, text, lt, a0) {
  const k = seg(lt, a0, a0 + 0.5);
  if (k <= 0) return;
  const e = easeOut(k);
  c.save();
  c.globalAlpha = k;
  c.font = '700 92px "Inter Display"';
  c.letterSpacing = (1 - e) * 14 + 2 + 'px';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.filter = `blur(${((1 - e) * 10).toFixed(1)}px)`;
  c.shadowColor = 'rgba(0,0,0,0.75)'; c.shadowBlur = 28;
  c.fillStyle = '#fff';
  c.fillText(text, W / 2, H * 0.84 + (1 - e) * 24);
  c.restore();
}

// ---------------------------------------------------------------- post: grano y viñeta
const grains = [];
{
  const r = rng(99);
  for (let i = 0; i < 6; i++) {
    const g = offscreen(540, 960), gx = g.getContext('2d'), id = gx.createImageData(540, 960);
    for (let p = 0; p < id.data.length; p += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 110;
      id.data[p] = id.data[p + 1] = id.data[p + 2] = v; id.data[p + 3] = 255;
    }
    gx.putImageData(id, 0, 0);
    grains.push(g);
  }
}
const vignette = (() => {
  const v = offscreen(W, H), g = v.getContext('2d');
  const gr = g.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.62)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return v;
})();
function post(c, t) {
  c.drawImage(vignette, 0, 0);
  c.save();
  c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.22;
  c.drawImage(grains[Math.floor(t * 30) % grains.length], 0, 0, W, H);
  c.restore();
}
function background(c, top, mid, bottom) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- THREE: renderer, entorno y materiales
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const glCanvas = renderer.domElement;

// mapa de entorno: cúpula oscura verde azulada con paneles de luz cálida y rosada (reflejos húmedos)
const envMap = (() => {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x14262c, side: THREE.BackSide })));
  const panel = (col, x, y, z, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(0xfff1e0, -8, 10, 8, 10, 6);
  panel(0xffb0a0, 10, 4, -6, 8, 8);
  panel(0x7fd8e8, -10, -2, -8, 8, 8);
  panel(0xffffff, 4, 12, 10, 4, 4);
  const pm = new THREE.PMREMGenerator(renderer);
  return pm.fromScene(s, 0.03).texture;
})();

function lights(scene) {
  const add = l => { l.layers.enableAll(); scene.add(l); return l; };
  add(new THREE.HemisphereLight(0xffe2d6, 0x1c3038, 0.55));
  const key = add(new THREE.DirectionalLight(0xfff0e4, 2.2)); key.position.set(-3, 5, 4);
  const rim = add(new THREE.DirectionalLight(0xff9f8a, 2.4)); rim.position.set(3, 2, -5);
  const fill = add(new THREE.DirectionalLight(0x8fd6ea, 0.8)); fill.position.set(4, -3, 2);
  scene.environment = envMap;
}

const tissueMat = (o = {}) => new THREE.MeshPhysicalMaterial({
  color: 0xe27b67, roughness: 0.36, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.22,
  sheen: 0.7, sheenColor: new THREE.Color(0xffc2ad), sheenRoughness: 0.45,
  emissive: new THREE.Color(0x4a120a), emissiveIntensity: 0.55, envMapIntensity: 0.9, ...o,
});
const glossy = (color, emissive, ei = 0.35, o = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4,
  sheenColor: new THREE.Color(0xffffff), emissive: new THREE.Color(emissive), emissiveIntensity: ei, envMapIntensity: 1.1, ...o,
});

// normales suaves para geometría no indexada (agrupa vértices por posición)
function smoothNormals(geo) {
  const pos = geo.attributes.position, n = pos.count, acc = new Map(), keys = new Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  const key = i => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  for (let i = 0; i < n; i++) keys[i] = key(i);
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    fn.subVectors(b, a).cross(c.clone().sub(a));
    for (let k = 0; k < 3; k++) {
      const v = acc.get(keys[i + k]) || new THREE.Vector3();
      v.add(fn); acc.set(keys[i + k], v);
    }
  }
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = acc.get(keys[i]).clone().normalize();
    nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
// esfera irregular: desplaza cada vértice a lo largo de su dirección radial
function blob(radius, detail, amp, freq, seed, fn = fbm) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize();
    v.addScaledVector(d, amp * fn(v.x * freq + seed, v.y * freq, v.z * freq - seed));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return smoothNormals(geo);
}
// tubo que se estrecha de r0 a r1 (dendritas)
function taperTube(curve, segs, r0, r1, radial = 10) {
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = geo.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / (radial + 1)), u = ring / segs;
    curve.getPointAt(u, c);
    v.fromBufferAttribute(p, i).sub(c).multiplyScalar(lerp(r0, r1, Math.pow(u, 0.7)) * (1 + 0.12 * Math.sin(u * 23)));
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  return geo;
}
function onLayer(obj, l) { obj.traverse(o => o.layers.set(l)); return obj; }

const glowTex = (() => {
  const s = 128, c = offscreen(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function glowSprite3(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- neurona (soma + dendritas ramificadas)
function neuron(seed, mat, o = {}) {
  const r = rng(seed), g = new THREE.Group(), curves = [];
  const rv = () => new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
  const soma = new THREE.Mesh(blob(o.soma ?? 0.34, 5, 0.1, 2.6, seed), mat);
  soma.scale.set(1, 0.82, 1); g.add(soma);
  const branch = (p0, dir, steps, len, r0, r1, depth) => {
    const pts = [p0.clone()]; let p = p0.clone(); const d = dir.clone();
    for (let j = 0; j < steps; j++) {
      d.add(rv().multiplyScalar(0.45)).normalize();
      p = p.clone().addScaledVector(d, len * (0.8 + r() * 0.4)); pts.push(p);
    }
    const cv = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(taperTube(cv, steps * 10, r0, r1), mat));
    curves.push(cv);
    if (depth > 0) {
      for (let k = 0; k < 2; k++) {
        const u = 0.35 + r() * 0.4, q = cv.getPointAt(u), t = cv.getTangentAt(u);
        branch(q, t.add(rv().multiplyScalar(0.9)).normalize(), steps - 1, len * 0.75, lerp(r0, r1, u) * 0.8, r1 * 0.6, depth - 1);
      }
    }
  };
  const n = o.dendrites ?? 7;
  for (let k = 0; k < n; k++) {
    const d = rv().normalize();
    branch(d.clone().multiplyScalar(0.25), d, o.steps ?? 6, o.len ?? 0.42, 0.16, 0.025, o.depth ?? 1);
  }
  return { group: g, curves };
}
// impulsos eléctricos que recorren las dendritas
function pulses(scene, curves, seed, color, n, layer) {
  const r = rng(seed), list = [];
  for (let i = 0; i < n; i++) {
    const cv = curves[Math.floor(r() * curves.length)], trail = [];
    for (let k = 0; k < 5; k++) {
      const s = glowSprite3(k === 0 ? 0xffffff : color, 0.42 - k * 0.06, 1 - k * 0.17);
      if (layer != null) s.layers.set(layer);
      scene.add(s); trail.push(s);
    }
    list.push({ cv, trail, ph: r(), sp: 0.6 + r() * 0.6, inward: r() < 0.5 });
  }
  return (lt, amount) => {
    for (const { cv, trail, ph, sp, inward } of list) {
      const u0 = (lt * sp + ph) % 1.3;
      trail.forEach((s, k) => {
        const u = u0 - k * 0.03;
        s.visible = amount > 0.01 && u >= 0 && u <= 1;
        if (s.visible) { cv.getPointAt(inward ? 1 - u : u, s.position); s.material.opacity = amount * (1 - k * 0.17); }
      });
    }
  };
}

// ---------------------------------------------------------------- moléculas (purina: anillos de 6 y 5 fusionados)
const PURINE = (() => {
  const P = [];
  for (let k = 0; k < 6; k++) { const a = (30 + 60 * k) * Math.PI / 180; P.push([Math.cos(a), Math.sin(a)]); }
  const cx = 0.866 + 0.688;
  for (const deg of [72, 0, -72]) { const a = deg * Math.PI / 180; P.push([cx + 0.851 * Math.cos(a), 0.851 * Math.sin(a)]); }
  return P; // índices 0..5 hexágono, 6..8 pentágono
})();
const ADENOSINE = [...PURINE, [0, 2], // NH2 en C6
  ...(() => { // ribosa unida a N9
    const n9 = PURINE[8], dir = [0.309, -0.951], c1 = [n9[0] + dir[0], n9[1] + dir[1]], cc = [c1[0] + dir[0] * 0.85, c1[1] + dir[1] * 0.85];
    const base = Math.atan2(-dir[1], -dir[0]), R = [];
    for (let k = 0; k < 5; k++) { const a = base + k * TAU / 5; R.push([cc[0] + 0.851 * Math.cos(a), cc[1] + 0.851 * Math.sin(a)]); }
    return [...R, [cc[0] + dir[0] * 1.6, cc[1] + dir[1] * 1.6 + 0.4]];
  })()];
const CAFFEINE = [...PURINE, [-1.732, 1.0], [0, -2], [0, 2.0], [-1.732, -1.0], [2.13, 1.76]]; // 2 O y 3 metilos
function molecule(atoms, mat, bond = 0.14, rad = 0.085) {
  const g = new THREE.Group(), r = rng(atoms.length * 7);
  let cx = 0, cy = 0;
  for (const [x, y] of atoms) { cx += x; cy += y; }
  cx /= atoms.length; cy /= atoms.length;
  const geo = new THREE.SphereGeometry(1, 20, 14);
  for (const [x, y] of atoms) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set((x - cx) * bond, (y - cy) * bond, (r() - 0.5) * 0.05);
    m.scale.setScalar(rad * (0.92 + r() * 0.2));
    g.add(m);
  }
  return g;
}
const adeMat = glossy(0x8fd3ee, 0x0e3a4a, 0.5);
const cafMat = glossy(0xffc21c, 0x5a3300, 0.45);

// ---------------------------------------------------------------- cerebro difuso de fondo
function brainMesh(mat) {
  const gyri = (x, y, z) => -Math.abs(Math.sin(x * 9 + Math.sin(y * 7) * 1.6 + Math.sin(z * 8) * 1.2)) * 0.6 + fbm(x * 3, y * 3, z * 3) * 0.4;
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(blob(1, 40, 0.07, 1, s * 3, gyri), mat);
    m.scale.set(0.62, 0.8, 1.15); m.position.x = s * 0.64; g.add(m);
  }
  return g;
}

// ================================================================ ESCENA A · cerebro: se acumula adenosina en la sinapsis
const A = (() => {
  const scene = new THREE.Scene(); lights(scene);
  const mat = tissueMat(), farMat = tissueMat({ emissiveIntensity: 0.8 });
  const syn = new THREE.Vector3(0, 0.2, 0);
  const n1 = neuron(3, mat, { dendrites: 6 }); n1.group.position.set(-1.7, 1.5, -0.9); scene.add(n1.group);
  const n2 = neuron(8, mat, { dendrites: 6 }); n2.group.position.set(1.6, -1.5, -0.6); scene.add(n2.group);
  const all = [n1, n2];
  for (const [s, p, l] of [[13, [2.5, 2.3, -2.2], 0], [17, [-2.4, -2.2, -1.6], 0], [23, [0.4, 3.8, -4.5], 1],
    [29, [-3.0, 0.6, -5.5], 1], [31, [3.2, -3.0, -6.0], 1], [37, [1.2, 1.0, 4.4], 2], [41, [-1.3, -2.6, 3.6], 2]]) {
    const n = neuron(s, l === 1 ? farMat : mat, { dendrites: 7 });
    n.group.position.set(...p); onLayer(n.group, l); scene.add(n.group); all.push(n);
  }
  // dendritas de n1 y n2 que se encuentran en la sinapsis (en coordenadas del mundo)
  for (const [n, off, seed] of [[n1, [-0.16, 0.1, 0], 71], [n2, [0.16, -0.12, 0], 77]]) {
    const r = rng(seed), a = n.group.position.clone(), b = syn.clone().add(new THREE.Vector3(...off));
    const pts = []; for (let j = 0; j <= 6; j++) pts.push(a.clone().lerp(b, j / 6).add(j && j < 6 ? new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.35) : new THREE.Vector3()));
    scene.add(new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(pts), 60, 0.12, 0.05), mat));
  }
  // botones sinápticos brillantes
  const knobA = new THREE.Mesh(blob(0.14, 4, 0.03, 4, 1), glossy(0xff7fb8, 0xff3f8f, 1.2));
  knobA.position.copy(syn).add(new THREE.Vector3(-0.16, 0.1, 0)); scene.add(knobA);
  const knobB = new THREE.Mesh(blob(0.13, 4, 0.03, 4, 2), glossy(0xffd27a, 0xffa020, 1.1));
  knobB.position.copy(syn).add(new THREE.Vector3(0.16, -0.12, 0)); scene.add(knobB);
  const gA = glowSprite3(0xff5fa8, 0.9, 0.8); gA.position.copy(knobA.position); scene.add(gA);
  const gB = glowSprite3(0xffc050, 0.8, 0.8); gB.position.copy(knobB.position); scene.add(gB);
  const brain = onLayer(brainMesh(tissueMat({ color: 0xf0a49a, emissiveIntensity: 0.9 })), 1);
  brain.position.set(-0.6, 4.6, -9); brain.scale.setScalar(2.6); brain.rotation.set(0.2, 0.5, 0.1); scene.add(brain);
  // adenosina: cuentas azul pálido que convergen en la sinapsis
  const N = 120, beads = 3, im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), adeMat, N * beads);
  scene.add(im);
  const r = rng(5), mols = [];
  for (let i = 0; i < N; i++) {
    const start = new THREE.Vector3((r() - 0.5) * 6, (r() - 0.5) * 8, (r() - 0.5) * 3 - 0.5);
    const off = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.2 + 0.45 * Math.cbrt(r()));
    mols.push({ start, end: syn.clone().add(off), delay: 0.1 + r() * 2.6, ph: r() * TAU, sp: 0.5 + r(), size: 0.035 + r() * 0.015 });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.05, 60);
  function update(lt) {
    mols.forEach((m, i) => {
      const k = easeIO(seg(lt, m.delay, m.delay + 1.7));
      P.lerpVectors(m.start, m.end, k);
      P.x += Math.sin(lt * m.sp + m.ph) * 0.08 * (1 - k); P.y += Math.cos(lt * m.sp * 0.8 + m.ph) * 0.08 * (1 - k);
      E.set(lt * m.sp + m.ph, lt * 0.7 + m.ph, 0); Q.setFromEuler(E);
      for (let b = 0; b < beads; b++) {
        const a = b * TAU / beads;
        const o = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(m.size * 1.3).applyQuaternion(Q);
        S.setScalar(m.size);
        M.compose(P.clone().add(o), Q, S);
        im.setMatrixAt(i * beads + b, M);
      }
    });
    im.instanceMatrix.needsUpdate = true;
    const k = easeIO(seg(lt, 0, 4.2));
    cam.position.set(lerp(0.5, 0.05, k), lerp(0.6, 0.3, k), lerp(8.2, 4.0, k));
    cam.lookAt(syn.x, syn.y - 0.05, 0); cam.updateMatrixWorld();
    knobA.material.emissiveIntensity = 1.0 + 0.3 * Math.sin(lt * 4);
  }
  return { scene, cam, update, syn };
})();

// ================================================================ ESCENAS B y C · membrana con el receptor A1
const MB = (() => {
  const scene = new THREE.Scene(); lights(scene);
  const r = rng(12);
  // bicapa: cabezas esféricas blancas y colas finas, en dos capas; hueco para el receptor
  const sp = 0.235, nx = 80, nz = 32, heads = [], tails = [];
  const bend = (x, z) => -0.02 * x * x - 0.03 * (z + 0.5) * (z + 0.5);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = (i - nx / 2) * sp + (j % 2) * sp * 0.5 + (r() - 0.5) * 0.03, z = (j - nz * 0.86) * sp * 0.87 + (r() - 0.5) * 0.03;
    if (x * x + z * z < 0.62 * 0.62) continue;
    const y0 = bend(x, z);
    for (const s of [1, -1]) {
      heads.push([x, y0 + s * 0.44, z]);
      for (const dx of [-0.035, 0.035]) tails.push([x + dx, y0 + s * 0.24, z, (r() - 0.5) * 0.25]);
    }
  }
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.108, 18, 12),
    glossy(0xe8ecf2, 0x30343a, 0.25, { sheen: 0.8, sheenColor: new THREE.Color(0xdfe8ff) }), heads.length);
  const tailMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.016, 0.36, 6),
    new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.4, envMapIntensity: 0.8 }), tails.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  heads.forEach((h, i) => { M.compose(new THREE.Vector3(...h), Q.identity(), one); headMesh.setMatrixAt(i, M); });
  tails.forEach((t, i) => { E.set(0, 0, t[3]); Q.setFromEuler(E); M.compose(new THREE.Vector3(t[0], t[1], t[2]), Q, one); tailMesh.setMatrixAt(i, M); });
  scene.add(headMesh, tailMesh);

  // receptor acoplado a proteína G: 7 hélices transmembrana alrededor de un bolsillo central
  const recMat = glossy(0x7a56d8, 0x24104e, 0.45, { roughness: 0.3, sheen: 0.9, sheenColor: new THREE.Color(0xcab0ff) });
  const receptor = new THREE.Group(), helices = [];
  for (let k = 0; k < 7; k++) {
    const a = k * TAU / 7 + 0.3, len = 1.25 + r() * 0.25;
    const prof = []; // perfil de cápsula con el tramo recto subdividido (para poder deformarlo)
    for (let i = 0; i <= 8; i++) { const q = -Math.PI / 2 + i / 8 * Math.PI / 2; prof.push(new THREE.Vector2(0.2 * Math.cos(q), -len / 2 + 0.2 * Math.sin(q))); }
    for (let i = 1; i < 30; i++) prof.push(new THREE.Vector2(0.2, -len / 2 + len * i / 30));
    for (let i = 0; i <= 8; i++) { const q = i / 8 * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(1e-4, 0.2 * Math.cos(q)), len / 2 + 0.2 * Math.sin(q))); }
    prof[0].x = 1e-4;
    const geo = new THREE.LatheGeometry(prof, 28);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const rad = Math.hypot(v.x, v.z) || 1, f = 0.09 * fbm(v.x * 6 + k, v.y * 4, v.z * 6) + 0.035 * Math.sin(v.y * 11 + Math.atan2(v.z, v.x) * 2 + k);
      v.x += v.x / rad * f; v.z += v.z / rad * f; v.x += 0.035 * Math.sin(v.y * 7 + k); // espiral suave de la hélice
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, recMat);
    m.position.set(Math.cos(a) * 0.37, 0.12 + (r() - 0.5) * 0.15, Math.sin(a) * 0.37);
    m.rotation.set((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
    receptor.add(m); helices.push({ m, a, rx: m.rotation.x, rz: m.rotation.z });
  }
  for (let k = 0; k < 4; k++) { // asas extracelulares
    const m = new THREE.Mesh(blob(0.16, 3, 0.04, 5, k + 4), recMat), a = k * TAU / 4 + 0.6;
    m.position.set(Math.cos(a) * 0.42, 0.95, Math.sin(a) * 0.42); m.scale.set(1.2, 0.7, 1); receptor.add(m);
  }
  const lower = new THREE.Mesh(blob(0.5, 4, 0.08, 3, 9), recMat); lower.position.y = -0.62; lower.scale.set(1, 0.45, 1); receptor.add(lower);
  scene.add(receptor);
  const pocket = new THREE.Vector3(0, 0.96, 0);
  const recGlow = glowSprite3(0xb08cff, 1.6, 0); recGlow.position.set(0, 0.7, 0); scene.add(recGlow);

  // neuronas de fondo (desenfocadas) con impulsos eléctricos
  const bgMat = tissueMat({ emissiveIntensity: 0.9 }), bgCurves = [];
  for (const [s, p] of [[51, [-3.2, 2.6, -5.5]], [53, [2.6, 3.4, -6.5]], [57, [0.2, 4.6, -8.5]], [59, [-4.6, 0.6, -7.5]], [61, [4.4, 1.0, -5.0]]]) {
    const n = neuron(s, bgMat, { dendrites: 8, steps: 7, len: 0.55, soma: 0.42 });
    n.group.position.set(...p); n.group.updateMatrixWorld(true);
    n.curves.forEach(cv => { cv.points = cv.points.map(q => q.clone().add(n.group.position)); bgCurves.push(cv); });
    onLayer(n.group, 1); scene.add(n.group);
  }
  const bgPulse = pulses(scene, bgCurves, 4, 0xffe28a, 26, 1);

  // moléculas libres
  const ade = [], caf = [];
  for (let i = 0; i < 6; i++) { const m = molecule(ADENOSINE, adeMat); scene.add(m); ade.push(m); }
  for (let i = 0; i < 6; i++) { const m = molecule(CAFFEINE, cafMat); scene.add(m); caf.push(m); }
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.05, 60);
  const drift = (m, seed, lt, c) => {
    const q = rng(seed); const base = new THREE.Vector3((q() - 0.5) * 4.4, 1.6 + q() * 2.4, (q() - 0.5) * 2.4 + c);
    m.position.copy(base).add(new THREE.Vector3(Math.sin(lt * 0.6 + seed) * 0.25, Math.cos(lt * 0.5 + seed) * 0.2, 0));
    m.rotation.set(lt * 0.5 + seed, lt * 0.4 + seed * 2, seed);
  };
  // trayectoria curva desde `from` hasta el bolsillo, con orientación final fija
  const dockTo = (m, from, k, finalRot) => {
    const ctrl = new THREE.Vector3(from.x * 0.3, pocket.y + 0.9, from.z * 0.3);
    const e = easeIO(k), a = from.clone().lerp(ctrl, e), b = ctrl.clone().lerp(pocket, e);
    m.position.copy(a.lerp(b, e));
    m.rotation.set(lerp(1.7, finalRot[0], e), lerp(2.4, finalRot[1], e), lerp(0.4, finalRot[2], e));
  };
  function receptorShape(k) { // cambio de forma al unirse el ligando
    helices.forEach(({ m, a, rx, rz }) => { m.rotation.x = rx + Math.sin(a) * 0.09 * k; m.rotation.z = rz - Math.cos(a) * 0.09 * k; });
  }
  return { scene, cam, ade, caf, pocket, receptor, recGlow, bgMat, bgPulse, drift, dockTo, receptorShape };
})();

const project = (v, cam) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; };

// render por capas de profundidad: 1 = fondo (desenfocado), 0 = plano de foco, 2 = primer plano (desenfocado)
function render3D(c, scene, cam, blurFar = 9, blurNear = 16, between) {
  for (const [layer, blur] of [[1, blurFar], [0, 0], [2, blurNear]]) {
    cam.layers.set(layer);
    renderer.render(scene, cam);
    c.save();
    if (blur) c.filter = `blur(${blur}px)`;
    c.drawImage(glCanvas, 0, 0);
    c.restore();
    if (layer === 1 && between) between(c);
  }
  cam.layers.set(0);
}

// ---------------------------------------------------------------- escenas
const SC = {
  cerebro(c, lt) {
    background(c, '#16262c', '#0d1a1f', '#070d10');
    A.update(lt);
    render3D(c, A.scene, A.cam, 10, 18, c2 => bokehField(c2, 3, lt, 40, ['#7fd2e0', '#ffc9a8', '#ffffff'], { alpha: 0.18 }));
    dust(c, 8, lt, 60, '#bfeaff', 0.5);
    const [sx, sy] = project(A.syn, A.cam);
    pill(c, 'Adenosina ↑', W * 0.28, H * 0.70, inOut(lt, 1.0, 3.9, 0.35, 0.3), [sx - 20, sy + 30]);
  },
  receptor(c, lt) {
    background(c, '#1a2a30', '#10191d', '#080c0f');
    const { cam, ade, caf, pocket } = MB;
    const k = easeIO(seg(lt, -0.3, 3.9));
    const ang = lerp(-0.42, -0.12, k);
    cam.position.set(Math.sin(ang) * 6.2, lerp(2.1, 1.8, k), Math.cos(ang) * 6.2);
    cam.lookAt(0, 0.55, 0); cam.updateMatrixWorld();
    caf.forEach(m => (m.visible = false));
    const dock = seg(lt, 0.2, 1.6);
    ade.forEach((m, i) => { m.visible = true; MB.drift(m, 100 + i, lt + 4, -2.2); });
    MB.dockTo(ade[0], new THREE.Vector3(-2.4, 3.0, 0.6), dock, [0.15, 0.4, 0.1]);
    if (dock >= 1) ade[0].rotation.y += Math.sin(lt * 2) * 0.03;
    MB.receptorShape(easeOut(seg(lt, 1.4, 2.0)));
    MB.recGlow.material.opacity = 0.35 * Math.sin(Math.PI * seg(lt, 1.4, 2.4));
    const calm = seg(lt, 1.6, 2.8); // la actividad de fondo se apaga
    MB.bgMat.emissiveIntensity = lerp(0.9, 0.35, calm);
    MB.bgPulse(lt + 3, lerp(0.85, 0.0, calm));
    render3D(c, MB.scene, cam, 11, 18, c2 => bokehField(c2, 5, lt, 36, ['#7fd2e0', '#ffffff', '#ffd9b8'], { alpha: 0.16 }));
    dust(c, 9, lt, 50, '#d6f2ff', 0.45);
    { const g = c.createLinearGradient(0, 0, 0, H * 0.55); g.addColorStop(0, 'rgba(4,7,10,0.5)'); g.addColorStop(1, 'rgba(4,7,10,0)');
      c.save(); c.globalAlpha = calm; c.fillStyle = g; c.fillRect(0, 0, W, H * 0.55); c.restore(); }
    pill(c, 'Adenosina', W * 0.24, H * 0.30, inOut(lt, 0.7, 3.5, 0.35, 0.3), project(ade[0].position, cam));
    pill(c, 'Receptor A1', W * 0.72, H * 0.86, inOut(lt, 0.9, 3.5, 0.35, 0.3), project(new THREE.Vector3(0.18, 0.15, 0.45), cam));
    pill(c, 'Actividad neuronal ↓', W * 0.5, H * 0.19, inOut(lt, 1.8, 3.5, 0.35, 0.3));
  },
  cafeina(c, lt) {
    background(c, '#1c3238', '#11201f', '#080d0e');
    const { cam, ade, caf, pocket } = MB;
    const k = easeIO(seg(lt, -0.3, 3.4));
    const ang = lerp(0.32, 0.08, k), dist = lerp(5.4, 6.6, k);
    cam.position.set(Math.sin(ang) * dist, lerp(1.7, 2.1, k), Math.cos(ang) * dist);
    cam.lookAt(0, 0.6, 0); cam.updateMatrixWorld();
    caf.forEach((m, i) => { m.visible = true; MB.drift(m, 200 + i, lt, -2.0); });
    MB.dockTo(caf[0], new THREE.Vector3(2.3, 2.9, 0.8), seg(lt, 0.0, 1.0), [0.1, -0.3, 0.05]);
    ade.forEach((m, i) => { m.visible = i < 4; MB.drift(m, 300 + i, lt, -2.4); });
    // una adenosina se acerca y rebota: el sitio ya está ocupado
    const a = ade[0], from = new THREE.Vector3(-2.2, 2.7, 0.9), near = pocket.clone().add(new THREE.Vector3(-0.38, 0.42, 0.1));
    const ka = easeOut(seg(lt, 0.8, 1.45)), kb = easeOut(seg(lt, 1.45, 2.6));
    a.position.copy(from.clone().lerp(near, ka)).add(new THREE.Vector3(-1.6, 1.0, 0.5).multiplyScalar(kb));
    a.rotation.set(lt * 1.2, lt * 0.9 + kb * 3, 0.3);
    MB.receptorShape(0.4 * easeOut(seg(lt, 0.8, 1.2)));
    MB.recGlow.material.opacity = 0.3 * Math.sin(Math.PI * seg(lt, 0.8, 1.8));
    const wake = easeOut(seg(lt, 1.0, 2.0)); // las neuronas se activan
    MB.bgMat.emissiveIntensity = lerp(0.5, 1.6, wake);
    MB.bgPulse(lt, lerp(0.3, 1.0, wake));
    render3D(c, MB.scene, cam, 10, 18, c2 => {
      bokehField(c2, 7, lt, 36, ['#ffe08a', '#ffffff', '#8fd8e8'], { alpha: 0.16 + 0.1 * wake });
      c2.save(); c2.globalCompositeOperation = 'lighter'; c2.globalAlpha = 0.22 * wake;
      const g = c2.createRadialGradient(W * 0.5, H * 0.25, 0, W * 0.5, H * 0.25, H * 0.5);
      g.addColorStop(0, '#ffcf6a'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c2.fillStyle = g; c2.fillRect(0, 0, W, H); c2.restore();
    });
    dust(c, 11, lt, 55, '#ffe9b8', 0.5);
    pill(c, 'Cafeína', W * 0.75, H * 0.36, inOut(lt, 0.9, 3.35, 0.35, 0.3), project(caf[0].position, cam));
    pill(c, 'Receptor bloqueado', W * 0.30, H * 0.72, inOut(lt, 1.3, 3.35, 0.35, 0.3), project(new THREE.Vector3(-0.2, 0.3, 0.42), cam));
    keyword(c, 'ALERTA', lt, 1.7);
  },
};

// ---------------------------------------------------------------- composición
let TL = null;
const TR = 0.22; // media duración del fundido cruzado
const layer = offscreen(W, H), layerCtx = layer.getContext('2d');
window.renderFrame = async (t, type = 'image/jpeg') => {
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  TL.scenes.forEach((s, i) => {
    if (t < s.start - TR || t > s.end + TR) return;
    const a = i === 0 ? 1 : clamp((t - (s.start - TR)) / (2 * TR));
    if (a <= 0) return;
    if (a < 1) {
      layerCtx.globalAlpha = 1; layerCtx.filter = 'none';
      layerCtx.clearRect(0, 0, W, H);
      SC[s.id](layerCtx, t - s.start);
      ctx.save(); ctx.globalAlpha = a; ctx.drawImage(layer, 0, 0); ctx.restore();
    } else {
      SC[s.id](ctx, t - s.start);
    }
  });
  post(ctx, t);
  const f = seg(t, TL.duration - TL.fadeOut, TL.duration);
  if (f > 0) { ctx.save(); ctx.globalAlpha = f; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  return out.toDataURL(type, 0.93);
};

(async () => {
  TL = await (await fetch('timeline.json')).json();
  window.DURATION = TL.duration;
  await Promise.all([document.fonts.load('700 92px "Inter Display"'), document.fonts.load('600 38px "Inter"')]);
  window.READY = true;
})();
