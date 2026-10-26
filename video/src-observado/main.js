// Short 9:16 · «¿Por qué sentimos que alguien nos observa cuando estamos solos?»
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
  v1: new THREE.Vector3(0, 0.02, -0.92),
  tpjL: new THREE.Vector3(-0.62, 0.2, -0.4),
  tpjR: new THREE.Vector3(0.62, 0.2, -0.4),
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

// ---------------------------------------------------------------- ESCENAS · Tema 3: la sensación de ser observado
// marcas de tiempo locales de palabras clave (las rellena tools/sync.py a partir de la voz)
const mark = (s, k, def) => (s && s.marks && s.marks[k] != null ? s.marks[k] : def);
const SC = {};

// brillos fijos sobre regiones del cerebro
const regionGlows = (() => {
  const make = (p, col) => { const g = glowSprite3(col, 0.3, 0); g.material.depthTest = false; g.position.copy(p); brainRoot.add(g); return g; };
  return { amy: [make(REG.amyL, 0xff3a4a), make(REG.amyR, 0xff3a4a)], tpj: [make(REG.tpjL, 0x9a7bff), make(REG.tpjR, 0x9a7bff)] };
})();
function brainReset() {
  brainBase();
  [...regionGlows.amy, ...regionGlows.tpj].forEach(g => (g.material.opacity = 0));
}
function setHLrgb(i, pos, r, g, b, rad, amt) {
  const u = brain.mat.uniforms;
  u.uHL.value[i].copy(pos); u.uHLCol.value[i].setRGB(r, g, b); u.uHLRad.value[i] = rad; u.uHLAmt.value[i] = amt;
}

// par de ojos: look = -1 (izquierda) … 0 (te mira) … 1 (derecha)
function drawEyes(c, cx, cy, s, look, open = 1, glowCol = '#ff3a4a', a = 1) {
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

// silueta de cuerpo entero de perfil (mirando a la derecha); unidad = altura, origen = pies
const BODY = [[-0.02, -0.865], [0.045, -0.865], [0.075, -0.82], [0.09, -0.7], [0.075, -0.56], [0.075, -0.46], [0.055, -0.28],
  [0.045, -0.1], [0.11, -0.012], [0.11, 0], [-0.06, 0], [-0.07, -0.12], [-0.06, -0.27], [-0.09, -0.45], [-0.075, -0.52],
  [-0.09, -0.62], [-0.085, -0.8]];
function drawBody(c, x, y, h, fill, rim, a = 1, armOut = true) {
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

// pasillo oscuro con luz de luna (escena de apertura y de cierre)
function hallway(c, lt, push) {
  const vx = W / 2, vy = 900;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04060c'); g.addColorStop(1, '#020306');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sc = 1 + push * 0.25;
  c.save(); c.translate(vx, vy); c.scale(sc, sc); c.translate(-vx, -vy);
  // paredes, suelo y techo en perspectiva
  const far = { l: vx - 120, r: vx + 120, t: vy - 210, b: vy + 210 };
  const quad = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  quad([[-200, -200], [far.l, far.t], [far.l, far.b], [-200, H + 200]], '#0a0e18');
  quad([[W + 200, -200], [far.r, far.t], [far.r, far.b], [W + 200, H + 200]], '#080b14');
  quad([[-200, H + 200], [far.l, far.b], [far.r, far.b], [W + 200, H + 200]], '#06080f');
  quad([[-200, -200], [far.l, far.t], [far.r, far.t], [W + 200, -200]], '#05070c');
  c.fillStyle = '#010203'; c.fillRect(far.l, far.t, far.r - far.l, far.b - far.t);
  // marcos de puertas
  c.strokeStyle = 'rgba(120,150,210,0.18)'; c.lineWidth = 3;
  for (const z of [1.6, 2.6, 4]) {
    const k = 1 / z;
    for (const side of [-1, 1]) {
      const x = vx + side * (540 * k + 120 * (1 - k)), top = vy - 1000 * k - 210 * (1 - k), bot = vy + 1000 * k + 210 * (1 - k);
      const w2 = side * 140 * k;
      c.beginPath(); c.moveTo(x, bot); c.lineTo(x, top + 200 * k); c.lineTo(x + w2, top + 230 * k); c.lineTo(x + w2, bot - 30 * k); c.stroke();
    }
  }
  // luz de luna sobre el suelo
  c.save(); c.globalCompositeOperation = 'lighter';
  const mg = c.createLinearGradient(0, vy + 300, 0, H);
  mg.addColorStop(0, 'rgba(90,130,220,0.0)'); mg.addColorStop(1, 'rgba(90,130,220,0.22)');
  c.fillStyle = mg; c.beginPath(); c.moveTo(vx + 60, vy + 260); c.lineTo(vx + 260, vy + 260); c.lineTo(W + 100, H); c.lineTo(vx + 160, H); c.closePath(); c.fill();
  c.restore();
  c.restore();
  dust(c, 31, lt, 45, '#9fb8ff', 0.35);
}

// 1 · Gancho: pasillo, «alguien te mira»
SC.hall = (c, lt, d, sc0) => {
  const M = mark(sc0, 'mira', 4.4);
  const push = easeIO(seg(lt, 0, d));
  const shake = seg(lt, M - 0.2, M + 0.1) * (1 - seg(lt, M + 0.4, M + 1.2)) * 6;
  c.save(); c.translate(Math.sin(lt * 40) * shake, Math.cos(lt * 33) * shake);
  hallway(c, lt, push);
  // ojos al fondo
  const ea = seg(lt, M - 0.4, M) * (0.75 + 0.25 * Math.sin(lt * 9));
  glow(c, W / 2 - 22, 880, 16, '#ff5a5a', ea);
  glow(c, W / 2 + 22, 880, 16, '#ff5a5a', ea);
  // silueta en primer plano que gira la cabeza
  rimSilhouette(c, PROFILE, 180, 1180, 640, '#6f8fd8', 12, -6, '#020306', 12);
  c.restore();
  title(c, 'ESTÁS SOLO.', W / 2, 330, lt, 0.2, M - 0.1, { size: 104, weight: 800, spacing: 10, color: '#d8e2ff', glowPx: 30, glowColor: '#2a4cff' });
  title(c, '…¿o no?', W / 2, 330, lt, M, d + 0.3, { size: 110, weight: 800, italic: true, color: '#ff6a6a', glowPx: 40, glowColor: '#ff1030' });
};

// 2 · Detector de miradas: los ojos se giran hacia ti → amígdala
SC.gaze = (c, lt, d, sc0) => {
  const A = mark(sc0, 'amigdala', 2.5);
  const cut = A - 0.35;
  if (lt < cut) {
    c.fillStyle = '#030305'; c.fillRect(0, 0, W, H);
    const look = lerp(-1, 0, easeIO(seg(lt, 0.4, cut - 0.3)));
    drawEyes(c, W / 2, 980, 150, look, 1, '#ff3a4a', seg(lt, 0, 0.4));
  } else {
    const lt2 = lt - cut;
    brainReset();
    const pulse = 0.7 + 0.3 * Math.sin(lt * 8);
    const on = seg(lt2, 0, 0.5);
    setHL(0, REG.amyR, 0xff2a3a, 0.09, on * 3.2 * pulse);
    setHL(1, REG.amyL, 0xff2a3a, 0.09, on * 3.2 * pulse);
    regionGlows.amy.forEach(g => { g.material.opacity = on * pulse; g.scale.setScalar(0.28); });
    orbitCam(brainCam, 0.55 + lt2 * 0.15, lerp(4.4, 3.6, seg(lt2, 0, d - cut)), 0.35, new THREE.Vector3(0, -0.2, 0.08));
    render3D(c, brainScene, brainCam);
    drawEyes(c, W / 2, 1520, 46, 0, 1, '#ff3a4a', 0.85);
    const [px, py] = project(REG.amyR, brainCam, brain.pts);
    const [qx, qy] = project(REG.amyL, brainCam, brain.pts);
    const near = px > qx ? [px, py] : [qx, qy];
    label(c, near[0], near[1], Math.max(near[1] + 300, 1220), 'Amígdala', 'reacciona al contacto visual', '#ff5a6a', seg(lt2, 0.2, 0.6) * (1 - seg(lt, d - 0.2, d + 0.2)));
    cite(c, 'Kawashima et al. · Brain 1999', lt2, 0.4, d + 0.3, 1660);
  }
  title(c, 'DETECTOR', W / 2, 300, lt, 0.1, d + 0.3, { size: 100, weight: 800, spacing: 12 });
  title(c, 'DE MIRADAS', W / 2, 400, lt, 0.3, d + 0.3, { size: 84, weight: 800, spacing: 8, color: '#ff6a7a', glowPx: 30, glowColor: '#ff1030' });
};

// 3 · Paciente ciego: corteza visual apagada, amígdala que reacciona
SC.blind = (c, lt, d, sc0) => {
  const NV = mark(sc0, 'noVer', 6.4);
  const cut = 3.6;
  brainReset();
  const u = brain.mat.uniforms;
  setHLrgb(0, REG.v1, -0.6, -0.9, -1.4, 0.3, 1.6);
  const grey = seg(lt, 0.3, 1.0);
  setHLrgb(1, REG.v1, 0.25, 0.25, 0.28, 0.32, grey * 1.2);
  const flash = lt > cut ? Math.pow(Math.max(0, Math.sin((lt - cut) * 3.2)), 6) : 0;
  setHL(2, REG.amyR, 0xff2a3a, 0.09, lt > cut ? 1 + 3 * flash : 0);
  setHL(3, REG.amyL, 0xff2a3a, 0.09, lt > cut ? 1 + 3 * flash : 0);
  regionGlows.amy.forEach(g => { g.material.opacity = lt > cut ? 0.3 + 0.7 * flash : 0; g.scale.setScalar(0.3); });
  u.uAlpha.value = 0.9;
  if (lt < cut) orbitCam(brainCam, Math.PI - 0.5 + lt * 0.12, 4.2, 0.9, new THREE.Vector3(0, -0.05, -0.2));
  else orbitCam(brainCam, 0.9 + (lt - cut) * 0.15, 3.6, 0.4, new THREE.Vector3(0, -0.2, 0.05));
  render3D(c, brainScene, brainCam);
  if (lt < cut) {
    const [vx, vy] = project(REG.v1, brainCam, brain.pts);
    const gk = seg(lt, 0.3, 1.0);
    c.save(); c.globalAlpha = 0.8 * gk; c.fillStyle = 'rgba(120,126,140,0.35)';
    c.beginPath(); c.arc(vx, vy, 120, 0, TAU); c.fill();
    c.strokeStyle = '#c4cad8'; c.lineWidth = 6; c.setLineDash([16, 12]); c.stroke(); c.setLineDash([]); c.restore();
    label(c, vx, vy, Math.max(vy + 300, 1200), 'Corteza visual', 'lesionada: sin visión consciente', '#aab2c4', seg(lt, 0.8, 1.3) * (1 - seg(lt, cut - 0.3, cut)));
  } else {
    drawEyes(c, W / 2, 1450, 60, 0, 1, '#ff3a4a', 0.3 + 0.6 * flash);
    txt(c, 'mirada directa', W / 2, 1540, { size: 30, weight: 600, family: 'Inter', color: '#ff9fa8', alpha: 0.4 + 0.6 * flash });
  }
  title(c, 'UN PACIENTE CIEGO…', W / 2, 330, lt, 0.1, NV - 0.1, { size: 74, weight: 800, spacing: 3, color: '#d0d6e4' });
  title(c, 'QUE NO PODÍA VER', W / 2, 330, lt, NV - 0.1, d + 0.3, { size: 76, weight: 800, spacing: 3, color: '#ff8a8a', glowPx: 26, glowColor: '#ff1030' });
  title(c, 'la amígdala reaccionaba igual', W / 2, 420, lt, cut + 0.2, d + 0.3, { size: 46, weight: 600, italic: true });
  cite(c, 'Burra et al. · J Neurosci 2013 · un paciente', lt, 0.5, d + 0.3, 1680);
};

// 4 · Campo visual: cabeza ~90°, ojos ~4°
SC.field = (c, lt, d, sc0) => {
  const O = mark(sc0, 'ojos', 4.5);
  c.fillStyle = '#04060c'; c.fillRect(0, 0, W, H);
  bokehField(c, 55, lt, 18, ['#3b6dff', '#5fd3ff'], { rMin: 40, rMax: 120, alpha: 0.1 });
  const hx = W / 2, hy = 1380, R = 720;
  const sweep = easeOut(seg(lt, 0.3, 1.6));
  // abanico de la visión periférica (±90°)
  c.save(); c.globalCompositeOperation = 'lighter';
  const fg = c.createRadialGradient(hx, hy, 60, hx, hy, R);
  fg.addColorStop(0, 'rgba(95,211,255,0.32)'); fg.addColorStop(1, 'rgba(95,211,255,0.02)');
  c.fillStyle = fg; c.beginPath(); c.moveTo(hx, hy);
  c.arc(hx, hy, R, -Math.PI / 2 - Math.PI / 2 * sweep, -Math.PI / 2 + Math.PI / 2 * sweep); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(95,211,255,0.6)'; c.lineWidth = 3;
  c.beginPath(); c.arc(hx, hy, R, -Math.PI / 2 - Math.PI / 2 * sweep, -Math.PI / 2 + Math.PI / 2 * sweep); c.stroke();
  // cabezas en la periferia que giran
  const heads = [[-70, 520], [-40, 610], [35, 560], [75, 480]];
  heads.forEach(([ang, dist], i) => {
    const a = (ang - 90) * Math.PI / 180, x = hx + Math.cos(a) * dist, y = hy + Math.sin(a) * dist;
    const k = seg(lt, 0.8 + i * 0.2, 1.2 + i * 0.2) * sweep;
    if (k <= 0) return;
    c.save(); c.globalAlpha = k; c.translate(x, y); c.rotate(a + Math.PI / 2 + Math.sin(lt * 1.5 + i) * 0.6);
    c.fillStyle = '#9fdcff'; c.beginPath(); c.ellipse(0, 0, 30, 36, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-8, -34); c.lineTo(0, -50); c.lineTo(8, -34); c.fill();
    c.restore();
  });
  // cono estrecho de los ojos (~4°)
  const ek = easeOut(seg(lt, O - 0.3, O + 0.4));
  if (ek > 0) {
    const half = 4 * Math.PI / 180 * 1.6;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,191,94,${0.55 * ek})`;
    c.beginPath(); c.moveTo(hx, hy); c.arc(hx, hy, R * ek, -Math.PI / 2 - half, -Math.PI / 2 + half); c.closePath(); c.fill();
    c.restore();
    drawEyes(c, hx, hy - R * 0.62, 26, 0, 1, '#ffbf5e', ek);
  }
  // observador visto desde arriba
  c.fillStyle = '#1a2440'; c.beginPath(); c.ellipse(hx, hy + 30, 120, 60, 0, 0, TAU); c.fill();
  c.fillStyle = '#d8e2ff'; c.beginPath(); c.arc(hx, hy, 52, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(hx - 14, hy - 48); c.lineTo(hx, hy - 72); c.lineTo(hx + 14, hy - 48); c.fill();
  txt(c, 'Giro de la cabeza: hasta ~90°', W / 2, 1530, { size: 40, weight: 800, color: PAL.cyan, alpha: seg(lt, 1.2, 1.6) });
  txt(c, 'Dirección de los ojos: solo ~4°', W / 2, 1590, { size: 40, weight: 800, color: PAL.gold, alpha: ek });
  title(c, 'VISIÓN PERIFÉRICA', W / 2, 330, lt, 0.1, d + 0.3, { size: 80, weight: 800, spacing: 5, color: '#cfe8ff', glowPx: 26, glowColor: '#1f6dff' });
  cite(c, 'Loomis et al. · Perception 2008', lt, 0.5, d + 0.3, 1680);
};

// 5 · Ante la duda, «me mira»
SC.bias = (c, lt, d, sc0) => {
  const Ap = mark(sc0, 'apuesta', 4.2);
  c.fillStyle = '#030406'; c.fillRect(0, 0, W, H);
  const fog = 1 - seg(lt, Ap - 0.2, Ap + 0.6);
  glow(c, W / 2, 900, 700, '#1a2a50', 0.5);
  // figura frontal en la penumbra
  c.save(); c.filter = `blur(${(3 + 6 * fog).toFixed(1)}px)`;
  c.fillStyle = '#0b0e16';
  c.beginPath(); c.ellipse(W / 2, 880, 170, 215, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(W / 2 - 360, 1500); c.quadraticCurveTo(W / 2 - 330, 1150, W / 2 - 90, 1110); c.lineTo(W / 2 + 90, 1110);
  c.quadraticCurveTo(W / 2 + 330, 1150, W / 2 + 360, 1500); c.closePath(); c.fill();
  c.restore();
  // ojos con ruido → resueltos mirándote
  const look = lerp(Math.sin(lt * 1.3) * 0.7, 0, 1 - fog);
  drawEyes(c, W / 2, 860, 52, look, 0.9, '#ffbf5e', 0.25 + 0.75 * (1 - fog));
  if (fog > 0.02) {
    const r = rng(Math.floor(lt * 15));
    for (let i = 0; i < 260; i++) {
      const x = W / 2 + (r() - 0.5) * 300, y = 860 + (r() - 0.5) * 90;
      c.fillStyle = `rgba(${r() > 0.5 ? 200 : 20},${r() > 0.5 ? 205 : 22},${r() > 0.5 ? 220 : 30},${0.7 * fog})`;
      c.fillRect(x, y, 6, 6);
    }
  }
  // flecha de la mirada que se curva hacia ti
  const ak = seg(lt, Ap - 0.1, Ap + 0.7);
  if (ak > 0) {
    c.save(); c.globalAlpha = ak; c.strokeStyle = PAL.gold; c.lineWidth = 8; c.lineCap = 'round'; c.shadowColor = '#ff8a2a'; c.shadowBlur = 20;
    c.beginPath(); c.moveTo(W / 2 + 140, 860); c.quadraticCurveTo(W / 2 + 330, 1150, W / 2, 1380 * ak + 860 * (1 - ak)); c.stroke();
    c.restore();
  }
  title(c, 'CON POCA LUZ…', W / 2, 330, lt, 0.1, Ap - 0.1, { size: 82, weight: 800, spacing: 5, color: '#c9d6ff' });
  title(c, 'EL CEREBRO APUESTA', W / 2, 330, lt, Ap - 0.1, d + 0.3, { size: 76, weight: 800, spacing: 3, color: PAL.gold, glowPx: 26, glowColor: '#ff7a1a' });
  title(c, '«esa mirada es para mí»', W / 2, 420, lt, Ap + 0.3, d + 0.3, { size: 52, weight: 700, italic: true });
  cite(c, 'Mareschal, Calder & Clifford · Curr Biol 2013', lt, 0.5, d + 0.3, 1660);
};

// 6 · Principio del detector de humo
SC.smoke = (c, lt, d, sc0) => {
  const Mj = mark(sc0, 'mejor', 2.3), Rl = mark(sc0, 'real', 3.8);
  c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H);
  // detector en el techo
  const blink = Math.pow(Math.max(0, Math.sin(lt * 5)), 8);
  c.fillStyle = '#d9dde6'; c.beginPath(); c.ellipse(W / 2, 600, 190, 60, 0, 0, TAU); c.fill();
  c.fillStyle = '#b6bcc8'; c.beginPath(); c.ellipse(W / 2, 585, 150, 42, 0, 0, TAU); c.fill();
  glow(c, W / 2 + 90, 600, 60, '#ff2a3a', 0.4 + 0.6 * blink);
  for (let i = 0; i < 3; i++) {
    const p = (((lt * 0.9 + i / 3) % 1) + 1) % 1;
    c.strokeStyle = `rgba(255,90,100,${0.45 * (1 - p)})`; c.lineWidth = 4;
    c.beginPath(); c.ellipse(W / 2, 640, 200 + p * 420, 60 + p * 140, 0, 0, Math.PI); c.stroke();
  }
  // muchas falsas alarmas frente a una amenaza real
  const fk = seg(lt, Mj - 0.3, Mj + 1.0);
  const n = Math.floor(fk * 24);
  for (let i = 0; i < 24; i++) {
    const col = i % 6, row = Math.floor(i / 6);
    const x = 200 + col * 136, y = 1000 + row * 120;
    const isReal = i === 15;
    const on = i < n || (isReal && lt > Rl - 0.1);
    if (!on) continue;
    if (isReal) {
      const rk = seg(lt, Rl - 0.1, Rl + 0.3);
      glow(c, x, y, 70 * rk, '#ff2a3a', 0.9 * rk);
      c.fillStyle = `rgba(255,80,90,${rk})`; c.beginPath(); c.arc(x, y, 30, 0, TAU); c.fill();
    } else {
      c.strokeStyle = 'rgba(170,178,196,0.6)'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 26, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(x - 10, y - 10); c.lineTo(x + 10, y + 10); c.moveTo(x + 10, y - 10); c.lineTo(x - 10, y + 10); c.stroke();
    }
  }
  txt(c, 'falsas alarmas', 380, 1520, { size: 34, weight: 700, color: '#aab2c4', alpha: fk });
  txt(c, 'amenaza real', 820, 1520, { size: 34, weight: 800, color: '#ff6a7a', alpha: seg(lt, Rl, Rl + 0.4) });
  title(c, 'DETECTOR DE HUMO', W / 2, 300, lt, 0.1, d + 0.3, { size: 84, weight: 800, spacing: 5, color: '#ffd0d0', glowPx: 26, glowColor: '#ff1030' });
  title(c, 'mejor muchas falsas alarmas…', W / 2, 400, lt, Mj - 0.1, d + 0.3, { size: 50, weight: 700, italic: true });
  title(c, '…que ignorar una real', W / 2, 1640, lt, Rl, d + 0.3, { size: 52, weight: 800, color: '#ff8a8a' });
  cite(c, 'Nesse · Ann N Y Acad Sci 2001 · marco teórico', lt, 0.5, d + 0.3, 760);
};

// 7 · ¿Sexto sentido? Ciencia frente a creencia
SC.psi = (c, lt, d, sc0) => {
  const Al = mark(sc0, 'aleatorias', 3.4), Ds = mark(sc0, 'desaparecio', 6.8);
  c.fillStyle = '#05050a'; c.fillRect(0, 0, W, H);
  const cut = Al - 0.25;
  if (lt < cut) {
    // nuca de una persona; unos ojos detrás
    glow(c, W / 2, 1000, 600, '#3a2a6a', 0.35);
    c.fillStyle = '#0a0a12';
    c.beginPath(); c.ellipse(W / 2, 980, 190, 230, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(W / 2 - 420, 1700); c.quadraticCurveTo(W / 2 - 380, 1260, W / 2 - 110, 1200); c.lineTo(W / 2 + 110, 1200);
    c.quadraticCurveTo(W / 2 + 380, 1260, W / 2 + 420, 1700); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(160,140,255,0.5)'; c.lineWidth = 4; c.beginPath(); c.ellipse(W / 2, 980, 190, 230, 0, 0, TAU); c.stroke();
    drawEyes(c, W / 2, 660, 44, 0, 1, '#9a7bff', 0.4 + 0.3 * Math.sin(lt * 3));
    for (let i = 0; i < 3; i++) {
      const p = (((lt * 0.8 + i / 3) % 1) + 1) % 1;
      c.strokeStyle = `rgba(154,123,255,${0.4 * (1 - p)})`; c.lineWidth = 3;
      c.beginPath(); c.arc(W / 2, 700, 40 + p * 300, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    }
    badge(c, 'CREENCIA', '#8a8fa0', W / 2, 480, seg(lt, 0.5, 0.9));
    title(c, '¿SEXTO SENTIDO?', W / 2, 330, lt, 0.1, cut + 0.1, { size: 88, weight: 800, spacing: 4, color: '#cbbcff', glowPx: 26, glowColor: '#5a3cff' });
  } else {
    const lt2 = lt - cut;
    // secuencia de ensayos: primero con patrón, luego aleatoria
    const rnd = seg(lt2, 0.4, 1.2);
    const r = rng(77);
    for (let i = 0; i < 20; i++) {
      const pat = i % 2 === 0, ran = r() < 0.5;
      const v = rnd < 0.5 ? pat : ran;
      const x = 120 + (i % 10) * 93, y = 600 + Math.floor(i / 10) * 110;
      c.fillStyle = v ? 'rgba(154,123,255,0.85)' : 'rgba(80,86,104,0.85)';
      roundRect(c, x - 36, y - 36, 72, 72, 16); c.fill();
      txt(c, v ? 'SÍ' : 'NO', x, y + 2, { size: 26, weight: 800, family: 'Inter', color: '#fff' });
    }
    txt(c, '¿te miran? SÍ / NO en cada ensayo', W / 2, 500 + 30, { size: 28, weight: 600, family: 'Inter', color: 'rgba(230,236,248,0.75)' });
    txt(c, rnd < 0.5 ? 'secuencia con patrón' : 'secuencia realmente aleatoria', W / 2, 850, { size: 34, weight: 700, color: rnd < 0.5 ? '#aab2c4' : PAL.cyan });
    // barra del «efecto» que cae al nivel del azar
    const fall = easeIO(seg(lt, Ds - 1.2, Ds));
    const bx = 260, by = 1450, bw = 560, maxH = 420;
    const val = lerp(0.85, 0.5, fall);
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + bw, by); c.stroke();
    c.setLineDash([12, 10]); c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.moveTo(bx, by - maxH * 0.5); c.lineTo(bx + bw, by - maxH * 0.5); c.stroke(); c.setLineDash([]);
    txt(c, 'azar (50%)', bx + bw + 10, by - maxH * 0.5, { size: 26, weight: 600, family: 'Inter', align: 'left', color: 'rgba(230,236,248,0.8)' });
    const g = c.createLinearGradient(0, by - maxH * val, 0, by); g.addColorStop(0, '#9a7bff'); g.addColorStop(1, 'rgba(40,30,80,0.6)');
    c.fillStyle = g; roundRect(c, bx + bw / 2 - 90, by - maxH * val, 180, maxH * val, 20); c.fill();
    txt(c, 'aciertos', bx + bw / 2, by + 40, { size: 32, weight: 700, family: 'Inter' });
    badge(c, 'CIENCIA', '#3ad08a', W / 2, 480, seg(lt2, 0.1, 0.5));
    title(c, 'SECUENCIAS ALEATORIAS', W / 2, 330, lt2, 0.05, Ds - cut - 0.1, { size: 72, weight: 800, spacing: 3, color: PAL.cyan });
    title(c, 'EL EFECTO DESAPARECIÓ', W / 2, 330, lt, Ds - 0.1, d + 0.3, { size: 72, weight: 800, spacing: 3, color: '#3ad08a', glowPx: 26, glowColor: '#0a8a4a' });
    cite(c, 'Colwell, Schröder & Sladen · Br J Psychol 2000', lt2, 0.3, d + 0.3, 1600);
  }
};
function badge(c, text, col, x, y, a) {
  if (a <= 0.01) return;
  c.save(); c.globalAlpha = a;
  c.font = '800 34px "Inter Display"'; c.letterSpacing = '6px';
  const w = c.measureText(text).width + 60;
  roundRect(c, x - w / 2, y - 30, w, 60, 30); c.strokeStyle = col; c.lineWidth = 3; c.stroke();
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x + 3, y + 1);
  c.restore();
}

// 8 · El robot de Blanke: «alguien detrás» que es tu propio cuerpo
function robotArm(c, x, y, s, ang1, ang2, col) {
  c.save(); c.translate(x, y); c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round';
  c.fillRect(-0.12 * s, 0, 0.24 * s, 0.12 * s);
  c.lineWidth = 0.07 * s; c.rotate(ang1);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -0.45 * s); c.stroke();
  c.beginPath(); c.arc(0, -0.45 * s, 0.06 * s, 0, TAU); c.fill();
  c.translate(0, -0.45 * s); c.rotate(ang2);
  c.lineWidth = 0.05 * s; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -0.38 * s); c.stroke();
  c.beginPath(); c.arc(0, -0.38 * s, 0.035 * s, 0, TAU); c.fill();
  c.restore();
}
SC.robot = (c, lt, d, sc0) => {
  const Dt = mark(sc0, 'detras', 4.4), Cu = mark(sc0, 'cuerpo', 5.9);
  const cut = Cu + 1.7;
  if (lt < cut) {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#060912'); g.addColorStop(1, '#03040a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // rejilla de laboratorio
    c.strokeStyle = 'rgba(95,211,255,0.06)'; c.lineWidth = 2;
    for (let x = 0; x < W; x += 90) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 90) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    glow(c, 560, 900, 700, '#1f3a7a', 0.4);
    c.fillStyle = '#0c1220'; c.fillRect(0, 1460, W, 460);
    const px = 520, py = 1460, ph = 900;
    // fantasma detrás (aparece tras «detrás», se funde con la persona en «cuerpo»)
    const ga = seg(lt, Dt - 0.3, Dt + 0.4);
    const merge = easeIO(seg(lt, Cu - 0.1, Cu + 1.2));
    if (ga > 0) {
      const gx = lerp(px - 260, px, merge);
      c.save(); c.globalCompositeOperation = 'lighter';
      drawBody(c, gx, py, ph, `rgba(150,130,255,${0.22 * ga})`, '#9a7bff', 1, true);
      c.restore();
    }
    drawBody(c, px, py, ph, '#05070c', '#5fb8ff', 1, true);
    // brazo robótico delante (lo mueve el voluntario)
    const mv = Math.sin(lt * 2.2) * 0.25;
    robotArm(c, 860, 1460, 420, 0.25 + mv * 0.3, -1.2 + mv, '#8aa0c8');
    // brazo robótico detrás (toca la espalda con retraso)
    const mvD = Math.sin((lt - 0.5) * 2.2) * 0.25;
    robotArm(c, 170, 1460, 420, -0.15 + mvD * 0.2, 1.15 - mvD * 0.5, '#8aa0c8');
    const touch = Math.pow(Math.max(0, Math.sin((lt - 0.5) * 2.2)), 4);
    glow(c, 440, 820, 70, '#ff5a6a', 0.3 + 0.6 * touch);
    if (lt < Dt) txt(c, 'toque con retraso', 300, 740, { size: 30, weight: 700, color: '#ff9fa8', alpha: seg(lt, 1.0, 1.4) });
    if (merge > 0.6) txt(c, 'su propio cuerpo', px, 470 + 1460 - ph - 60, { size: 40, weight: 800, color: '#cbbcff', alpha: seg(merge, 0.6, 1) });
    title(c, 'EN SUIZA, UN ROBOT…', W / 2, 300, lt, 0.1, Dt - 0.1, { size: 72, weight: 800, spacing: 3, color: '#cfe8ff', glowPx: 26, glowColor: '#1f6dff' });
    title(c, 'ALGUIEN DETRÁS', W / 2, 300, lt, Dt - 0.1, Cu - 0.1, { size: 84, weight: 800, spacing: 5, color: '#cbbcff', glowPx: 30, glowColor: '#5a3cff' });
    title(c, 'ERA SU PROPIO CUERPO', W / 2, 300, lt, Cu - 0.1, cut + 0.2, { size: 70, weight: 800, spacing: 3, color: '#cbbcff', glowPx: 30, glowColor: '#5a3cff' });
    cite(c, 'Blanke et al. · Curr Biol 2014', lt, 0.5, cut + 0.2, 1660);
  } else {
    const lt2 = lt - cut;
    brainReset();
    const on = seg(lt2, 0, 0.6), pulse = 0.75 + 0.25 * Math.sin(lt * 6);
    setHL(0, REG.tpjR, 0xc08aff, 0.26, on * 4.5 * pulse);
    setHL(1, REG.tpjL, 0xc08aff, 0.26, on * 4.5 * pulse);
    regionGlows.tpj.forEach(g => { g.material.opacity = on * pulse; g.scale.setScalar(0.5); });
    orbitCam(brainCam, 1.1 + lt2 * 0.2, 4.6, 0.8, new THREE.Vector3(0, -0.05, -0.1));
    render3D(c, brainScene, brainCam);
    title(c, 'EL CEREBRO', W / 2, 300, lt2, 0.05, d, { size: 84, weight: 800, spacing: 6 });
    title(c, 'atribuyó su cuerpo a «otro»', W / 2, 400, lt2, 0.25, d, { size: 50, weight: 600, italic: true, color: '#cbbcff' });
    cite(c, 'Arzy et al. · Nature 2006 · Blanke et al. 2014', lt2, 0.3, d, 1640);
  }
};

// 9 · Revelación: «eres tú»
SC.reveal = (c, lt, d, sc0) => {
  const E = mark(sc0, 'eresTu', 2.9);
  hallway(c, lt + 6, 0.6 + 0.4 * easeIO(seg(lt, 0, d)));
  // figura al fondo del pasillo
  const fa = seg(lt, 0.3, 1.4);
  const s = lerp(220, 300, seg(lt, 0, d));
  c.save(); c.globalAlpha = fa;
  rimSilhouette(c, PROFILE.map(([x, y]) => [-x, y]), W / 2 + 30, 900 - s * 0.6, s, '#6f8fd8', -6, -3, '#020306', 5);
  c.restore();
  // en «eres tú», el primer plano y el fondo son la misma silueta
  const flash = seg(lt, E - 0.05, E + 0.1) * (1 - seg(lt, E + 0.15, E + 0.9));
  rimSilhouette(c, PROFILE, 180, 1180, 640, '#6f8fd8', 12, -6, '#020306', 12);
  if (flash > 0) { c.fillStyle = `rgba(200,215,255,${0.35 * flash})`; c.fillRect(0, 0, W, H); }
  title(c, 'Ese alguien que te observa…', W / 2, 330, lt, 0.2, d + 0.5, { size: 60, weight: 700, color: '#d8e2ff' });
  title(c, 'ERES TÚ.', W / 2, 460, lt, E, d + 0.5, { size: 140, weight: 800, spacing: 12, color: '#ffffff', glowPx: 50, glowColor: '#5a7cff', fi: 0.2 });
  const fade = seg(lt, d - 0.5, d);
  if (fade > 0) { c.fillStyle = `rgba(0,0,0,${fade})`; c.fillRect(0, 0, W, H); }
};

// ---------------------------------------------------------------- subtítulos dinámicos (para la fase con voz)
let CAPTIONS = [];
// escenas cuya tipografía grande ya dice la frase narrada
const NO_CAPS = new Set(['hall', 'reveal']);
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
