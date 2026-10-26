// Kit 3D (Three.js): cerebro de puntos con regiones resaltables, vías dopaminérgicas, red de neuronas y sinapsis.
// Se importa solo en los reels que lo usan:  import * as K3 from '/engine/kit3d.js';
// Uso típico en una escena:
//   K3.brainBase(); K3.setHL(0, K3.REG.amyR, 0xff3a4a, 0.2, 3);
//   K3.orbitCam(K3.brainCam, 0.4 + lt * 0.1, 4.6, 0.6, K3.ORIGIN); K3.render3D(c, K3.brainScene, K3.brainCam);
import * as THREE from '/three/three.module.js';
import { W, H, TAU, rng, clamp, lerp, seg, easeIO, easeOut, offscreen } from './core.js';

export { THREE };
export const ORIGIN = new THREE.Vector3(0, 0, 0);

export const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 1);
export const glCanvas = renderer.domElement;

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
export function glowSprite3(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}
export function fresnelMat(col, rim, o = {}) {
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
export const REG = {
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
  // regiones útiles para psicología del deporte
  m1L: new THREE.Vector3(-0.3, 0.55, -0.05),    // corteza motora primaria
  m1R: new THREE.Vector3(0.3, 0.55, -0.05),
  sma: new THREE.Vector3(0, 0.6, 0.12),          // área motora suplementaria
  dlpfcL: new THREE.Vector3(-0.42, 0.36, 0.6),   // prefrontal dorsolateral (control, atención)
  dlpfcR: new THREE.Vector3(0.42, 0.36, 0.6),
  acc: new THREE.Vector3(0, 0.22, 0.42),         // cingulada anterior (error, conflicto)
  ofc: new THREE.Vector3(0, -0.12, 0.74),        // orbitofrontal (valor, recompensa)
  cereb: new THREE.Vector3(0, -0.42, -0.62),     // cerebelo (coordinación, automatismos)
};
export const brain = (() => {
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
export function setHL(i, pos, color, rad, amt) {
  const u = brain.mat.uniforms;
  u.uHL.value[i].copy(pos); u.uHLCol.value[i].set(color); u.uHLRad.value[i] = rad; u.uHLAmt.value[i] = amt;
}
export function clearHL() { brain.mat.uniforms.uHLAmt.value.fill(0); }

export const brainScene = new THREE.Scene();
export const brainRoot = new THREE.Group();
brainScene.add(brainRoot);
brainRoot.add(brain.pts);
// polvo de fondo
export const bgDust = (() => {
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
export const pathways = (() => {
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
export function setPathways(lt, amount, pulseAmt) {
  pathways.meshes.forEach((m, i) => { m.material.opacity = amount * (pathways.curves[i].kind === 'limbic' ? 0.9 : 0.45); });
  pathways.pulses.forEach((p, i) => {
    const c = pathways.curves[i % pathways.curves.length];
    const u = (((lt * 0.6 + i * 0.137) % 1) + 1) % 1;
    c.cv.getPoint(u, p.position);
    p.material.opacity = pulseAmt * Math.sin(u * Math.PI) * (c.kind === 'limbic' ? 1 : 0.6);
    p.scale.setScalar(0.05 + 0.04 * Math.sin(u * Math.PI));
  });
}
export const brainCam = new THREE.PerspectiveCamera(35, W / H, 0.05, 100);

export function project(v, cam, obj) {
  const p = v.clone();
  if (obj) p.applyMatrix4(obj.matrixWorld);
  p.project(cam);
  return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H];
}
export function render3D(c, scene, cam, dy = 0) {
  renderer.render(scene, cam);
  c.drawImage(glCanvas, 0, dy);
}
export function brainBase() {
  clearHL();
  const u = brain.mat.uniforms;
  u.uBase.value.setRGB(0.17, 0.48, 1.0); u.uAlpha.value = 1; u.uScanOn.value = 0; u.uScale.value = 1.25;
  setPathways(0, 0, 0);
  pathways.vtaGlow.material.opacity = 0;
  pathways.nacGlows.forEach(g => (g.material.opacity = 0));
  bgDust.visible = true;
}
export function orbitCam(cam, angle, dist, height, target) {
  cam.position.set(target.x + Math.sin(angle) * dist, target.y + height, target.z + Math.cos(angle) * dist);
  cam.lookAt(target);
  cam.updateMatrixWorld();
}

// ---------------------------------------------------------------- neuronas
export const neuro = (() => {
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
export const syn = (() => {
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


// brillo fijo sobre una región (devuelve el sprite; ajusta su .material.opacity en cada fotograma)
export function regionGlow(pos, color, size = 0.3) {
  const g = glowSprite3(color, size, 0);
  g.material.depthTest = false; g.position.copy(pos); brainRoot.add(g);
  return g;
}
// resalta una región con un color en formato (r, g, b) 0..1
export function setHLrgb(i, pos, r, g, b, rad, amt) {
  const u = brain.mat.uniforms;
  u.uHL.value[i].copy(pos); u.uHLCol.value[i].setRGB(r, g, b); u.uHLRad.value[i] = rad; u.uHLAmt.value[i] = amt;
}
