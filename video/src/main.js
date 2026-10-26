// Short 9:16 · «¿Por qué nuestro cerebro se obsesiona con alguien que no podemos tener?»
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
    scene.add(m); scene.add(gl); receptors.push({ m, gl, y });
  }
  // moléculas de dopamina
  const mols = [];
  for (let i = 0; i < 6 * 34; i++) {
    const s = glowSprite3(0xffd27a, 0.13, 0);
    s.userData = { v: Math.floor(i / 34), dx: (r() - 0.5) * 1.6, dz: (r() - 0.5) * 0.8, sp: 0.7 + r() * 0.6, wob: r() * TAU };
    scene.add(s); mols.push(s);
  }
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.05, 50);
  function update(lt) {
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
      m.position.set(vp.x + d.dx * e + Math.sin(lt * 6 + d.wob) * 0.03, lerp(0.36, -0.42, e), d.dz * e);
      m.material.opacity = k < 1.2 ? 1 : 1 - (k - 1.2) / 0.4;
      if (k > 0.85) {
        const idx = Math.round((m.position.x + 1.1) / 0.275);
        if (idx >= 0 && idx < recHit.length) recHit[idx] += 0.12;
      }
    });
    receptors.forEach((rc, i) => {
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

// marcas de tiempo locales de palabras clave (las rellena tools/sync.py a partir de la voz)
const mark = (s, k, def) => (s && s.marks && s.marks[k] != null ? s.marks[k] : def);

// ---------------------------------------------------------------- ESCENAS
const SC = {};

// 1 · Gancho: teléfono, "escribiendo…" que desaparece
SC.phone = (c, lt, d, sc0) => {
  const D = mark(sc0, 'duda', 2.3);
  c.fillStyle = '#03040a'; c.fillRect(0, 0, W, H);
  bokehField(c, 1, lt, 26, ['#2b4cff', '#7a3cff', '#00a2ff'], { rMin: 30, rMax: 120, alpha: 0.22 });
  const push = easeIO(seg(lt, 0, d));
  const dim = seg(lt, D - 0.45, D + 0.1);
  c.save();
  c.translate(W / 2, 1030);
  c.rotate((-7 + 3 * push) * Math.PI / 180);
  const sc = 1.0 + 0.08 * push - 0.06 * dim;
  c.scale(sc, sc);
  const pw = 600, ph = 1180;
  glow(c, 0, 0, 900, '#2c6bff', 0.35 * (1 - 0.5 * dim));
  // cuerpo del teléfono
  c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 60;
  roundRect(c, -pw / 2, -ph / 2, pw, ph, 78); c.fillStyle = '#0b0d13'; c.fill(); c.restore();
  const eg = c.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
  eg.addColorStop(0, 'rgba(160,190,255,0.55)'); eg.addColorStop(0.5, 'rgba(60,70,90,0.2)'); eg.addColorStop(1, 'rgba(140,120,255,0.45)');
  c.strokeStyle = eg; c.lineWidth = 4; roundRect(c, -pw / 2, -ph / 2, pw, ph, 78); c.stroke();
  // pantalla
  const sx = -pw / 2 + 20, sy = -ph / 2 + 20, sw = pw - 40, sh = ph - 40;
  c.save(); roundRect(c, sx, sy, sw, sh, 60); c.clip();
  const sg = c.createLinearGradient(0, sy, 0, sy + sh); sg.addColorStop(0, '#111a2e'); sg.addColorStop(1, '#0a0f1c');
  c.fillStyle = sg; c.fillRect(sx, sy, sw, sh);
  // cabecera del chat
  c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(sx, sy, sw, 190);
  const ag = c.createLinearGradient(sx + 40, sy + 70, sx + 140, sy + 170); ag.addColorStop(0, '#ff8fb1'); ag.addColorStop(1, '#7a5cff');
  c.fillStyle = ag; c.beginPath(); c.arc(sx + 95, sy + 115, 46, 0, TAU); c.fill();
  c.fillStyle = 'rgba(10,10,25,0.55)'; c.beginPath(); c.arc(sx + 95, sy + 102, 17, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(sx + 95, sy + 150, 30, 20, 0, Math.PI, 0); c.fill();
  txt(c, 'Alex', sx + 165, sy + 98, { size: 40, weight: 700, family: 'Inter', align: 'left' });
  const typing = lt > 0.55 && lt < D - 0.15;
  txt(c, typing ? 'escribiendo…' : 'en línea', sx + 165, sy + 142, { size: 28, weight: 500, family: 'Inter', align: 'left', color: typing ? '#7ee0a8' : 'rgba(220,230,255,0.6)' });
  // mensajes
  const bubble = (x, y, w, h, mine, text, a = 1) => {
    c.save(); c.globalAlpha *= a;
    roundRect(c, x, y, w, h, 34);
    if (mine) { const bg = c.createLinearGradient(x, y, x + w, y + h); bg.addColorStop(0, '#3b6dff'); bg.addColorStop(1, '#6a4dff'); c.fillStyle = bg; }
    else c.fillStyle = '#1e2740';
    c.fill();
    if (text) txt(c, text, x + 32, y + h / 2, { size: 34, weight: 500, family: 'Inter', align: 'left' });
    c.restore();
  };
  bubble(sx + 30, sy + 250, 330, 84, false, 'Jaja sí, fue genial');
  bubble(sx + sw - 30 - 400, sy + 370, 400, 84, true, '¿Repetimos este finde?');
  txt(c, 'Visto 23:47', sx + sw - 34, sy + 486, { size: 24, weight: 500, family: 'Inter', align: 'right', color: 'rgba(200,210,240,0.55)' });
  // indicador "escribiendo"
  const tIn = seg(lt, 0.55, 0.75), tOut = seg(lt, D - 0.3, D - 0.1);
  const ta = tIn * (1 - tOut);
  if (ta > 0) {
    bubble(sx + 30, sy + 540, 150, 80, false, '', ta);
    for (let i = 0; i < 3; i++) {
      const b = Math.max(0, Math.sin(lt * 9 - i * 0.9));
      c.fillStyle = `rgba(220,230,255,${(0.45 + 0.55 * b) * ta})`;
      c.beginPath(); c.arc(sx + 75 + i * 30, sy + 580 - b * 8, 9, 0, TAU); c.fill();
    }
  }
  c.restore();
  c.restore();
  // oscurecer para el gancho
  c.fillStyle = `rgba(2,3,8,${0.62 * dim})`; c.fillRect(0, 0, W, H);
  // textos del gancho
  title(c, '¿Y si no te obsesiona', W / 2, 330, lt, 0.12, D - 0.25, { size: 70, weight: 700, glowPx: 20, glowColor: '#000' });
  title(c, 'esa persona…', W / 2, 420, lt, 0.35, D - 0.25, { size: 70, weight: 700, glowPx: 20, glowColor: '#000' });
  title(c, '…sino la', W / 2, 820, lt, D - 0.35, d + 0.4, { size: 76, weight: 600 });
  const dk = seg(lt, D - 0.1, D + 0.3);
  if (dk > 0) {
    const shake = (1 - dk) * 10;
    const s = 230 + (1 - easeOut(dk)) * 140;
    txt(c, 'DUDA?', W / 2 + Math.sin(lt * 70) * shake, 1010, { size: s, weight: 800, color: PAL.gold, alpha: dk, glowPx: 60, glowColor: '#ff8a2a', spacing: 6 });
  }
};

// 2 · Ventana de noche: perfil iluminado por el teléfono, lluvia
const rain = (() => {
  const r = rng(77), d = [];
  for (let i = 0; i < 160; i++) d.push({ x: r() * W, y: r() * H, s: 3 + r() * 9, v: 10 + r() * 90, ph: r() });
  return d;
})();
function drawRain(c, lt, a = 1) {
  for (const p of rain) {
    const y = (p.y + lt * p.v * (p.s > 8 ? 2 : 0.4)) % H;
    c.save(); c.globalAlpha = 0.55 * a;
    c.fillStyle = 'rgba(180,210,255,0.35)';
    c.beginPath(); c.ellipse(p.x, y, p.s * 0.8, p.s, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath(); c.arc(p.x - p.s * 0.25, y - p.s * 0.3, p.s * 0.25, 0, TAU); c.fill();
    if (p.s > 8) { c.fillStyle = 'rgba(170,200,255,0.18)'; c.fillRect(p.x - 1.5, y - 120, 3, 115); }
    c.restore();
  }
}
SC.window = (c, lt, d, sc0) => {
  const A = mark(sc0, 'aun', 2.4);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#060b1a'); g.addColorStop(0.6, '#0b1430'); g.addColorStop(1, '#05070f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.filter = 'blur(6px)';
  bokehField(c, 12, lt, 55, ['#ff9a4a', '#ffd27a', '#37c6ff', '#ff5a7a', '#8a6bff'], { yMin: 700, yMax: 1700, rMin: 18, rMax: 70, alpha: 0.55, par: 0.4 });
  c.restore();
  drawRain(c, lt, 1);
  // marco de ventana desenfocado
  c.save(); c.filter = 'blur(14px)'; c.fillStyle = '#010205'; c.fillRect(90, 0, 60, H); c.fillRect(0, 560, W, 40); c.restore();
  const k = easeIO(seg(lt, 0, d));
  const s = 560 + 70 * k, x = 360 + 20 * k, y = 820 - 40 * k;
  // luz del teléfono frente a la cara
  glow(c, x + s * 0.75, y + s * 1.05, 520, '#4aa8ff', 0.6);
  rimSilhouette(c, PROFILE, x, y, s, '#9fd4ff', 14, 10, '#03050b', 12);
  // pantalla del teléfono (en mano, fuera de cuadro abajo)
  c.save(); c.translate(x + s * 0.74, y + s * 1.2); c.rotate(-0.55); c.filter = 'blur(3px)';
  roundRect(c, -38, -70, 76, 140, 14); c.fillStyle = 'rgba(170,220,255,0.75)'; c.fill(); c.restore();
  glow(c, x + s * 0.74, y + s * 1.2, 200, '#8fd0ff', 0.6);
  title(c, 'NO TE CORRESPONDE…', W / 2, 330, lt, 0.25, A + 0.05, { size: 64, weight: 800, spacing: 4 });
  title(c, '…y aun así', W / 2, 300, lt, A, d + 0.4, { size: 62, weight: 600, italic: true });
  title(c, 'OCUPA TU MENTE', W / 2, 390, lt, A + 0.25, d + 0.4, { size: 76, weight: 800, color: PAL.cyan, glowPx: 30, glowColor: '#1f7dff', spacing: 3 });
};

// 3 · Recuerdos flotando con profundidad de campo
SC.memories = (c, lt, d) => {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120814'); g.addColorStop(1, '#05030a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  bokehField(c, 33, lt, 30, ['#ff9a6b', '#ff5a8a', '#ffd29a'], { rMin: 30, rMax: 110, alpha: 0.18 });
  const r = rng(8);
  const items = photos.map((p, i) => ({
    p, x: (r() - 0.5) * 900, y: (r() - 0.5) * 1300 - 60, z0: 2.2 + i * 0.9 + r() * 0.4, rot: (r() - 0.5) * 0.35,
  }));
  const f = 900;
  items.forEach(it => { it.z = it.z0 - lt * 0.75; });
  items.sort((a, b) => b.z - a.z);
  const focus = 2.0;
  for (const it of items) {
    if (it.z < 0.35) continue;
    const s = f / (it.z * 900) * 1.05;
    const sx = W / 2 + it.x * s * 1.1, sy = H / 2 + it.y * s;
    const blur = Math.min(18, Math.abs(it.z - focus) * 7);
    const a = clamp((6.5 - it.z) / 2) * clamp((it.z - 0.35) / 0.4);
    c.save(); c.globalAlpha = a; c.translate(sx, sy); c.rotate(it.rot + lt * 0.03);
    if (blur > 0.5) c.filter = `blur(${blur.toFixed(1)}px)`;
    c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 40;
    c.drawImage(it.p, -it.p.width * s / 2, -it.p.height * s / 2, it.p.width * s, it.p.height * s);
    c.restore();
  }
  lightLeak(c, 900, 300, 600, 400, 'rgba(255,140,90,0.55)', 0.5 + 0.2 * Math.sin(lt * 2));
  dust(c, 4, lt, 40, '#ffd9a8', 0.5);
  title(c, '15 PERSONAS', W / 2, 330, lt, 0.2, d + 0.3, { size: 84, weight: 800, color: PAL.gold, spacing: 6, glowPx: 26, glowColor: '#ff7a2a' });
  title(c, 'rechazadas… pero aún enamoradas', W / 2, 420, lt, 0.6, d + 0.3, { size: 50, weight: 600, italic: true });
};

// 4 · Escáner: cerebro girando y plano de corte
SC.scan = (c, lt, d) => {
  brainBase();
  const u = brain.mat.uniforms;
  u.uScanOn.value = 1; u.uScanZ.value = lerp(1.0, -1.0, (lt * 0.55) % 1);
  orbitCam(brainCam, 0.9 + lt * 0.22, lerp(5.6, 5.0, seg(lt, 0, d)), 0.7, new THREE.Vector3(0, -0.12, 0));
  brainRoot.rotation.set(0, 0, 0);
  render3D(c, brainScene, brainCam);
  hud(c, lt, d);
  title(c, 'fMRI · 2010', W / 2, 330, lt, 0.15, d + 0.3, { size: 76, weight: 800, spacing: 8, color: PAL.cyan, glowPx: 26, glowColor: '#0a6cff' });
  title(c, 'escaneo cerebral por resonancia', W / 2, 415, lt, 0.5, d + 0.3, { size: 44, weight: 500, family: 'Inter' });
  cite(c, 'Fisher et al. · J Neurophysiol 2010', lt, 0.6, d + 0.3);
};
function hud(c, lt, d) {
  const a = inOut(lt, 0.1, d + 0.3, 0.4, 0.3);
  c.save(); c.globalAlpha = a * 0.75; c.strokeStyle = PAL.cyan; c.lineWidth = 3;
  const m = 90, L = 70, top = 560, bot = 1340;
  for (const [x, y, sx, sy] of [[m, top, 1, 1], [W - m, top, -1, 1], [m, bot, 1, -1], [W - m, bot, -1, -1]]) {
    c.beginPath(); c.moveTo(x, y + L * sy); c.lineTo(x, y); c.lineTo(x + L * sx, y); c.stroke();
  }
  txt(c, 'REC ●', m + 10, top + 40, { size: 26, family: 'Inter', weight: 600, align: 'left', color: Math.sin(lt * 6) > 0 ? '#ff5a6a' : 'rgba(255,90,106,0.35)' });
  txt(c, 'BOLD · T2*', W - m - 10, top + 40, { size: 26, family: 'Inter', weight: 600, align: 'right', color: PAL.cyan });
  txt(c, `SLICE ${String(Math.floor(lt * 37) % 64).padStart(2, '0')}/64`, m + 10, bot - 40, { size: 24, family: 'Inter', weight: 500, align: 'left', color: PAL.cyan });
  c.restore();
}

// 5 · Inmersión hasta el área tegmental ventral
SC.vta = (c, lt, d) => {
  brainBase();
  const k = easeIO(seg(lt, 0, 3.2));
  const u = brain.mat.uniforms;
  u.uAlpha.value = lerp(1, 0.55, k);
  const pulse = 0.75 + 0.25 * Math.sin(lt * 5);
  setHL(0, REG.vta, 0xffb347, 0.09, seg(lt, 0.6, 1.6) * 3.2 * pulse);
  pathways.vtaGlow.material.opacity = seg(lt, 0.8, 1.8) * pulse;
  pathways.vtaGlow.scale.setScalar(0.35 + 0.1 * pulse);
  const tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, -0.12, 0), REG.vta, k);
  orbitCam(brainCam, 1.9 + lt * 0.12, lerp(5.0, 2.3, k), lerp(0.7, 0.25, k), tgt);
  render3D(c, brainScene, brainCam);
  const [px, py] = project(REG.vta, brainCam, brain.pts);
  label(c, px, py, py + 330, 'Área tegmental ventral', 'origen de neuronas de dopamina', PAL.gold, seg(lt, 1.6, 2.1) * (1 - seg(lt, d - 0.2, d + 0.2)));
  title(c, 'SISTEMA DE RECOMPENSA', W / 2, 330, lt, 0.3, d + 0.3, { size: 66, weight: 800, spacing: 4, color: PAL.gold, glowPx: 26, glowColor: '#ff7a1a' });
};

// 6 · Vía mesolímbica: ATV → estriado ventral
SC.pathway = (c, lt, d) => {
  brainBase();
  const u = brain.mat.uniforms;
  u.uAlpha.value = 0.55;
  const pulse = 0.75 + 0.25 * Math.sin(lt * 5);
  setHL(0, REG.vta, 0xffb347, 0.09, 3.0 * pulse);
  setHL(1, REG.nacL, 0xff9f45, 0.12, seg(lt, 0.9, 1.8) * 2.6 * pulse);
  setHL(2, REG.nacR, 0xff9f45, 0.12, seg(lt, 0.9, 1.8) * 2.6 * pulse);
  setHL(3, REG.pfc, 0xff7a5c, 0.3, seg(lt, 1.5, 2.5) * 0.9);
  setPathways(lt, seg(lt, 0.1, 0.9), seg(lt, 0.3, 1.0));
  pathways.vtaGlow.material.opacity = pulse;
  pathways.nacGlows.forEach(g => { g.material.opacity = seg(lt, 0.9, 1.8) * pulse; g.scale.setScalar(0.3 + 0.08 * pulse); });
  orbitCam(brainCam, 2.4 + lt * 0.16, lerp(2.9, 3.3, seg(lt, 0, d)), 0.45, new THREE.Vector3(0, -0.12, 0.08));
  render3D(c, brainScene, brainCam);
  const [ax, ay] = project(REG.nacR, brainCam, brain.pts);
  const [bx, by] = project(REG.nacL, brainCam, brain.pts);
  const right = ax > bx ? [ax, ay] : [bx, by];
  label(c, right[0], right[1], Math.max(right[1] + 300, 1150), 'Estriado ventral', 'recompensa y motivación', '#ff9f45', seg(lt, 1.2, 1.7) * (1 - seg(lt, d - 0.2, d + 0.2)));
  const words = ['RECOMPENSA', 'DESEO', 'ADICCIÓN'];
  words.forEach((w, i) => {
    const t0 = 0.3 + i * 1.2;
    title(c, w, W / 2, 330 + i * 92, lt, t0, d + 0.3, { size: 72, weight: 800, spacing: 6, color: i === 2 ? PAL.rose : PAL.white, glowPx: 24, glowColor: i === 2 ? '#ff1f5a' : '#ff8a2a' });
  });
};

// 7 · Red de neuronas con impulsos
SC.neurons = (c, lt, d, sc0) => {
  const T = mark(sc0, 'tambien', 2.3);
  neuro.update(lt);
  const k = seg(lt, 0, d);
  neuro.cam.position.set(lerp(0.6, -0.3, k), lerp(0.4, -0.1, k), lerp(4.6, 3.0, easeIO(k)));
  neuro.cam.lookAt(0, 0, -1.2);
  render3D(c, neuro.scene, neuro.cam);
  const fl = Math.pow(Math.max(0, Math.sin(lt * 2.4)), 12);
  c.fillStyle = `rgba(120,200,255,${0.06 * fl})`; c.fillRect(0, 0, W, H);
  title(c, 'DOPAMINA', W / 2, 340, lt, 0.2, d + 0.3, { size: 120, weight: 800, spacing: 14, color: PAL.cyan, glowPx: 40, glowColor: '#0a7cff' });
  title(c, 'no solo responde al placer…', W / 2, 455, lt, 0.9, T + 0.1, { size: 50, weight: 600, italic: true });
  title(c, 'también a la INCERTIDUMBRE', W / 2, 455, lt, T, d + 0.3, { size: 50, weight: 700, color: PAL.gold });
};

// 8 · Sinapsis + curva de incertidumbre (Fiorillo et al., 2003)
SC.synapse = (c, lt, d) => {
  syn.update(lt);
  const a = 0.35 + lt * 0.08;
  syn.cam.position.set(Math.sin(a) * 9.2, 1.5, Math.cos(a) * 9.2);
  syn.cam.lookAt(0, 0.95, 0);
  render3D(c, syn.scene, syn.cam, 230);
  // panel de la gráfica
  const pa = inOut(lt, 0.5, d + 0.3, 0.5, 0.3);
  if (pa > 0) {
    const px = 110, py = 470, pw = 860, ph = 330;
    c.save(); c.globalAlpha = pa;
    roundRect(c, px, py, pw, ph, 30); c.fillStyle = 'rgba(6,10,24,0.86)'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 2; c.stroke();
    const gx = px + 70, gy = py + 260, gw = pw - 140, gh = 170;
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(gx, gy - gh - 10); c.lineTo(gx, gy); c.lineTo(gx + gw, gy); c.stroke();
    ['0%', '50%', '100%'].forEach((s, i) => txt(c, s, gx + gw * i / 2, gy + 30, { size: 24, family: 'Inter', weight: 500, color: 'rgba(230,236,248,0.8)' }));
    txt(c, 'Probabilidad de recompensa', gx + gw / 2, gy + 62, { size: 26, family: 'Inter', weight: 600, color: 'rgba(230,236,248,0.9)' });
    txt(c, 'Actividad sostenida de neuronas dopaminérgicas', px + pw / 2, py + 40, { size: 27, family: 'Inter', weight: 600, color: PAL.cyan });
    const pr = easeIO(seg(lt, 0.8, 2.4));
    c.strokeStyle = PAL.gold; c.lineWidth = 6; c.lineCap = 'round';
    c.shadowColor = '#ff9a2a'; c.shadowBlur = 18;
    c.beginPath();
    for (let i = 0; i <= 100 * pr; i++) {
      const p = i / 100, v = 4 * p * (1 - p);
      const X = gx + gw * p, Y = gy - 12 - v * (gh - 30);
      i ? c.lineTo(X, Y) : c.moveTo(X, Y);
    }
    c.stroke(); c.shadowBlur = 0;
    const pk = seg(lt, 2.2, 2.6);
    if (pk > 0) {
      glow(c, gx + gw / 2, gy - 12 - (gh - 30), 60, PAL.gold, pk);
      txt(c, 'máxima con 50 / 50', gx + gw / 2 + 30, gy - gh - 4, { size: 30, weight: 700, align: 'left', color: PAL.gold, alpha: pk });
    }
    c.restore();
  }
  title(c, 'CUANDO NO SABES', W / 2, 300, lt, 0.2, d + 0.3, { size: 70, weight: 800, spacing: 4 });
  title(c, 'si llegará la recompensa', W / 2, 385, lt, 0.5, d + 0.3, { size: 50, weight: 600, italic: true, color: PAL.gold });
  cite(c, 'Fiorillo, Tobler & Schultz · Science 2003 · en primates', lt, 0.8, d + 0.3, 850);
};

// 9 · Estudio de 2011: tarjetas de perfil
SC.cards = (c, lt, d) => {
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1a0a1e'); g.addColorStop(1, '#070611');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.filter = 'blur(10px)';
  bokehField(c, 61, lt, 40, ['#ff5a8a', '#8a6bff', '#ffb36b'], { rMin: 30, rMax: 120, alpha: 0.35 });
  c.restore();
  const cards = [
    { t: 'Le gustas mucho', y: 640 },
    { t: 'Le gustas lo normal', y: 880 },
    { t: '¿Le gustas? No se sabe', y: 1120, q: true },
  ];
  const hi = seg(lt, 1.7, 2.2);
  cards.forEach((cd, i) => {
    const a = easeOut(seg(lt, 0.15 + i * 0.3, 0.6 + i * 0.3));
    if (a <= 0) return;
    const focus = cd.q ? 1 + 0.06 * hi : 1 - 0.04 * hi;
    const x = 120, w = 840, h = 190, y = cd.y + (1 - a) * 60;
    c.save(); c.globalAlpha = a * (cd.q ? 1 : 1 - 0.55 * hi);
    c.translate(W / 2, y + h / 2); c.scale(focus, focus); c.translate(-W / 2, -(y + h / 2));
    roundRect(c, x, y, w, h, 36); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill();
    c.strokeStyle = cd.q ? `rgba(255,191,94,${0.25 + 0.75 * hi})` : 'rgba(255,255,255,0.18)'; c.lineWidth = cd.q ? 3 + 2 * hi : 2; c.stroke();
    if (cd.q && hi > 0) { c.shadowColor = PAL.gold; c.shadowBlur = 40 * hi; c.stroke(); c.shadowBlur = 0; }
    const ag = c.createLinearGradient(x + 40, y + 40, x + 150, y + 150); ag.addColorStop(0, '#5a4a7a'); ag.addColorStop(1, '#2a2040');
    c.fillStyle = ag; c.beginPath(); c.arc(x + 105, y + h / 2, 62, 0, TAU); c.fill();
    c.fillStyle = 'rgba(10,8,20,0.7)'; c.beginPath(); c.arc(x + 105, y + h / 2 - 14, 22, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(x + 105, y + h / 2 + 34, 38, 24, 0, Math.PI, 0); c.fill();
    txt(c, cd.t, x + 200, y + 72, { size: 42, weight: 700, family: 'Inter', align: 'left', color: cd.q ? PAL.gold : PAL.white });
    c.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(c, x + 200, y + 112, 420, 18, 9); c.fill();
    roundRect(c, x + 200, y + 142, 300, 18, 9); c.fill();
    if (cd.q) {
      const qp = 1 + 0.12 * Math.sin(lt * 6);
      txt(c, '?', x + w - 80, y + h / 2, { size: 120 * qp, weight: 800, color: PAL.gold, alpha: 0.4 + 0.6 * hi, glowPx: 30, glowColor: '#ff8a2a' });
    }
    c.restore();
  });
  const ma = seg(lt, 2.3, 2.7);
  if (ma > 0) {
    txt(c, '↑ MÁS ATRACCIÓN', W / 2, 1385, { size: 58, weight: 800, color: PAL.gold, alpha: ma, glowPx: 26, glowColor: '#ff7a1a', spacing: 3 });
  }
  title(c, 'ESTUDIO DE 2011', W / 2, 330, lt, 0.1, d + 0.3, { size: 70, weight: 800, spacing: 6 });
  title(c, 'la duda aumentó la atracción', W / 2, 415, lt, 0.45, d + 0.3, { size: 50, weight: 600, italic: true, color: '#ff9fbf' });
  cite(c, 'Whitchurch, Wilson & Gilbert · Psychol Sci 2011', lt, 0.6, d + 0.3, 1480);
};

// 10 · Bucle de pensamientos alrededor de la cabeza
SC.thoughts = (c, lt, d) => {
  c.fillStyle = '#05040c'; c.fillRect(0, 0, W, H);
  bokehField(c, 70, lt, 20, ['#8a6bff', '#3b6dff'], { rMin: 40, rMax: 140, alpha: 0.15 });
  const k = seg(lt, 0, d);
  const hx = 470, hy = 900, s = 520;
  const cx = hx + 0.0 * s, cy = hy + 0.15 * s;
  // órbitas
  const intensity = 0.4 + 0.6 * k;
  for (let o = 0; o < 3; o++) {
    const rx = 330 + o * 90, ry = 120 + o * 30, tilt = -0.35 + o * 0.3, sp = (o % 2 ? -1 : 1) * (0.9 + o * 0.3);
    for (let i = 0; i < 80; i++) {
      const a = i / 80 * TAU + lt * sp;
      const x = cx + Math.cos(a) * rx * Math.cos(tilt) - Math.sin(a) * ry * Math.sin(tilt);
      const y = cy + Math.cos(a) * rx * Math.sin(tilt) + Math.sin(a) * ry * Math.cos(tilt);
      const front = Math.sin(a) > 0;
      if (!front) glow(c, x, y, 10, o === 1 ? PAL.violet : PAL.cyan, 0.35 * intensity);
    }
  }
  glow(c, cx + 120, cy - 60, 520, '#5a3cff', 0.35 * intensity);
  rimSilhouette(c, PROFILE, hx, hy, s, '#b9a4ff', 12, -8, '#030209', 12);
  // palabras que orbitan
  const words = [['¿le gusto?', 760, 560], ['¿y si…?', 250, 640], ['¿me escribirá?', 700, 1420], ['quizás…', 860, 980],
    ['¿por qué no responde?', 540, 1540], ['¿qué hice mal?', 300, 1300], ['¿y si mañana sí?', 640, 760]];
  words.forEach(([w, wx, wy], i) => {
    const t0 = i * 0.42;
    const a = seg(lt, t0, t0 + 0.4) * (1 - seg(lt, t0 + 2.4, t0 + 2.9));
    if (a <= 0) return;
    const x = wx + Math.sin(lt * 0.8 + i) * 18, y = wy + Math.cos(lt * 0.7 + i * 2) * 14 - lt * 10;
    txt(c, w, x, y, { size: 40 + (i % 3) * 6, weight: 600, family: 'Inter', italic: true, alpha: a * 0.9, blur: (1 - a) * 8, color: i % 2 ? '#d8ccff' : '#9fdcff', glowPx: 16, glowColor: '#5a3cff' });
  });
  for (let o = 0; o < 3; o++) {
    const rx = 330 + o * 90, ry = 120 + o * 30, tilt = -0.35 + o * 0.3, sp = (o % 2 ? -1 : 1) * (0.9 + o * 0.3);
    for (let i = 0; i < 80; i++) {
      const a = i / 80 * TAU + lt * sp;
      if (Math.sin(a) <= 0) continue;
      const x = cx + Math.cos(a) * rx * Math.cos(tilt) - Math.sin(a) * ry * Math.sin(tilt);
      const y = cy + Math.cos(a) * rx * Math.sin(tilt) + Math.sin(a) * ry * Math.cos(tilt);
      glow(c, x, y, 13, o === 1 ? PAL.violet : PAL.cyan, 0.6 * intensity);
    }
  }
  title(c, 'MÁS DUDA', W / 2, 330, lt, 0.1, d + 0.3, { size: 76, weight: 800, spacing: 6, color: '#cbbcff', glowPx: 24, glowColor: '#5a3cff' });
  title(c, '= más pensamientos en esa persona', W / 2, 415, lt, 0.5, d + 0.3, { size: 46, weight: 600, italic: true });
};

// 11-12 · Oso blanco: supresión y efecto rebote (Wegner et al., 1987)
function bearCloud(c, lt, cx, cy, sc, form, scatter, alpha, seed, color = '#e8f4ff') {
  const r = rng(seed);
  for (let i = 0; i < bearPts.length; i++) {
    const [bx, by] = bearPts[i];
    const sx = (r() - 0.5) * W * 1.6, sy = (r() - 0.5) * H * 1.2, dl = r() * 0.5;
    const f = easeIO(clamp((form - dl) / (1 - dl + 1e-6)));
    const ang = r() * TAU, rr = scatter * (300 + r() * 700);
    let x = lerp(cx + sx, cx + bx * sc, f) + Math.cos(ang) * rr;
    let y = lerp(cy + sy, cy + by * sc, f) + Math.sin(ang) * rr;
    x += Math.sin(lt * 2 + i) * 2; y += Math.cos(lt * 1.7 + i) * 2;
    const tw = 0.6 + 0.4 * Math.sin(lt * 3 + i * 1.3);
    glow(c, x, y, 7 + r() * 6, color, alpha * tw * (0.5 + 0.5 * f));
  }
}
SC.bear = (c, lt, d) => {
  c.fillStyle = '#020309'; c.fillRect(0, 0, W, H);
  glow(c, W / 2, 1000, 700, '#1d3a7a', 0.35);
  const form = seg(lt, 0.9, 2.8);
  bearCloud(c, lt, W / 2, 1000, 1050, form, 0, 0.75, 1);
  title(c, 'NO PIENSES', W / 2, 330, lt, 0.1, d + 0.3, { size: 92, weight: 800, spacing: 8 });
  title(c, 'EN UN OSO BLANCO', W / 2, 430, lt, 0.4, d + 0.3, { size: 70, weight: 800, spacing: 6, color: '#cfe8ff', glowPx: 26, glowColor: '#3a8cff' });
};
SC.rebound = (c, lt, d, sc0) => {
  const V = mark(sc0, 'volvia', 1.75);
  c.fillStyle = '#020309'; c.fillRect(0, 0, W, H);
  // onda de supresión que empuja el pensamiento hacia afuera…
  const push = easeOut(seg(lt, 0.2, 1.0)) * (1 - easeIO(seg(lt, 1.4, 2.6)));
  const ring = seg(lt, 0.15, 1.0);
  if (ring > 0 && ring < 1) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(120,180,255,${0.6 * (1 - ring)})`; c.lineWidth = 18 * (1 - ring) + 2;
    c.shadowColor = '#3a8cff'; c.shadowBlur = 40;
    c.beginPath(); c.arc(W / 2, 1000, 50 + ring * 900, 0, TAU); c.stroke(); c.restore();
  }
  const back = seg(lt, 1.4, 2.6);
  glow(c, W / 2, 1000, 700, '#1d3a7a', 0.35 + 0.3 * back);
  bearCloud(c, lt, W / 2, 1000, 1150, 1, push * 0.9, 0.8 + 0.4 * back, 1);
  // …y vuelve con más frecuencia: ecos del mismo pensamiento
  const echo = seg(lt, 2.4, 3.4);
  if (echo > 0) {
    bearCloud(c, lt, 250, 680, 420, echo, 0, 0.45 * echo, 2, '#bcdcff');
    bearCloud(c, lt, 840, 1400, 420, echo, 0, 0.45 * echo, 3, '#bcdcff');
    bearCloud(c, lt, 820, 640, 300, seg(lt, 2.8, 3.7), 0, 0.35 * echo, 4, '#bcdcff');
  }
  title(c, 'SUPRIMIRLO…', W / 2, 330, lt, 0.1, V + 0.15, { size: 84, weight: 800, spacing: 6 });
  title(c, '…lo hizo VOLVER más', W / 2, 330, lt, V, d + 0.3, { size: 76, weight: 800, color: '#cfe8ff', glowPx: 26, glowColor: '#3a8cff' });
  cite(c, 'Wegner et al. · J Pers Soc Psychol 1987', lt, 0.5, d + 0.3, 1480);
};

// 13 · Dolor: el rechazo activa regiones que se solapan con las del dolor físico
SC.pain = (c, lt, d) => {
  brainBase();
  const u = brain.mat.uniforms;
  u.uBase.value.setRGB(0.3, 0.14, 0.34);
  const beat = (t) => { const p = (t * 1.25) % 1; return Math.exp(-p * 18) + 0.6 * Math.exp(-Math.max(0, p - 0.22) * 18) * (p > 0.22 ? 1 : 0); };
  const b = beat(lt);
  const on = seg(lt, 0.3, 1.2);
  setHL(0, REG.insR, 0xff2a3a, 0.24, on * (1.6 + 1.6 * b));
  setHL(1, REG.s2R, 0xff5a3a, 0.22, on * (1.3 + 1.3 * b));
  setHL(2, REG.insL, 0xff2a3a, 0.24, on * (1.6 + 1.6 * b));
  bgDust.visible = false;
  orbitCam(brainCam, 1.25 + lt * 0.14, lerp(4.4, 3.8, seg(lt, 0, d)), 0.55, new THREE.Vector3(0.05, -0.05, 0));
  render3D(c, brainScene, brainCam);
  c.fillStyle = `rgba(255,30,50,${0.07 * b * on})`; c.fillRect(0, 0, W, H);
  // electrocardiograma
  c.save(); c.globalAlpha = inOut(lt, 0.2, d + 0.3);
  c.strokeStyle = '#ff4a5a'; c.lineWidth = 4; c.shadowColor = '#ff1f3a'; c.shadowBlur = 16;
  c.beginPath();
  for (let x = 0; x <= W; x += 4) {
    const tt = lt - (W - x) / W * 1.6;
    const p = ((tt * 1.25) % 1 + 1) % 1;
    let y = 0;
    if (p > 0.02 && p < 0.05) y = -30; else if (p >= 0.05 && p < 0.08) y = 140; else if (p >= 0.08 && p < 0.11) y = -60; else if (p > 0.25 && p < 0.33) y = 22 * Math.sin((p - 0.25) / 0.08 * Math.PI);
    const yy = 1530 - y * 0.6;
    x ? c.lineTo(x, yy) : c.moveTo(x, yy);
  }
  c.stroke(); c.restore();
  title(c, 'EL RECHAZO DUELE', W / 2, 330, lt, 0.2, d + 0.3, { size: 78, weight: 800, spacing: 4, color: '#ff8a8a', glowPx: 30, glowColor: '#ff1f3a' });
  title(c, 'regiones que se solapan con el dolor físico', W / 2, 415, lt, 0.6, d + 0.3, { size: 40, weight: 600, family: 'Inter' });
  cite(c, 'Kross et al. · PNAS 2011', lt, 0.8, d + 0.3, 1400);
};

// 14 · Amanecer: calma
SC.dawn = (c, lt, d, sc0) => {
  const E = mark(sc0, 'cerebro', 1.4);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#120d26'); g.addColorStop(0.45, '#3a2a55'); g.addColorStop(0.75, '#c8705a'); g.addColorStop(1, '#2a1520');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const k = easeIO(seg(lt, 0, d));
  glow(c, 920, 1250 - 120 * k, 700, '#ffb070', 0.6 + 0.2 * k);
  glow(c, 920, 1250 - 120 * k, 180, '#fff1d0', 0.9);
  // rayos
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const a = -2.6 + i * 0.16 + Math.sin(lt * 0.3 + i) * 0.02;
    c.save(); c.translate(920, 1250 - 120 * k); c.rotate(a);
    const rg = c.createLinearGradient(0, 0, 1500, 0); rg.addColorStop(0, 'rgba(255,190,130,0.16)'); rg.addColorStop(1, 'rgba(255,190,130,0)');
    c.fillStyle = rg; c.beginPath(); c.moveTo(0, 0); c.lineTo(1500, -40 - i * 8); c.lineTo(1500, 40 + i * 8); c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
  drawRain(c, lt + 5, 0.35 * (1 - k));
  dust(c, 9, lt, 50, '#ffd9b0', 0.5);
  const s = 600 + 40 * k;
  rimSilhouette(c, PROFILE, 330, 900, s, '#ffc58a', 16, -6, '#0b0610', 14);
  c.save(); c.filter = 'blur(14px)'; c.fillStyle = 'rgba(10,6,14,0.9)'; c.fillRect(0, 1640, W, 300); c.restore();
  title(c, 'NO ES DEBILIDAD.', W / 2, 330, lt, 0.2, d + 0.3, { size: 80, weight: 800, spacing: 4, glowPx: 24, glowColor: '#ff8a4a' });
  title(c, 'Es un cerebro atrapado en un', W / 2, 425, lt, E, d + 0.3, { size: 48, weight: 600, italic: true });
  title(c, '«quizás»', W / 2, 510, lt, E + 0.4, d + 0.3, { size: 84, weight: 800, color: PAL.gold, glowPx: 30, glowColor: '#ff7a1a' });
};

// 15 · Soltar: «quizás» se disuelve en el cerebro en calma
SC.release = (c, lt, d) => {
  brainBase();
  const u = brain.mat.uniforms;
  u.uBase.value.setRGB(0.15, 0.45, 0.95); u.uAlpha.value = 1;
  orbitCam(brainCam, 0.5 + lt * 0.1, 6.4, 0.9, new THREE.Vector3(0, -0.75, 0));
  render3D(c, brainScene, brainCam);
  // partículas de «quizás»
  const dis = easeIO(seg(lt, 0.6, 2.4));
  const r = rng(91);
  for (const [px, py] of quizasPts) {
    const dx = (r() - 0.5) * 300, up = 200 + r() * 700, dl = r() * 0.4, ph = r() * TAU;
    const k = clamp((dis - dl) / 0.6);
    const x = W / 2 + px * 900 + dx * k + Math.sin(lt * 2 + ph) * 10 * k;
    const y = 640 + py * 900 - up * k;
    const col = k < 0.5 ? PAL.gold : PAL.cyan;
    glow(c, x, y, 6 + 4 * (1 - k), col, (1 - k) * 0.9 + 0.08);
  }
  title(c, 'Entenderlo', W / 2, 1160, lt, 1.6, d + 1, { size: 64, weight: 700 });
  title(c, 'es el primer paso', W / 2, 1245, lt, 1.9, d + 1, { size: 64, weight: 700 });
  title(c, 'PARA SOLTAR.', W / 2, 1345, lt, 2.3, d + 1, { size: 86, weight: 800, spacing: 6, color: PAL.cyan, glowPx: 34, glowColor: '#0a7cff' });
  const fade = seg(lt, d - 0.35, d);
  if (fade > 0) { c.fillStyle = `rgba(0,0,0,${fade})`; c.fillRect(0, 0, W, H); }
};

// ---------------------------------------------------------------- subtítulos dinámicos (para la fase con voz)
let CAPTIONS = [];
function drawCaptions(c, t) {
  // cada entrada: { start, end, words: [{w, s, e}] } — se resalta la palabra activa
  const cap = CAPTIONS.find(k => t >= k.start && t < k.end);
  if (!cap) return;
  const a = inOut(t, cap.start, cap.end, 0.08, 0.08);
  c.save(); c.globalAlpha = a;
  c.font = '800 62px "Inter Display"'; c.letterSpacing = '1px';
  const lines = [[]]; let lw = 0;
  for (const w of cap.words) {
    const ww = c.measureText(w.w + ' ').width;
    if (lw + ww > 900 && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push({ ...w, ww }); lw += ww;
  }
  const y0 = 1210 - (lines.length - 1) * 40;
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
