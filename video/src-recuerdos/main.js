// Short 9:16 · «¿Por qué recuerdas con detalle lo que te hizo sufrir?»
// Motor compartido con src/main.js (primer Short); cambian las regiones, la sinapsis bloqueable y las escenas.
// Todo se dibuja por código: Three.js para las escenas 3D (cerebro, neuronas, sinapsis)
// y Canvas 2D para las escenas cinematográficas, textos, grano y viñeta.
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
// entra (a→a+fi) y sale (b-fo→b)
const inOut = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const PAL = {
  ink: '#04060b',
  cyan: '#5fd3ff',
  violet: '#8a6bff',
  gold: '#ffbf5e',
  rose: '#ff4f7b',
  red: '#ff3b3b',
  white: '#f4f6fb',
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
function glow(c, x, y, r, color, a = 1, hard = false) {
  if (a <= 0.003 || r <= 0.5) return;
  c.save(); c.globalAlpha *= a; c.globalCompositeOperation = 'lighter';
  c.drawImage(glowSprite(color, hard), x - r, y - r, r * 2, r * 2);
  c.restore();
}

// ---------------------------------------------------------------- texto
function txt(c, s, x, y, o = {}) {
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
function title(c, s, x, y, lt, a, b, o = {}) {
  const k = inOut(lt, a, b, o.fi ?? 0.45, o.fo ?? 0.35);
  if (k <= 0) return;
  const e = easeOut(seg(lt, a, a + (o.fi ?? 0.45)));
  txt(c, s, x, y + (1 - e) * 26, {
    ...o, alpha: k * (o.alpha ?? 1), blur: (1 - e) * 14 + (o.blur ?? 0),
    spacing: (o.spacing ?? 0) + (1 - e) * 10,
  });
}
// cita científica pequeña
function cite(c, s, lt, a, b, y = 1440) {
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
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
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
function bokehField(c, seed, lt, n, colors, o = {}) {
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
function dust(c, seed, lt, n, color, alpha = 0.6) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, s = 2 + r() * 5, sp = 8 + r() * 26, ph = r() * TAU;
    const yy = (y - lt * sp + H * 10) % H;
    const xx = x + Math.sin(lt * 0.5 + ph) * 18;
    glow(c, xx, yy, s * 3, color, alpha * (0.3 + 0.7 * Math.abs(Math.sin(lt * 0.8 + ph))));
  }
}
function lightLeak(c, x, y, rx, ry, color, a) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
  c.translate(x, y); c.scale(rx / 100, ry / 100);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 100);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 100, 0, TAU); c.fill();
  c.restore();
}

// silueta de perfil (busto) mirando a la derecha; unidad ≈ alto de la cabeza
const PROFILE = [
  [-0.30, 0.98], [-0.31, 0.72], [-0.40, 0.48], [-0.44, 0.18], [-0.36, -0.14], [-0.16, -0.33],
  [0.10, -0.35], [0.29, -0.24], [0.37, -0.04], [0.40, 0.10], [0.375, 0.17], [0.42, 0.25],
  [0.475, 0.335], [0.47, 0.36], [0.405, 0.385], [0.42, 0.44], [0.405, 0.475], [0.39, 0.50],
  [0.405, 0.535], [0.375, 0.58], [0.365, 0.62], [0.375, 0.67], [0.33, 0.73], [0.22, 0.77],
  [0.12, 0.82], [0.11, 1.0], [0.22, 1.14], [0.52, 1.30], [0.66, 1.9], [-0.95, 1.9], [-0.85, 1.36],
  [-0.48, 1.12],
];
function smoothPath(c, pts, x, y, s) {
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
function rimSilhouette(c, pts, x, y, s, rim, dx, dy, body = '#020306', soft = 10, rimA = 1) {
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

// ---------------------------------------------------------------- THREE: renderer y recursos
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 1);
const glCanvas = renderer.domElement;

const glowTex = (() => {
  const s = 128, c = offscreen(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function glowSprite3(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}
function fresnelMat(col, rim, o = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: o.depthWrite ?? false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: o.side ?? THREE.FrontSide,
    uniforms: {
      uCol: { value: new THREE.Color(col) }, uRim: { value: new THREE.Color(rim) },
      uPow: { value: o.pow ?? 2.2 }, uAlpha: { value: o.alpha ?? 1 }, uGlow: { value: o.glow ?? 1.4 },
      uBase: { value: o.base ?? 0.25 },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uCol, uRim; uniform float uPow, uAlpha, uGlow, uBase;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPow);
        vec3 c = uCol + uRim * f * uGlow;
        gl_FragColor = vec4(c, (uBase + (1.0 - uBase) * f) * uAlpha);
      }`,
  });
}

// ---------------------------------------------------------------- cerebro (nube de puntos)
const REG = {
  vta: new THREE.Vector3(0, -0.27, -0.12),
  nacL: new THREE.Vector3(-0.16, -0.08, 0.24),
  nacR: new THREE.Vector3(0.16, -0.08, 0.24),
  insR: new THREE.Vector3(0.6, -0.02, 0.1),
  s2R: new THREE.Vector3(0.64, 0.22, -0.08),
  insL: new THREE.Vector3(-0.6, -0.02, 0.1),
  pfc: new THREE.Vector3(0, 0.22, 0.86),
  amyL: new THREE.Vector3(-0.25, -0.25, 0.17),
  amyR: new THREE.Vector3(0.25, -0.25, 0.17),
  hipL: new THREE.Vector3(-0.29, -0.19, -0.08),
  hipR: new THREE.Vector3(0.29, -0.19, -0.08),
};
const brain = (() => {
  const r = rng(7);
  const P = [], B = [], S = [];
  const gyri = (x, y, z) =>
    Math.sin(x * 13 + Math.sin(y * 9) * 2.2) * Math.sin(y * 12 + Math.sin(z * 8) * 2.4) *
    Math.sin(z * 11 + Math.sin(x * 7) * 2.0);
  const dir = () => {
    const u = r() * 2 - 1, th = r() * TAU, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(th), u, s * Math.sin(th)];
  };
  function shell(cx, cy, cz, rx, ry, rz, n, side, minY = -9, size = 15, amp = 0.05) {
    for (let i = 0; i < n; i++) {
      const [dx, dy, dz] = dir();
      let x = cx + dx * rx, y = cy + dy * ry * (1 - 0.1 * dz), z = cz + dz * rz;
      if (side && x * side < 0.03) continue;
      if (y < minY) continue;
      const g = gyri(x, y, z), k = 1 + amp * g;
      x = cx + (x - cx) * k; y = cy + (y - cy) * k; z = cz + (z - cz) * k;
      P.push(x, y, z); B.push(0.35 + 0.65 * Math.pow(g * 0.5 + 0.5, 1.5)); S.push(size * (0.7 + 0.6 * r()));
    }
  }
  for (const sd of [-1, 1]) {
    shell(0.34 * sd, 0.08, 0.02, 0.38, 0.56, 0.95, 30000, sd, -0.3);
    shell(0.45 * sd, -0.2, 0.14, 0.26, 0.22, 0.52, 6500, sd, -0.42);
  }
  // cerebelo con estrías
  for (let i = 0; i < 9000; i++) {
    const [dx, dy, dz] = dir();
    const x = dx * 0.44, y = -0.42 + dy * 0.2, z = -0.62 + dz * 0.3;
    if (y > -0.26 && z > -0.5) continue;
    const st = Math.sin(y * 90 + Math.sin(x * 6) * 2);
    const k = 1 + 0.03 * st;
    P.push(x * k, -0.42 + (y + 0.42) * k, -0.62 + (z + 0.62) * k);
    B.push(0.3 + 0.5 * (st * 0.5 + 0.5)); S.push(13);
  }
  // tronco encefálico
  for (let i = 0; i < 3500; i++) {
    const a = r() * TAU, h = r(), rad = 0.12 - 0.035 * h;
    P.push(Math.cos(a) * rad, -0.24 - h * 0.78, -0.2 - 0.14 * h + Math.sin(a) * rad);
    B.push(0.35 + 0.3 * r()); S.push(13);
  }
  // volumen interior tenue (profundidad)
  for (let i = 0; i < 7000; i++) {
    const x = (r() * 2 - 1) * 0.65, y = (r() * 2 - 1) * 0.5, z = (r() * 2 - 1) * 0.85;
    const e = Math.pow((Math.abs(x) - 0.32) / 0.36, 2) + Math.pow((y - 0.08) / 0.52, 2) + Math.pow(z / 0.9, 2);
    if (e > 1 || y < -0.3) continue;
    P.push(x, y, z); B.push(0.1 + 0.1 * r()); S.push(12);
  }
  // estructuras profundas: ATV y estriado ventral
  const gauss = () => (r() + r() + r() + r() - 2) / 1.15;
  function blob(c, sx, sy, sz, n) {
    for (let i = 0; i < n; i++) {
      P.push(c.x + gauss() * sx, c.y + gauss() * sy, c.z + gauss() * sz);
      B.push(0.25); S.push(14);
    }
  }
  blob(REG.vta, 0.035, 0.025, 0.035, 900);
  blob(REG.nacL, 0.05, 0.045, 0.08, 1100);
  blob(REG.nacR, 0.05, 0.045, 0.08, 1100);
  blob(REG.amyL, 0.04, 0.035, 0.04, 900);
  blob(REG.amyR, 0.04, 0.035, 0.04, 900);
  // hipocampo: tubo curvo a lo largo del lóbulo temporal medial
  for (const sd of [-1, 1]) {
    const cv = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.26 * sd, -0.25, 0.12), new THREE.Vector3(0.29 * sd, -0.21, 0.0),
      new THREE.Vector3(0.3 * sd, -0.15, -0.17), new THREE.Vector3(0.24 * sd, -0.04, -0.3)]);
    for (let i = 0; i < 1600; i++) {
      const p = cv.getPoint(r());
      P.push(p.x + gauss() * 0.03, p.y + gauss() * 0.025, p.z + gauss() * 0.03);
      B.push(0.25); S.push(14);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('aBright', new THREE.Float32BufferAttribute(B, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1));
  const N = 5;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uBase: { value: new THREE.Color(0.10, 0.32, 0.72) },
      uAlpha: { value: 1 }, uScanZ: { value: 0 }, uScanOn: { value: 0 }, uScale: { value: 1 },
      uHL: { value: Array.from({ length: N }, () => new THREE.Vector3()) },
      uHLCol: { value: Array.from({ length: N }, () => new THREE.Color(0, 0, 0)) },
      uHLRad: { value: new Array(N).fill(0.1) },
      uHLAmt: { value: new Array(N).fill(0) },
    },
    vertexShader: `
      attribute float aBright; attribute float aSize;
      uniform vec3 uBase; uniform float uAlpha, uScanZ, uScanOn, uScale;
      uniform vec3 uHL[${N}]; uniform vec3 uHLCol[${N}]; uniform float uHLRad[${N}]; uniform float uHLAmt[${N}];
      varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        vec3 col = uBase * aBright;
        float extra = 0.0;
        for(int i=0;i<${N};i++){
          float d = distance(position, uHL[i]);
          float k = uHLAmt[i] * exp(-d*d/(uHLRad[i]*uHLRad[i]));
          col += uHLCol[i] * k; extra += k;
        }
        float scan = uScanOn * exp(-pow((position.z - uScanZ)/0.03, 2.0));
        col += vec3(0.55,0.9,1.0) * scan * 0.9;
        float near = smoothstep(0.35, 1.3, -mv.z);
        vCol = col * uAlpha * near;
        gl_PointSize = clamp(aSize * uScale * (1.0 + min(extra,1.5)*0.5 + scan*0.8) / (-mv.z), 1.2, 28.0);
      }`,
    fragmentShader: `
      varying vec3 vCol;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vCol * a, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, mat };
})();
function setHL(i, pos, color, rad, amt) {
  const u = brain.mat.uniforms;
  u.uHL.value[i].copy(pos); u.uHLCol.value[i].set(color); u.uHLRad.value[i] = rad; u.uHLAmt.value[i] = amt;
}
function clearHL() { brain.mat.uniforms.uHLAmt.value.fill(0); }

const brainScene = new THREE.Scene();
const brainRoot = new THREE.Group();
brainScene.add(brainRoot);
brainRoot.add(brain.pts);
// polvo de fondo
const bgDust = (() => {
  const r = rng(3), P = [];
  for (let i = 0; i < 1600; i++) P.push((r() - 0.5) * 12, (r() - 0.5) * 18, (r() - 0.5) * 12 - 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    color: 0x3a6fb0, size: 0.018, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
})();
brainScene.add(bgDust);
// vías dopaminérgicas (mesolímbica y mesocortical)
const pathways = (() => {
  const grp = new THREE.Group(), curves = [];
  const add = (a, ctl, b, kind) => {
    const cv = new THREE.CatmullRomCurve3([a.clone(), ctl, b.clone()]);
    curves.push({ cv, kind });
    const m = new THREE.MeshBasicMaterial({
      color: kind === 'limbic' ? 0xffb347 : 0xff8a5c, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(cv, 64, 0.009, 6, false), m);
    grp.add(mesh);
    return mesh;
  };
  const meshes = [];
  for (const s of [-1, 1]) {
    meshes.push(add(REG.vta, new THREE.Vector3(0.07 * s, -0.24, 0.06), s < 0 ? REG.nacL : REG.nacR, 'limbic'));
    meshes.push(add(REG.vta, new THREE.Vector3(0.1 * s, -0.05, 0.35), new THREE.Vector3(0.22 * s, 0.24, 0.8), 'cortical'));
  }
  const pulses = [];
  for (let i = 0; i < 40; i++) {
    const sp = glowSprite3(0xffc66b, 0.07, 0);
    sp.material.depthTest = false;
    grp.add(sp); pulses.push(sp);
  }
  const vtaGlow = glowSprite3(0xffb347, 0.3, 0); vtaGlow.material.depthTest = false; vtaGlow.position.copy(REG.vta);
  const nacGlows = [REG.nacL, REG.nacR].map(p => {
    const g = glowSprite3(0xff9f45, 0.3, 0); g.material.depthTest = false; g.position.copy(p); grp.add(g); return g;
  });
  grp.add(vtaGlow);
  return { grp, curves, meshes, pulses, vtaGlow, nacGlows };
})();
brainRoot.add(pathways.grp);
function setPathways(lt, amount, pulseAmt) {
  pathways.meshes.forEach((m, i) => { m.material.opacity = amount * (pathways.curves[i].kind === 'limbic' ? 0.9 : 0.45); });
  pathways.pulses.forEach((p, i) => {
    const c = pathways.curves[i % pathways.curves.length];
    const u = (((lt * 0.6 + i * 0.137) % 1) + 1) % 1;
    c.cv.getPoint(u, p.position);
    p.material.opacity = pulseAmt * Math.sin(u * Math.PI) * (c.kind === 'limbic' ? 1 : 0.6);
    p.scale.setScalar(0.05 + 0.04 * Math.sin(u * Math.PI));
  });
}
const brainCam = new THREE.PerspectiveCamera(35, W / H, 0.05, 100);

function project(v, cam, obj) {
  const p = v.clone();
  if (obj) p.applyMatrix4(obj.matrixWorld);
  p.project(cam);
  return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H];
}
function render3D(c, scene, cam, dy = 0) {
  renderer.render(scene, cam);
  c.drawImage(glCanvas, 0, dy);
}
function brainBase() {
  clearHL();
  const u = brain.mat.uniforms;
  u.uBase.value.setRGB(0.17, 0.48, 1.0); u.uAlpha.value = 1; u.uScanOn.value = 0; u.uScale.value = 1.25;
  setPathways(0, 0, 0);
  pathways.vtaGlow.material.opacity = 0;
  pathways.nacGlows.forEach(g => (g.material.opacity = 0));
  bgDust.visible = true;
}
function orbitCam(cam, angle, dist, height, target) {
  cam.position.set(target.x + Math.sin(angle) * dist, target.y + height, target.z + Math.cos(angle) * dist);
  cam.lookAt(target);
  cam.updateMatrixWorld();
}
// etiqueta con línea guía hacia un punto proyectado
function label(c, px, py, ly, text, sub, color, a) {
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

// ---------------------------------------------------------------- neuronas
const neuro = (() => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 2.2, 10);
  const r = rng(21);
  const rv = () => new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
  const somas = [[0, 0, 0], [1.5, 1.3, -1.6], [-1.4, -1.5, -1.1], [-1.7, 1.9, -2.6], [1.9, -1.9, -2.3],
    [0.3, 3.1, -3.6], [-0.4, -3.3, -3.1], [2.5, 0.4, -4.6], [-2.7, 0.1, -4.1], [0.8, -0.6, -6]];
  const axons = [];
  const tubeMat = (col, op) => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  const dMat = tubeMat(0x3f8cff, 0.55), dMat2 = tubeMat(0x8a6bff, 0.4), aMat = tubeMat(0x5fd3ff, 0.65);
  for (const s of somas) {
    const p0 = new THREE.Vector3(...s);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, fog: true }));
    core.position.copy(p0); scene.add(core);
    const halo = glowSprite3(0x5fb8ff, 0.9, 0.9); halo.position.copy(p0); scene.add(halo);
    for (let k = 0; k < 7; k++) {
      let d = rv().normalize(), p = p0.clone();
      const pts = [p.clone()];
      for (let j = 0; j < 5; j++) {
        d.add(rv().multiplyScalar(0.55)).normalize();
        p = p.clone().addScaledVector(d, 0.22 + r() * 0.12); pts.push(p);
        if (j === 2) {
          let d2 = d.clone().add(rv()).normalize(), q = p.clone(); const sub = [q.clone()];
          for (let m = 0; m < 3; m++) { d2.add(rv().multiplyScalar(0.5)).normalize(); q = q.clone().addScaledVector(d2, 0.2); sub.push(q); }
          scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sub), 16, 0.009, 5), dMat2));
        }
      }
      const cv = new THREE.CatmullRomCurve3(pts);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 32, 0.014, 6), dMat));
      if (k < 2) axons.push({ cv, ph: r(), sp: 0.5 + r() * 0.4, inward: true });
    }
    let d = rv().normalize(), p = p0.clone(); const pts = [p.clone()];
    for (let j = 0; j < 9; j++) { d.add(rv().multiplyScalar(0.35)).normalize(); p = p.clone().addScaledVector(d, 0.42); pts.push(p); }
    const cv = new THREE.CatmullRomCurve3(pts);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 90, 0.022, 7), aMat));
    axons.push({ cv, ph: r(), sp: 0.35 + r() * 0.25, inward: false });
  }
  // impulsos eléctricos con estela
  const imps = axons.map(a => {
    const trail = [];
    for (let i = 0; i < 6; i++) {
      const sp = glowSprite3(i === 0 ? 0xffffff : 0x9fe2ff, 0.32 - i * 0.04, 1 - i * 0.15);
      scene.add(sp); trail.push(sp);
    }
    return { a, trail };
  });
  const r2 = rng(5), P = [];
  for (let i = 0; i < 2500; i++) P.push((r2() - 0.5) * 12, (r2() - 0.5) * 14, -r2() * 12 + 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x4a7fd0, size: 0.02, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
  const cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 50);
  function update(lt) {
    for (const { a, trail } of imps) {
      const u0 = ((lt * a.sp + a.ph) % 1.25);
      trail.forEach((s, i) => {
        let u = u0 - i * 0.018;
        const vis = u >= 0 && u <= 1;
        u = clamp(u);
        a.cv.getPoint(a.inward ? 1 - u : u, s.position);
        s.visible = vis;
      });
    }
  }
  return { scene, cam, update };
})();

// ---------------------------------------------------------------- sinapsis
const syn = (() => {
  const scene = new THREE.Scene();
  const r = rng(11);
  const pre = new THREE.Mesh(new THREE.SphereGeometry(1.15, 96, 64), fresnelMat(0x0d0a26, 0x9b7bff, { pow: 2.0, glow: 1.6, base: 0.35 }));
  pre.scale.set(1.15, 0.85, 1); pre.position.y = 1.25; scene.add(pre);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.75, 6, 48, 1, true), fresnelMat(0x0d0a26, 0x9b7bff, { pow: 2.0, glow: 1.3, base: 0.3 }));
  stalk.position.y = 4.7; scene.add(stalk);
  const post = new THREE.Mesh(new THREE.SphereGeometry(7, 128, 64), fresnelMat(0x07122a, 0x4fb6ff, { pow: 1.6, glow: 1.2, base: 0.55 }));
  post.position.y = -7.5; scene.add(post);
  const vesicles = [];
  for (let i = 0; i < 18; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), fresnelMat(0x3a2200, 0xffc66b, { pow: 1.5, glow: 2.0, base: 0.5, additive: true }));
    const a = r() * TAU, rad = Math.sqrt(r()) * 0.75;
    v.userData.home = new THREE.Vector3(Math.cos(a) * rad, 1.0 + r() * 0.75, Math.sin(a) * rad * 0.7);
    v.userData.release = i < 6 ? 0.2 + i * 0.45 : 99;
    v.position.copy(v.userData.home);
    scene.add(v); vesicles.push(v);
  }
  const receptors = [];
  for (let i = 0; i < 9; i++) {
    const x = -1.1 + i * 0.275;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 16), new THREE.MeshBasicMaterial({ color: 0x2a6fb0, transparent: true, opacity: 0.9 }));
    const y = -0.95 + 7 - Math.sqrt(49 - x * x) - 0.01;
    m.position.set(x, -0.5 - (7 - Math.sqrt(49 - x * x)) + 0.05, (r() - 0.5) * 0.3);
    const gl = glowSprite3(0x5fd3ff, 0.45, 0); gl.position.copy(m.position);
    const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), new THREE.MeshBasicMaterial({ color: 0xff3a4a }));
    bl.position.copy(m.position); bl.position.y += 0.11; bl.visible = false;
    const blg = glowSprite3(0xff2a3a, 0.4, 0.8); blg.position.copy(bl.position); blg.visible = false;
    scene.add(m); scene.add(gl); scene.add(bl); scene.add(blg); receptors.push({ m, gl, y, bl, blg });
  }
  // moléculas de dopamina
  const mols = [];
  for (let i = 0; i < 6 * 34; i++) {
    const s = glowSprite3(0xffd27a, 0.13, 0);
    s.userData = { v: Math.floor(i / 34), dx: (r() - 0.5) * 1.6, dz: (r() - 0.5) * 0.8, sp: 0.7 + r() * 0.6, wob: r() * TAU };
    scene.add(s); mols.push(s);
  }
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.05, 50);
  function update(lt, block = false) {
    const recHit = new Array(receptors.length).fill(0);
    vesicles.forEach(v => {
      const tr = v.userData.release, k = seg(lt, tr, tr + 0.5);
      const home = v.userData.home;
      v.position.set(home.x * (1 - 0.6 * k), lerp(home.y, 0.38, easeIO(k)), home.z * (1 - k));
      const pop = seg(lt, tr + 0.5, tr + 0.65);
      v.scale.setScalar(1 + pop * 0.6);
      v.visible = pop < 1;
    });
    mols.forEach(m => {
      const d = m.userData, tr = vesicles[d.v].userData.release + 0.55;
      const k = (lt - tr) * d.sp;
      if (k < 0 || k > 1.6) { m.material.opacity = 0; return; }
      const e = easeOut(clamp(k));
      const vp = vesicles[d.v].position;
      // con los receptores bloqueados, la molécula rebota antes de llegar
      const y = !block ? lerp(0.36, -0.42, e) : k < 0.75 ? lerp(0.36, -0.28, easeOut(k / 0.75)) : -0.28 + (k - 0.75) * 0.9;
      m.position.set(vp.x + d.dx * e + Math.sin(lt * 6 + d.wob) * 0.03, y, d.dz * e);
      m.material.opacity = k < 1.2 ? 1 : 1 - (k - 1.2) / 0.4;
      if (!block && k > 0.85) {
        const idx = Math.round((m.position.x + 1.1) / 0.275);
        if (idx >= 0 && idx < recHit.length) recHit[idx] += 0.12;
      }
    });
    receptors.forEach((rc, i) => {
      rc.bl.visible = rc.blg.visible = block;
      const h = clamp(recHit[i]);
      rc.gl.material.opacity = h;
      rc.m.material.color.setRGB(lerp(0.16, 0.6, h), lerp(0.43, 0.95, h), lerp(0.69, 1, h));
    });
  }
  return { scene, cam, update };
})();

// ---------------------------------------------------------------- recursos 2D precalculados
// "fotos" de recuerdos (escenas cálidas con siluetas)
const photos = (() => {
  const list = [];
  const r = rng(44);
  const person = (g, x, y, s, lean = 0) => {
    g.save(); g.translate(x, y); g.rotate(lean); g.fillStyle = '#140a14';
    g.beginPath(); g.ellipse(0, -s * 1.62, s * 0.2, s * 0.24, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-s * 0.36, -s * 1.15); g.quadraticCurveTo(0, -s * 1.42, s * 0.36, -s * 1.15);
    g.lineTo(s * 0.3, -s * 0.2); g.lineTo(s * 0.18, s * 0.5); g.lineTo(-s * 0.18, s * 0.5); g.lineTo(-s * 0.3, -s * 0.2); g.closePath(); g.fill();
    g.restore();
  };
  const skies = [['#ffb36b', '#ff6f8e', '#4a2a6a'], ['#ffd29a', '#ff8f6b', '#5a2d55'], ['#9ad8ff', '#ff9fbf', '#3a2a6a'], ['#ffcf8a', '#e86a8a', '#2c1f4a'], ['#ffe2b0', '#f59a6b', '#6a3050'], ['#c7b6ff', '#ff8fa8', '#2a2050']];
  for (let i = 0; i < 6; i++) {
    const w = 520, h = 640, c = offscreen(w + 40, h + 130), g = c.getContext('2d');
    g.fillStyle = '#efe6da'; g.fillRect(0, 0, c.width, c.height);
    g.save(); g.translate(20, 20);
    const [a, b, d] = skies[i];
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, d); gr.addColorStop(0.55, b); gr.addColorStop(0.75, a); gr.addColorStop(1, '#2a1424');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sx = 120 + r() * 280;
    const sg = g.createRadialGradient(sx, h * 0.68, 0, sx, h * 0.68, 220); sg.addColorStop(0, 'rgba(255,240,200,0.95)'); sg.addColorStop(1, 'rgba(255,200,150,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d0f1d'; g.fillRect(0, h * 0.8, w, h * 0.2);
    for (let k = 0; k < 14; k++) { // luces lejanas
      const lg = g.createRadialGradient(r() * w, h * (0.72 + r() * 0.06), 0, 0, 0, 0);
      void lg;
      g.fillStyle = `rgba(255,${200 + r() * 50},${150 + r() * 60},${0.4 + r() * 0.4})`;
      g.beginPath(); g.arc(r() * w, h * (0.74 + r() * 0.05), 3 + r() * 6, 0, TAU); g.fill();
    }
    const two = i !== 3;
    person(g, w * 0.44, h * 0.9, 150, two ? 0.05 : 0);
    if (two) person(g, w * 0.6, h * 0.9, 140, -0.07);
    g.restore();
    // pátina
    g.fillStyle = 'rgba(255,220,180,0.12)'; g.fillRect(0, 0, c.width, c.height);
    list.push(c);
  }
  return list;
})();
// partículas de silueta de oso (para "no pienses en un oso blanco")
const BEAR = [[-1.0, -0.05], [-0.62, -0.28], [-0.05, -0.36], [0.33, -0.46], [0.55, -0.36], [0.72, -0.40], [0.79, -0.52], [0.88, -0.46],
  [1.05, -0.32], [1.27, -0.22], [1.24, -0.12], [1.0, -0.08], [0.82, -0.04], [0.68, 0.1], [0.63, 0.58], [0.66, 0.64], [0.40, 0.64],
  [0.43, 0.26], [0.10, 0.26], [-0.45, 0.24], [-0.55, 0.58], [-0.50, 0.64], [-0.84, 0.64], [-0.90, 0.36], [-1.02, 0.14]];
function sampleShape(drawFn, w, h, n, seed) {
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
const bearPts = sampleShape(g => {
  g.fillStyle = '#fff'; g.beginPath();
  BEAR.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, 400 + x * 340, 400 + y * 340));
  g.closePath(); g.fill();
}, 800, 800, 2600, 5);
let quizasPts = null; // se calcula tras cargar fuentes

// ---------------------------------------------------------------- ESCENAS · Tema 2: memoria emocional
// marcas de tiempo locales de palabras clave (las rellena tools/sync.py a partir de la voz)
const mark = (s, k, def) => (s && s.marks && s.marks[k] != null ? s.marks[k] : def);
const SC = {};

// vías amígdala → hipocampo con pulsos de noradrenalina
const amyHip = (() => {
  const grp = new THREE.Group(), curves = [], pulses = [];
  for (const s of [-1, 1]) {
    const a = s < 0 ? REG.amyL : REG.amyR, h = s < 0 ? REG.hipL : REG.hipR;
    curves.push(new THREE.CatmullRomCurve3([a.clone(), new THREE.Vector3(0.3 * s, -0.27, 0.04), h.clone()]));
  }
  for (let i = 0; i < 36; i++) {
    const sp = glowSprite3(0xffc66b, 0.06, 0);
    sp.material.depthTest = false;
    grp.add(sp); pulses.push(sp);
  }
  const amyGlows = [REG.amyL, REG.amyR].map(p => {
    const g = glowSprite3(0xff3a4a, 0.3, 0); g.material.depthTest = false; g.position.copy(p); grp.add(g); return g;
  });
  const hipGlows = [REG.hipL, REG.hipR].map(p => {
    const g = glowSprite3(0xffc66b, 0.3, 0); g.material.depthTest = false; g.position.copy(p); grp.add(g); return g;
  });
  return { grp, curves, pulses, amyGlows, hipGlows };
})();
brainRoot.add(amyHip.grp);
function setAmyHip(lt, amy, hip, flow) {
  amyHip.amyGlows.forEach(g => { g.material.opacity = amy; g.scale.setScalar(0.22 + 0.1 * amy); });
  amyHip.hipGlows.forEach(g => { g.material.opacity = hip; g.scale.setScalar(0.2 + 0.1 * hip); });
  amyHip.pulses.forEach((p, i) => {
    const u = (((lt * 0.7 + i * 0.173) % 1) + 1) % 1;
    amyHip.curves[i % 2].getPoint(u, p.position);
    p.material.opacity = flow * Math.sin(u * Math.PI);
  });
}
function brainReset() {
  brainBase();
  setAmyHip(0, 0, 0, 0);
}

// foto «dolorosa»: calle fría y lluviosa con una silueta sola
const painPhoto = (() => {
  const w = 520, h = 640, c = offscreen(w + 40, h + 130), g = c.getContext('2d');
  g.fillStyle = '#dfe4ea'; g.fillRect(0, 0, c.width, c.height);
  g.save(); g.translate(20, 20);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#0b1426'); gr.addColorStop(0.6, '#1c2a44'); gr.addColorStop(1, '#070b14');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const lg = g.createRadialGradient(330, 150, 0, 330, 150, 260);
  lg.addColorStop(0, 'rgba(255,90,90,0.55)'); lg.addColorStop(1, 'rgba(255,60,60,0)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#05070c'; g.fillRect(325, 150, 8, 400);
  const r = rng(12);
  g.strokeStyle = 'rgba(190,210,240,0.25)'; g.lineWidth = 1.5;
  for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 34); g.stroke(); }
  g.fillStyle = '#03050a';
  g.beginPath(); g.ellipse(230, 430, 22, 26, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(190, 470); g.quadraticCurveTo(230, 450, 270, 470); g.lineTo(262, 600); g.lineTo(198, 600); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,80,80,0.18)'; g.fillRect(0, 560, w, 80);
  g.restore();
  return c;
})();

// 1 · Gancho: los recuerdos felices se apagan; uno doloroso avanza nítido
SC.hook = (c, lt, d, sc0) => {
  const S = mark(sc0, 'sufrir', 3.3);
  c.fillStyle = '#07050a'; c.fillRect(0, 0, W, H);
  bokehField(c, 5, lt, 26, ['#ff9a6b', '#ffd29a', '#ff5a8a'], { rMin: 30, rMax: 110, alpha: 0.18 * (1 - 0.6 * seg(lt, S - 0.6, S + 0.6)) });
  const fade = easeIO(seg(lt, 1.6, S + 0.6));
  const r = rng(31);
  const items = [];
  for (let i = 0; i < 14; i++) {
    items.push({ p: photos[i % photos.length], x: (r() - 0.5) * 980, y: (r() - 0.5) * 1500, z: 1.6 + r() * 2.6, rot: (r() - 0.5) * 0.5 });
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) {
    const s = 1.15 / it.z * (1 + 0.04 * lt);
    const sx = W / 2 + it.x * s * 0.7, sy = H / 2 + it.y * s * 0.55 + 80;
    c.save();
    c.globalAlpha = (1 - 0.85 * fade) * 0.95;
    c.translate(sx, sy); c.rotate(it.rot);
    c.filter = `grayscale(${fade.toFixed(2)}) blur(${(Math.abs(it.z - 2.2) * 3 + fade * 10).toFixed(1)}px)`;
    c.drawImage(it.p, -it.p.width * s / 2, -it.p.height * s / 2, it.p.width * s, it.p.height * s);
    c.restore();
  }
  // el recuerdo doloroso se acerca y se vuelve nítido
  const k = easeIO(seg(lt, S - 0.9, d));
  if (k > 0) {
    const s = lerp(0.25, 1.15, k);
    c.save(); c.globalAlpha = clamp(k * 2);
    c.translate(W / 2, 1010); c.rotate(lerp(0.12, -0.03, k));
    c.shadowColor = 'rgba(255,40,60,0.75)'; c.shadowBlur = 80 * k;
    if (k < 0.6) c.filter = `blur(${((0.6 - k) * 16).toFixed(1)}px)`;
    c.drawImage(painPhoto, -painPhoto.width * s / 2, -painPhoto.height * s / 2, painPhoto.width * s, painPhoto.height * s);
    c.restore();
  }
  title(c, '¿Por qué olvidas', W / 2, 300, lt, 0.1, S - 0.05, { size: 70, weight: 700, glowPx: 20, glowColor: '#000' });
  title(c, 'cientos de momentos felices…', W / 2, 385, lt, 0.35, S - 0.05, { size: 56, weight: 600, italic: true, color: '#ffd29a', glowPx: 20, glowColor: '#000' });
  title(c, '…y recuerdas', W / 2, 290, lt, S - 0.05, d + 0.3, { size: 60, weight: 600, glowPx: 20, glowColor: '#000' });
  title(c, 'LO QUE DOLIÓ?', W / 2, 390, lt, S + 0.25, d + 0.3, { size: 96, weight: 800, color: '#ff4a5a', glowPx: 40, glowColor: '#ff1030', spacing: 4 });
};

// 2 · Alarma: destello rojo en la silueta
SC.alarm = (c, lt, d) => {
  c.fillStyle = '#040206'; c.fillRect(0, 0, W, H);
  const beat = Math.exp(-((((lt * 1.6) % 1) + 1) % 1) * 7);
  glow(c, 560, 860, 900, '#ff1a2e', 0.35 + 0.35 * beat);
  for (let i = 0; i < 3; i++) {
    const p = (((lt * 1.2 + i / 3) % 1) + 1) % 1;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,60,80,${0.5 * (1 - p)})`; c.lineWidth = 6 * (1 - p) + 1;
    c.beginPath(); c.arc(520, 880, 80 + p * 520, 0, TAU); c.stroke(); c.restore();
  }
  rimSilhouette(c, PROFILE, 400, 760, 600, '#ff6070', 14, -8, '#050207', 12);
  glow(c, 520, 880, 120, '#ff3040', 0.6 + 0.4 * beat);
  title(c, 'ALARMA', W / 2, 330, lt, 0.05, d + 0.3, { size: 130, weight: 800, spacing: 16, color: '#ff4a5a', glowPx: 50, glowColor: '#ff1030', fi: 0.25 });
};

// 3 · La amígdala se enciende
SC.amyg = (c, lt, d, sc0) => {
  const A = mark(sc0, 'amigdala', 2.3);
  brainReset();
  const u = brain.mat.uniforms;
  u.uBase.value.setRGB(0.14, 0.36, 0.85);
  const pulse = 0.75 + 0.25 * Math.sin(lt * 7);
  const on = seg(lt, 0.2, 1.2);
  setHL(0, REG.amyR, 0xff2a3a, 0.08, on * 3.2 * pulse);
  setHL(1, REG.amyL, 0xff2a3a, 0.08, on * 3.2 * pulse);
  setAmyHip(lt, on * pulse, 0, 0);
  const k = easeIO(seg(lt, 0, d));
  orbitCam(brainCam, 0.55 + lt * 0.15, lerp(4.6, 3.4, k), 0.35, new THREE.Vector3(0, -0.2, 0.08));
  render3D(c, brainScene, brainCam);
  const [px, py] = project(REG.amyR, brainCam, brain.pts);
  const [qx, qy] = project(REG.amyL, brainCam, brain.pts);
  const near = px > qx ? [px, py] : [qx, qy];
  label(c, near[0], near[1], Math.max(near[1] + 330, 1250), 'Amígdala', 'procesa lo emocional', '#ff5a6a', seg(lt, A - 0.2, A + 0.3) * (1 - seg(lt, d - 0.2, d + 0.2)));
  title(c, 'SE ACTIVA UNA ALARMA', W / 2, 330, lt, 0.15, d + 0.3, { size: 66, weight: 800, spacing: 3, color: '#ff8a8a', glowPx: 26, glowColor: '#ff1030' });
};

// 4 · Noradrenalina: de la amígdala al hipocampo
SC.hormones = (c, lt, d, sc0) => {
  const Hh = mark(sc0, 'hipocampo', 2.8);
  brainReset();
  const u = brain.mat.uniforms;
  u.uAlpha.value = 0.6;
  const pulse = 0.75 + 0.25 * Math.sin(lt * 6);
  setHL(0, REG.amyR, 0xff2a3a, 0.08, 2.6 * pulse);
  setHL(1, REG.amyL, 0xff2a3a, 0.08, 2.6 * pulse);
  const hip = seg(lt, Hh - 0.6, Hh + 0.4);
  setHL(2, REG.hipR, 0xffb347, 0.14, hip * 2.6);
  setHL(3, REG.hipL, 0xffb347, 0.14, hip * 2.6);
  setAmyHip(lt, pulse, hip, seg(lt, 0.2, 1.0));
  orbitCam(brainCam, 1.35 + lt * 0.14, 3.2, 0.5, new THREE.Vector3(0, -0.2, -0.02));
  render3D(c, brainScene, brainCam);
  // partículas hormonales que llegan desde fuera del cuadro
  const r = rng(17);
  for (let i = 0; i < 90; i++) {
    const x0 = r() * W, sp = 80 + r() * 160, ph = r() * TAU;
    const y = H - ((lt * sp + r() * H) % H);
    glow(c, x0 + Math.sin(lt * 1.5 + ph) * 30, y, 8 + r() * 8, '#ffc66b', 0.35 * seg(lt, 0, 0.6));
  }
  const [hx, hy] = project(REG.hipR, brainCam, brain.pts);
  label(c, hx, hy, Math.max(hy + 300, 1250), 'Hipocampo', 'consolida la memoria', PAL.gold, seg(lt, Hh - 0.3, Hh + 0.2) * (1 - seg(lt, d - 0.2, d + 0.2)));
  title(c, 'NORADRENALINA', W / 2, 330, lt, 0.15, d + 0.3, { size: 84, weight: 800, spacing: 6, color: PAL.gold, glowPx: 30, glowColor: '#ff7a1a' });
  title(c, 'una hormona del estrés', W / 2, 420, lt, 0.5, d + 0.3, { size: 46, weight: 600, italic: true });
  cite(c, 'McGaugh · Annu Rev Neurosci 2004', lt, 0.6, d + 0.3, 1480);
};

// 5 · Grabar con más fuerza: red neuronal que se intensifica
SC.engrave = (c, lt, d) => {
  neuro.update(lt * 1.7 + 3);
  const k = seg(lt, 0, d);
  neuro.cam.position.set(lerp(-0.4, 0.3, k), lerp(-0.2, 0.2, k), lerp(3.6, 2.6, easeIO(k)));
  neuro.cam.lookAt(0, 0, -1.2);
  render3D(c, neuro.scene, neuro.cam);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.25 + 0.35 * k;
  c.drawImage(glCanvas, 0, 0);
  c.restore();
  const fl = Math.pow(Math.max(0, Math.sin(lt * 4)), 10);
  c.fillStyle = `rgba(255,200,120,${0.08 * fl})`; c.fillRect(0, 0, W, H);
  title(c, 'GRABA EL MOMENTO', W / 2, 330, lt, 0.1, d + 0.3, { size: 76, weight: 800, spacing: 4, color: PAL.white, glowPx: 30, glowColor: '#ff9a2a' });
  title(c, 'con más fuerza', W / 2, 420, lt, 0.4, d + 0.3, { size: 56, weight: 700, italic: true, color: PAL.gold });
};

// 6 · 1994: un fármaco bloquea los receptores de noradrenalina
SC.pill = (c, lt, d) => {
  syn.update(lt + 0.2, true);
  const a = 0.5 + lt * 0.08;
  syn.cam.position.set(Math.sin(a) * 9.2, 1.5, Math.cos(a) * 9.2);
  syn.cam.lookAt(0, 0.95, 0);
  render3D(c, syn.scene, syn.cam, 230);
  // cápsula
  const pk = easeOut(seg(lt, 0.2, 0.8));
  if (pk > 0) {
    c.save(); c.globalAlpha = pk; c.translate(W / 2, 560); c.rotate(-0.35); c.scale(0.8 + 0.2 * pk, 0.8 + 0.2 * pk);
    c.shadowColor = '#ff4a5a'; c.shadowBlur = 40;
    roundRect(c, -150, -55, 300, 110, 55);
    const g = c.createLinearGradient(-150, 0, 150, 0);
    g.addColorStop(0, '#ff5a6a'); g.addColorStop(0.5, '#ff5a6a'); g.addColorStop(0.5, '#f4f6fb'); g.addColorStop(1, '#cfd6e4');
    c.fillStyle = g; c.fill();
    c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,0.45)'; roundRect(c, -120, -40, 240, 22, 11); c.fill();
    c.restore();
  }
  title(c, '1994', W / 2, 300, lt, 0.05, d + 0.3, { size: 110, weight: 800, spacing: 10, color: PAL.white, glowPx: 30, glowColor: '#ff3040' });
  title(c, 'un fármaco bloqueó la noradrenalina', W / 2, 395, lt, 0.4, d + 0.3, { size: 44, weight: 600, family: 'Inter' });
  const bk = seg(lt, 1.6, 2.0);
  if (bk > 0) txt(c, 'RECEPTORES β BLOQUEADOS', W / 2, 860, { size: 46, weight: 800, color: '#ff6a7a', alpha: bk, glowPx: 24, glowColor: '#ff1030', spacing: 3 });
  cite(c, 'Cahill et al. · Nature 1994', lt, 0.6, d + 0.3, 760);
};

// 7 · Resultado: baja el recuerdo emocional, no el neutro (esquema)
SC.bars = (c, lt, d, sc0) => {
  const N = mark(sc0, 'neutra', 3.6);
  c.fillStyle = '#06060d'; c.fillRect(0, 0, W, H);
  bokehField(c, 23, lt, 26, ['#ff5a6a', '#5fd3ff'], { rMin: 40, rMax: 130, alpha: 0.12 });
  const px = 90, py = 560, pw = 900, ph = 760;
  const pa = inOut(lt, 0.1, d + 0.3, 0.4, 0.3);
  c.save(); c.globalAlpha = pa;
  roundRect(c, px, py, pw, ph, 36); c.fillStyle = 'rgba(10,12,26,0.85)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 2; c.stroke();
  const base = py + ph - 130, maxH = 420;
  const groups = [['Placebo', 0.25], ['Fármaco', 0.72]];
  const drop = easeIO(seg(lt, 0.9, 2.4));
  groups.forEach(([name, gxF], gi) => {
    const gx = px + pw * gxF;
    const emo = gi === 0 ? 0.92 : lerp(0.92, 0.5, drop);
    const neu = 0.48;
    const grow = easeOut(seg(lt, 0.2 + gi * 0.15, 0.9 + gi * 0.15));
    const bars = [[emo, '#ff4a5a', -70], [neu, '#5fb8ff', 70]];
    for (const [v, col, off] of bars) {
      const hgt = maxH * v * grow;
      const x = gx + off - 55;
      const g = c.createLinearGradient(0, base - hgt, 0, base);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(20,20,40,0.6)');
      c.fillStyle = g; roundRect(c, x, base - hgt, 110, Math.max(hgt, 1), 18); c.fill();
      c.save(); c.shadowColor = col; c.shadowBlur = 24; c.fillStyle = col; c.fillRect(x + 8, base - hgt, 94, 4); c.restore();
    }
    txt(c, name, gx, base + 50, { size: 40, weight: 700, family: 'Inter' });
  });
  c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(px + 50, base); c.lineTo(px + pw - 50, base); c.stroke();
  // leyenda
  c.fillStyle = '#ff4a5a'; c.beginPath(); c.arc(px + 210, py + 60, 13, 0, TAU); c.fill();
  txt(c, 'parte emocional', px + 236, py + 60, { size: 32, weight: 600, family: 'Inter', align: 'left' });
  c.fillStyle = '#5fb8ff'; c.beginPath(); c.arc(px + 570, py + 60, 13, 0, TAU); c.fill();
  txt(c, 'parte neutra', px + 596, py + 60, { size: 32, weight: 600, family: 'Inter', align: 'left' });
  txt(c, 'recuerdo · esquema, no datos reales', px + pw / 2, py + ph - 35, { size: 24, weight: 500, family: 'Inter', color: 'rgba(220,226,240,0.6)' });
  c.restore();
  title(c, 'LO EMOCIONAL BAJÓ', W / 2, 330, lt, 0.1, d + 0.3, { size: 76, weight: 800, spacing: 3, color: '#ff8a8a', glowPx: 26, glowColor: '#ff1030' });
  title(c, '…lo neutro, no', W / 2, 420, lt, N - 0.1, d + 0.3, { size: 60, weight: 700, italic: true, color: '#9fd4ff' });
};

// 8 · Foco de túnel: el arma nítida, la calle se pierde
const GUN = { slide: [[-1, -0.3], [-0.92, -0.38], [-0.84, -0.3], [0.7, -0.3], [0.7, -0.02], [-1, -0.02]], grip: [[0.24, -0.04], [0.66, -0.04], [0.86, 0.8], [0.44, 0.84]] };
function drawGun(c, x, y, s, a) {
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s);
  const poly = pts => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); };
  c.shadowColor = '#ff2030'; c.shadowBlur = 50 / s;
  const fg = c.createLinearGradient(0, -0.4, 0, 0.8); fg.addColorStop(0, '#5a141c'); fg.addColorStop(1, '#14040a');
  c.fillStyle = fg;
  poly(GUN.slide); c.fill(); poly(GUN.grip); c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = '#ff5a68'; c.lineWidth = 3 / s;
  poly(GUN.slide); c.stroke(); poly(GUN.grip); c.stroke();
  c.beginPath(); c.moveTo(0.26, 0.0); c.quadraticCurveTo(0.24, 0.34, -0.12, 0.26); c.lineTo(-0.1, -0.02); c.stroke();
  c.beginPath(); c.moveTo(0.1, -0.02); c.quadraticCurveTo(0.14, 0.14, 0.06, 0.2); c.stroke();
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0.42 + i * 0.05, -0.27); c.lineTo(0.42 + i * 0.05, -0.08); c.stroke(); }
  c.restore();
}
SC.tunnel = (c, lt, d, sc0) => {
  const Ar = mark(sc0, 'arma', 3.7), Ca = mark(sc0, 'calle', 4.8);
  const narrow = easeIO(seg(lt, 0.3, Ca + 0.6));
  // calle nocturna en perspectiva
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05070f'); g.addColorStop(0.55, '#121a2e'); g.addColorStop(1, '#07080d');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.filter = `blur(${(2 + narrow * 14).toFixed(1)}px)`;
  const vx = W / 2, vy = 980;
  const r = rng(4);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = 1 + i * 0.9 - (lt * 0.4) % 0.9;
      const x = vx + side * 520 / z, w = 300 / z, h = 1100 / z;
      c.fillStyle = `rgb(${12 + i * 3},${16 + i * 3},${28 + i * 4})`;
      c.fillRect(side < 0 ? x - w : x, vy - h * 0.8, w, h);
      for (let k = 0; k < 6; k++) {
        if (r() < 0.45) continue;
        c.fillStyle = `rgba(255,${190 + r() * 50},${120 + r() * 60},${0.5 / Math.sqrt(z)})`;
        c.fillRect((side < 0 ? x - w : x) + w * (0.2 + 0.5 * r()), vy - h * (0.7 - k * 0.1), w * 0.15, h * 0.05);
      }
    }
  }
  c.fillStyle = '#0a0c14'; c.beginPath(); c.moveTo(vx - 60, vy); c.lineTo(vx + 60, vy); c.lineTo(W + 300, H); c.lineTo(-300, H); c.closePath(); c.fill();
  c.restore();
  bokehField(c, 8, lt, 24, ['#ffb36b', '#5fb8ff', '#ff6a6a'], { yMin: 600, yMax: 1300, rMin: 20, rMax: 70, alpha: 0.4 * (1 - narrow) });
  // túnel: la periferia se oscurece
  const rad = lerp(1400, 330, narrow);
  const tg = c.createRadialGradient(W / 2, 1010, rad * 0.35, W / 2, 1010, rad);
  tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(1,1,4,0.97)');
  c.fillStyle = tg; c.fillRect(0, 0, W, H);
  // objeto central nítido
  const ga = easeOut(seg(lt, 0.4, 1.2));
  glow(c, W / 2, 1010, 380, '#ff1a2e', 0.35 * ga);
  drawGun(c, W / 2 + 30, 990, 210 + 30 * narrow, ga);
  title(c, 'RECUERDAS EL ARMA…', W / 2, 330, lt, Ar - 0.2, d + 0.3, { size: 72, weight: 800, spacing: 3, color: '#ff8a8a', glowPx: 26, glowColor: '#ff1030' });
  title(c, '…pero no la calle', W / 2, 420, lt, Ca - 0.1, d + 0.3, { size: 58, weight: 600, italic: true });
  title(c, 'Lo negativo afina detalles', W / 2, 330, lt, 0.2, Ar - 0.1, { size: 58, weight: 700 });
  title(c, 'pero no todos', W / 2, 410, lt, 0.6, Ar - 0.1, { size: 50, weight: 600, italic: true, color: '#ff9fa8' });
  cite(c, 'Kensinger · Curr Dir Psychol Sci 2007', lt, 0.6, d + 0.3, 1480);
};

// 9 · Al dormir: lo emocional se conserva, lo neutro se apaga
SC.sleep = (c, lt, d) => {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05081a'); g.addColorStop(1, '#020309');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  glow(c, 860, 520, 260, '#9fb8ff', 0.35);
  glow(c, 860, 520, 70, '#e8eeff', 0.9);
  dust(c, 21, lt, 40, '#8fa8ff', 0.4);
  // persona tumbada (perfil girado)
  c.save(); c.translate(250, 1260); c.rotate(-Math.PI / 2);
  rimSilhouette(c, PROFILE, 0, 0, 380, '#7f9cff', 8, 0, '#03040b', 8);
  c.restore();
  c.save(); c.filter = 'blur(2px)'; c.fillStyle = '#0a0f24';
  c.beginPath(); c.moveTo(300, 1240); c.quadraticCurveTo(650, 1150, 1100, 1220); c.lineTo(1100, 1450); c.lineTo(250, 1450); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(127,156,255,0.5)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(300, 1240); c.quadraticCurveTo(650, 1150, 1100, 1220); c.stroke();
  c.restore();
  // ondas lentas del sueño
  c.save(); c.globalAlpha = inOut(lt, 0.2, d + 0.3);
  c.strokeStyle = '#7fb0ff'; c.lineWidth = 4; c.shadowColor = '#3a7cff'; c.shadowBlur = 14;
  c.beginPath();
  for (let x = 0; x <= W; x += 6) {
    const y = 1560 + Math.sin(x * 0.012 - lt * 2.2) * 38 + Math.sin(x * 0.045 - lt * 5) * 6;
    x ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke(); c.restore();
  // recuerdos: los emocionales (cálidos) suben y se quedan; los neutros (grises) se apagan
  const r = rng(66);
  const k = seg(lt, 0.6, d);
  for (let i = 0; i < 26; i++) {
    const emo = i % 3 === 0;
    const x = 260 + r() * 640, y0 = 1080 - r() * 380, ph = r() * TAU;
    const y = y0 - lt * (emo ? 40 : 25);
    const a = emo ? 0.5 + 0.5 * k : 0.7 * (1 - k);
    glow(c, x + Math.sin(lt + ph) * 12, y, emo ? 26 + 10 * k : 18, emo ? '#ff6a5a' : '#8a93a8', a);
  }
  title(c, 'AL DORMIR', W / 2, 330, lt, 0.1, d + 0.3, { size: 92, weight: 800, spacing: 10, color: '#c9d6ff', glowPx: 30, glowColor: '#3a5cff' });
  title(c, 'se consolida más lo emocional', W / 2, 425, lt, 0.5, d + 0.3, { size: 48, weight: 600, italic: true });
  cite(c, 'Payne et al. · Psychol Sci 2008', lt, 0.6, d + 0.3, 1680);
};

// 10 · Nítido no es exacto: el recuerdo se fragmenta
SC.sharp = (c, lt, d) => {
  c.fillStyle = '#05060b'; c.fillRect(0, 0, W, H);
  const s = 1.25;
  const gw = painPhoto.width * s, gh = painPhoto.height * s, x0 = W / 2 - gw / 2, y0 = 1000 - gh / 2;
  const gl = seg(lt, 0.4, d);
  c.save(); c.shadowColor = 'rgba(255,40,60,0.6)'; c.shadowBlur = 60;
  c.drawImage(painPhoto, x0, y0, gw, gh); c.restore();
  // franjas desplazadas (glitch)
  const r = rng(Math.floor(lt * 12) + 3);
  const n = Math.floor(4 + gl * 18);
  for (let i = 0; i < n; i++) {
    const sy = r() * painPhoto.height, sh = 8 + r() * 40, dx = (r() - 0.5) * 140 * gl;
    c.drawImage(painPhoto, 0, sy, painPhoto.width, sh, x0 + dx, y0 + sy * s, gw, sh * s);
  }
  if (gl > 0) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * gl;
    c.filter = 'hue-rotate(160deg)'; c.drawImage(painPhoto, x0 + 14 * gl, y0, gw, gh);
    c.restore();
    c.strokeStyle = `rgba(255,255,255,${0.5 * gl})`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 + gw * 0.2, y0); c.lineTo(x0 + gw * 0.45, y0 + gh * 0.4); c.lineTo(x0 + gw * 0.38, y0 + gh * 0.65); c.lineTo(x0 + gw * 0.7, y0 + gh); c.stroke();
  }
  title(c, 'NÍTIDO', W / 2, 300, lt, 0.05, d + 0.3, { size: 100, weight: 800, spacing: 12 });
  title(c, '≠ EXACTO', W / 2, 410, lt, 0.5, d + 0.3, { size: 100, weight: 800, spacing: 8, color: '#ff6a7a', glowPx: 30, glowColor: '#ff1030' });
};

// 11 · Tras el 11-S: confianza estable, consistencia que cae (esquema)
SC.chart = (c, lt, d, sc0) => {
  const M = mark(sc0, 'mantuvo', 2.8), Cx = mark(sc0, 'caia', 3.8);
  c.fillStyle = '#05070d'; c.fillRect(0, 0, W, H);
  bokehField(c, 41, lt, 22, ['#5fd3ff', '#ffbf5e'], { rMin: 40, rMax: 120, alpha: 0.1 });
  const px = 90, py = 600, pw = 900, ph = 760;
  const pa = inOut(lt, 0.1, d + 0.3, 0.4, 0.3);
  c.save(); c.globalAlpha = pa;
  roundRect(c, px, py, pw, ph, 36); c.fillStyle = 'rgba(8,12,26,0.86)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 2; c.stroke();
  const gx = px + 110, gy = py + 560, gw = pw - 190, gh = 400;
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.moveTo(gx, gy - gh - 20); c.lineTo(gx, gy); c.lineTo(gx + gw, gy); c.stroke();
  const ticks = [['1 día', 0], ['1 sem.', 0.22], ['6 sem.', 0.55], ['32 sem.', 1]];
  ticks.forEach(([s, f]) => txt(c, s, gx + gw * f, gy + 36, { size: 26, family: 'Inter', weight: 500, color: 'rgba(230,236,248,0.8)' }));
  txt(c, 'tiempo después del 11-S', gx + gw / 2, gy + 82, { size: 28, family: 'Inter', weight: 600 });
  const line = (fn, col, prog) => {
    c.save(); c.strokeStyle = col; c.lineWidth = 7; c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 18;
    c.beginPath();
    for (let i = 0; i <= 100 * prog; i++) { const f = i / 100, X = gx + gw * f, Y = gy - gh * fn(f); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }
    c.stroke(); c.restore();
  };
  const pC = easeIO(seg(lt, M - 0.6, M + 0.8)), pE = easeIO(seg(lt, Cx - 0.4, Cx + 1.2));
  line(f => 0.9 - 0.05 * f, PAL.gold, pC);
  line(f => 0.9 - 0.42 * Math.sqrt(f), PAL.cyan, pE);
  if (pC > 0.9) txt(c, 'Confianza', gx + gw - 4, gy - gh * 0.85 - 40, { size: 34, weight: 800, align: 'right', color: PAL.gold });
  if (pE > 0.9) txt(c, 'Consistencia del relato', gx + gw - 4, gy - gh * 0.48 + 46, { size: 32, weight: 800, align: 'right', color: PAL.cyan });
  txt(c, 'esquema basado en el estudio · no datos exactos', px + pw / 2, py + ph - 36, { size: 24, weight: 500, family: 'Inter', color: 'rgba(220,226,240,0.6)' });
  c.restore();
  title(c, 'TRAS EL 11-S', W / 2, 330, lt, 0.1, d + 0.3, { size: 84, weight: 800, spacing: 6 });
  title(c, 'la confianza se mantuvo… la exactitud cayó', W / 2, 420, lt, Cx - 0.2, d + 0.3, { size: 40, weight: 600, family: 'Inter' });
  cite(c, 'Talarico & Rubin · Psychol Sci 2003', lt, 0.6, d + 0.3, 1480);
};

// 12 · Sesgo de desvanecimiento afectivo: el dolor se apaga antes
SC.affect = (c, lt, d, sc0) => {
  const Dl = mark(sc0, 'dolor', 3.1), Al = mark(sc0, 'alegria', 5.4);
  c.fillStyle = '#07060c'; c.fillRect(0, 0, W, H);
  dust(c, 13, lt, 40, '#ffd9b0', 0.35);
  const t = easeIO(seg(lt, Dl - 0.3, d));
  const red = lerp(1, 0.18, t), gold = lerp(1, 0.78, t);
  const sh = seg(lt, Dl - 0.5, Dl);
  const lx = 300, rx = 780, cy = 950;
  glow(c, lx, cy, 340 * red, '#ff2a3a', 0.8 * red * (0.5 + 0.5 * sh));
  glow(c, lx, cy, 110 * red, '#ffd0d0', 0.9 * red * (0.5 + 0.5 * sh));
  const sg = seg(lt, Al - 0.6, Al);
  glow(c, rx, cy, 340 * gold, '#ffb347', 0.8 * gold * (0.5 + 0.5 * sg));
  glow(c, rx, cy, 110 * gold, '#fff1d0', 0.9 * gold * (0.5 + 0.5 * sg));
  txt(c, 'dolor', lx, cy + 300, { size: 46, weight: 800, color: '#ff8a8a', alpha: sh });
  txt(c, 'de un mal recuerdo', lx, cy + 352, { size: 30, weight: 500, family: 'Inter', alpha: sh });
  txt(c, 'alegría', rx, cy + 300, { size: 46, weight: 800, color: PAL.gold, alpha: sg });
  txt(c, 'de uno bueno', rx, cy + 352, { size: 30, weight: 500, family: 'Inter', alpha: sg });
  // barra de tiempo
  const ta = seg(lt, Dl - 0.3, Dl + 0.3);
  if (ta > 0) {
    c.save(); c.globalAlpha = ta;
    roundRect(c, 160, 1440, 760, 14, 7); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
    roundRect(c, 160, 1440, 760 * t + 1, 14, 7); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
    txt(c, 'el tiempo pasa →', W / 2, 1500, { size: 30, weight: 600, family: 'Inter', color: 'rgba(230,236,248,0.8)' });
    c.restore();
  }
  title(c, 'BUENA NOTICIA', W / 2, 330, lt, 0.1, d + 0.3, { size: 84, weight: 800, spacing: 6, color: '#ffe2b0', glowPx: 30, glowColor: '#ff8a2a' });
  title(c, 'el dolor se desvanece antes', W / 2, 425, lt, Dl, d + 0.3, { size: 52, weight: 700, italic: true });
  cite(c, 'Walker, Skowronski & Thompson · Rev Gen Psychol 2003', lt, 0.6, d + 0.3, 1610);
};

// 13 · Amanecer: «no colecciona sufrimiento»
SC.dawn = (c, lt, d) => {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#120d26'); g.addColorStop(0.45, '#3a2a55'); g.addColorStop(0.75, '#c8705a'); g.addColorStop(1, '#2a1520');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const k = easeIO(seg(lt, 0, d));
  glow(c, 920, 1250 - 80 * k, 700, '#ffb070', 0.6 + 0.2 * k);
  glow(c, 920, 1250 - 80 * k, 180, '#fff1d0', 0.9);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    c.save(); c.translate(920, 1250 - 80 * k); c.rotate(-2.6 + i * 0.16 + Math.sin(lt * 0.3 + i) * 0.02);
    const rg = c.createLinearGradient(0, 0, 1500, 0); rg.addColorStop(0, 'rgba(255,190,130,0.16)'); rg.addColorStop(1, 'rgba(255,190,130,0)');
    c.fillStyle = rg; c.beginPath(); c.moveTo(0, 0); c.lineTo(1500, -40 - i * 8); c.lineTo(1500, 40 + i * 8); c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
  dust(c, 9, lt, 50, '#ffd9b0', 0.5);
  rimSilhouette(c, PROFILE, 330, 900, 600 + 30 * k, '#ffc58a', 16, -6, '#0b0610', 14);
  c.save(); c.filter = 'blur(14px)'; c.fillStyle = 'rgba(10,6,14,0.9)'; c.fillRect(0, 1640, W, 300); c.restore();
  title(c, 'Tu cerebro no colecciona', W / 2, 330, lt, 0.1, d + 0.4, { size: 62, weight: 700, glowPx: 24, glowColor: '#ff8a4a' });
  title(c, 'SUFRIMIENTO.', W / 2, 425, lt, 0.5, d + 0.4, { size: 92, weight: 800, spacing: 6, color: '#ffe2b0', glowPx: 30, glowColor: '#ff7a1a' });
};

// 14 · Cierre: el cerebro pasa de rojo a calma
SC.calm = (c, lt, d, sc0) => {
  const Sv = mark(sc0, 'suavizarlo', 2.2);
  brainReset();
  const u = brain.mat.uniforms;
  const k = easeIO(seg(lt, Sv - 0.3, Sv + 1.6));
  u.uBase.value.setRGB(lerp(0.32, 0.15, k), lerp(0.12, 0.45, k), lerp(0.3, 0.95, k));
  setHL(0, REG.amyR, 0xff2a3a, 0.12, (1 - k) * 2.4);
  setHL(1, REG.amyL, 0xff2a3a, 0.12, (1 - k) * 2.4);
  setHL(2, REG.hipR, 0xffb347, 0.16, 0.8 + 0.6 * k);
  setHL(3, REG.hipL, 0xffb347, 0.16, 0.8 + 0.6 * k);
  orbitCam(brainCam, 0.5 + lt * 0.1, 6.0, 0.9, new THREE.Vector3(0, -0.75, 0));
  render3D(c, brainScene, brainCam);
  title(c, 'Guarda lo que siente', W / 2, 1160, lt, 0.15, d + 1, { size: 60, weight: 700 });
  title(c, 'IMPORTANTE…', W / 2, 1250, lt, 0.5, d + 1, { size: 76, weight: 800, spacing: 6, color: PAL.gold, glowPx: 26, glowColor: '#ff7a1a' });
  title(c, 'y con el tiempo, suele suavizarlo.', W / 2, 1350, lt, Sv, d + 1, { size: 48, weight: 600, italic: true, color: '#bfe6ff' });
  const fade = seg(lt, d - 0.35, d);
  if (fade > 0) { c.fillStyle = `rgba(0,0,0,${fade})`; c.fillRect(0, 0, W, H); }
};

// ---------------------------------------------------------------- subtítulos dinámicos (para la fase con voz)
let CAPTIONS = [];
// escenas cuya tipografía grande ya dice la frase narrada
const NO_CAPS = new Set(['hook', 'dawn', 'calm']);
function drawCaptions(c, t) {
  // cada entrada: { start, end, words: [{w, s, e}] } — se resalta la palabra activa
  const cap = CAPTIONS.find(k => t >= k.start && t < k.end);
  if (!cap || TL.showCaptions === false) return;
  const sc = TL.scenes.find(k => t >= k.start && t < k.end);
  if (sc && NO_CAPS.has(sc.id)) return;
  const a = inOut(t, cap.start, cap.end, 0.08, 0.08);
  c.save(); c.globalAlpha = a;
  c.font = '800 62px "Inter Display"'; c.letterSpacing = '1px';
  const lines = [[]]; let lw = 0;
  for (const w of cap.words) {
    const ww = c.measureText(w.w + ' ').width;
    if (lw + ww > 900 && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push({ ...w, ww }); lw += ww;
  }
  const y0 = 1330 - (lines.length - 1) * 40;
  lines.forEach((ln, li) => {
    const tw = ln.reduce((s, w) => s + w.ww, 0);
    let x = W / 2 - tw / 2;
    for (const w of ln) {
      const on = t >= w.s && t < w.e + 0.05;
      const pop = on ? 1 + 0.08 * (1 - seg(t, w.s, w.s + 0.12)) : 1;
      c.save(); c.translate(x + w.ww / 2, y0 + li * 80); c.scale(pop, pop);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineJoin = 'round';
      c.strokeText(w.w, 0, 0);
      c.fillStyle = on ? PAL.gold : '#ffffff';
      c.fillText(w.w, 0, 0);
      c.restore();
      x += w.ww;
    }
  });
  c.restore();
}

// ---------------------------------------------------------------- composición
let TL = null;
const TR = 0.22; // media duración del fundido cruzado
window.renderFrame = async (t, type = 'image/jpeg') => {
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  TL.scenes.forEach((s, i) => {
    if (t < s.start - TR || t > s.end + TR) return;
    const d = s.end - s.start;
    const a = i === 0 ? 1 : clamp((t - (s.start - TR)) / (2 * TR));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = 1;
    if (a < 1) {
      // dibuja en capa aparte para fundir sin acumular alfas internos
      layerCtx.globalAlpha = 1; layerCtx.filter = 'none'; layerCtx.globalCompositeOperation = 'source-over';
      layerCtx.clearRect(0, 0, W, H);
      SC[s.id](layerCtx, t - s.start, d, s);
      ctx.globalAlpha = a;
      ctx.drawImage(layer, 0, 0);
    } else {
      SC[s.id](ctx, t - s.start, d, s);
    }
    ctx.restore();
  });
  post(ctx, t);
  drawCaptions(ctx, t);
  return out.toDataURL(type, 0.93);
};
const layer = offscreen(W, H), layerCtx = layer.getContext('2d');

(async () => {
  TL = await (await fetch('timeline.json')).json();
  CAPTIONS = TL.captions || [];
  window.DURATION = TL.duration;
  await Promise.all([
    document.fonts.load('800 80px "Inter Display"'), document.fonts.load('700 80px "Inter Display"'),
    document.fonts.load('600 80px "Inter Display"'), document.fonts.load('italic 600 80px "Inter Display"'),
    document.fonts.load('500 40px "Inter"'), document.fonts.load('600 40px "Inter"'), document.fonts.load('700 40px "Inter"'),
  ]);
  quizasPts = sampleShape(g => {
    g.fillStyle = '#fff'; g.font = '800 170px "Inter Display"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('«quizás»', 450, 225);
  }, 900, 450, 2600, 9).map(([x, y]) => [x, y * 0.5]);
  window.READY = true;
})();
