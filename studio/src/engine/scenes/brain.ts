import * as THREE from 'three';
import { TAU, frac, rng, smooth } from '../math';
import { applyCamera, disposeObject, dustField, glowSprite } from '../three-utils';
import type { Label3D, SceneBuilder } from '../runtime';
import type { VisualStyle } from '../styles';
import { HEART_HZ } from './blood';

type Tone = 'accent' | 'warm' | 'secondary';
export interface BrainRegion {
  name: string;
  pos: [number, number, number];
  /** bilateral: se resalta en ambos hemisferios (x reflejada) */
  bilateral: boolean;
  radius: number;
  tone: Tone;
}

/** Ubicaciones aproximadas, en un cerebro normalizado (x: lateral, y: arriba, z: frontal). */
export const BRAIN_REGIONS: Record<string, BrainRegion> = {
  vta: { name: 'Área tegmental ventral', pos: [0, -0.27, -0.12], bilateral: false, radius: 0.07, tone: 'accent' },
  nacc: { name: 'Núcleo accumbens', pos: [0.13, -0.1, 0.26], bilateral: true, radius: 0.08, tone: 'accent' },
  caudate: { name: 'Núcleo caudado', pos: [0.15, 0.12, 0.18], bilateral: true, radius: 0.1, tone: 'accent' },
  insula: { name: 'Ínsula', pos: [0.56, 0.0, 0.1], bilateral: true, radius: 0.12, tone: 'warm' },
  acc: { name: 'Corteza cingulada anterior', pos: [0.05, 0.3, 0.45], bilateral: false, radius: 0.12, tone: 'warm' },
  pfc: { name: 'Corteza prefrontal', pos: [0.18, 0.25, 0.82], bilateral: true, radius: 0.18, tone: 'secondary' },
  amygdala: { name: 'Amígdala', pos: [0.3, -0.22, 0.18], bilateral: true, radius: 0.07, tone: 'warm' },
  hippocampus: { name: 'Hipocampo', pos: [0.32, -0.2, -0.08], bilateral: true, radius: 0.11, tone: 'secondary' },
  hypothalamus: { name: 'Hipotálamo', pos: [0, -0.2, 0.14], bilateral: false, radius: 0.06, tone: 'warm' },
  motor: { name: 'Corteza motora', pos: [0.3, 0.52, 0.02], bilateral: true, radius: 0.16, tone: 'secondary' },
  visual: { name: 'Corteza visual', pos: [0.12, 0.1, -0.9], bilateral: true, radius: 0.16, tone: 'secondary' },
  cerebellum: { name: 'Cerebelo', pos: [0.2, -0.42, -0.62], bilateral: true, radius: 0.2, tone: 'secondary' },
};

const MAX_HL = 8;
const v3 = (p: [number, number, number]) => new THREE.Vector3(...p);
const toneColor = (s: VisualStyle, t: Tone) => (t === 'accent' ? s.accent : t === 'warm' ? s.warm : s.secondary);

/** Nube de puntos con surcos (giros), cerebelo, tronco y núcleos profundos. */
function brainCloud(style: VisualStyle) {
  const r = rng(7);
  const P: number[] = [], B: number[] = [], S: number[] = [];
  const gyri = (x: number, y: number, z: number) =>
    Math.sin(x * 13 + Math.sin(y * 9) * 2.2) * Math.sin(y * 12 + Math.sin(z * 8) * 2.4) * Math.sin(z * 11 + Math.sin(x * 7) * 2.0);
  const dir = () => {
    const u = r() * 2 - 1, th = r() * TAU, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(th), u, s * Math.sin(th)];
  };
  const shell = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, side: number, minY: number) => {
    for (let i = 0; i < n; i++) {
      const [dx, dy, dz] = dir();
      let x = cx + dx * rx, y = cy + dy * ry * (1 - 0.1 * dz), z = cz + dz * rz;
      if (x * side < 0.03 || y < minY) continue;
      const g = gyri(x, y, z), k = 1 + 0.05 * g;
      x = cx + (x - cx) * k; y = cy + (y - cy) * k; z = cz + (z - cz) * k;
      P.push(x, y, z); B.push(0.35 + 0.65 * Math.pow(g * 0.5 + 0.5, 1.5)); S.push(15 * (0.7 + 0.6 * r()));
    }
  };
  for (const sd of [-1, 1]) {
    shell(0.34 * sd, 0.08, 0.02, 0.38, 0.56, 0.95, 20000, sd, -0.3); // hemisferio
    shell(0.45 * sd, -0.2, 0.14, 0.26, 0.22, 0.52, 4500, sd, -0.42); // lóbulo temporal
  }
  for (let i = 0; i < 6000; i++) { // cerebelo con estrías
    const [dx, dy, dz] = dir();
    const x = dx * 0.44, y = -0.42 + dy * 0.2, z = -0.62 + dz * 0.3;
    if (y > -0.26 && z > -0.5) continue;
    const st = Math.sin(y * 90 + Math.sin(x * 6) * 2), k = 1 + 0.03 * st;
    P.push(x * k, -0.42 + (y + 0.42) * k, -0.62 + (z + 0.62) * k);
    B.push(0.3 + 0.5 * (st * 0.5 + 0.5)); S.push(13);
  }
  for (let i = 0; i < 2500; i++) { // tronco encefálico
    const a = r() * TAU, h = r(), rad = 0.12 - 0.035 * h;
    P.push(Math.cos(a) * rad, -0.24 - h * 0.78, -0.2 - 0.14 * h + Math.sin(a) * rad);
    B.push(0.35 + 0.3 * r()); S.push(13);
  }
  for (let i = 0; i < 5000; i++) { // volumen interior tenue
    const x = (r() * 2 - 1) * 0.65, y = (r() * 2 - 1) * 0.5, z = (r() * 2 - 1) * 0.85;
    const e = ((Math.abs(x) - 0.32) / 0.36) ** 2 + ((y - 0.08) / 0.52) ** 2 + (z / 0.9) ** 2;
    if (e > 1 || y < -0.3) continue;
    P.push(x, y, z); B.push(0.1 + 0.1 * r()); S.push(12);
  }
  // núcleos profundos: más densidad donde están las regiones subcorticales
  const gauss = () => (r() + r() + r() + r() - 2) / 1.15;
  for (const reg of Object.values(BRAIN_REGIONS)) {
    if (reg.radius > 0.1) continue;
    for (const sd of reg.bilateral ? [-1, 1] : [1]) {
      for (let i = 0; i < 500; i++) {
        P.push(reg.pos[0] * sd + gauss() * reg.radius * 0.5, reg.pos[1] + gauss() * reg.radius * 0.45, reg.pos[2] + gauss() * reg.radius * 0.7);
        B.push(0.22); S.push(14);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('aBright', new THREE.Float32BufferAttribute(B, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1));
  const base = new THREE.Color(style.primary).multiplyScalar(0.55 * style.glow);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uBase: { value: base },
      uAlpha: { value: 1 },
      uScale: { value: 1 },
      uScanY: { value: -2 },
      uHL: { value: Array.from({ length: MAX_HL }, () => new THREE.Vector3()) },
      uHLCol: { value: Array.from({ length: MAX_HL }, () => new THREE.Color(0, 0, 0)) },
      uHLRad: { value: new Array(MAX_HL).fill(0.1) },
      uHLAmt: { value: new Array(MAX_HL).fill(0) },
      uHLBi: { value: new Array(MAX_HL).fill(0) },
    },
    vertexShader: /* glsl */ `
      attribute float aBright; attribute float aSize;
      uniform vec3 uBase; uniform float uAlpha, uScale, uScanY;
      uniform vec3 uHL[${MAX_HL}]; uniform vec3 uHLCol[${MAX_HL}];
      uniform float uHLRad[${MAX_HL}]; uniform float uHLAmt[${MAX_HL}]; uniform float uHLBi[${MAX_HL}];
      varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        vec3 col = uBase * aBright;
        float extra = 0.0;
        for(int i=0;i<${MAX_HL};i++){
          vec3 p = position;
          if (uHLBi[i] > 0.5) p.x = abs(p.x);
          float d = distance(p, uHL[i]);
          float k = uHLAmt[i] * exp(-d*d/(uHLRad[i]*uHLRad[i]));
          col += uHLCol[i] * k; extra += k;
        }
        float scan = exp(-pow((position.y - uScanY)/0.025, 2.0));
        col += vec3(0.6,0.9,1.0) * scan * 0.7;
        float near = smoothstep(0.35, 1.3, -mv.z);
        vCol = col * uAlpha * near;
        gl_PointSize = clamp(aSize * uScale * (1.0 + min(extra,1.5)*0.6 + scan*0.6) / (-mv.z), 1.0, 30.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vCol * smoothstep(0.5, 0.05, d), 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, mat };
}

export const buildBrain: SceneBuilder = ({ scene: sc, style }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.05, 100);
  const root = new THREE.Group();
  scene.add(root);
  const { pts, mat } = brainCloud(style);
  root.add(pts);
  scene.add(dustField(3, 900, 10, style.primary, 0.025));

  const keys = (sc.params.highlights ?? []).filter((k) => BRAIN_REGIONS[k]).slice(0, MAX_HL);
  const u = mat.uniforms;
  keys.forEach((k, i) => {
    const reg = BRAIN_REGIONS[k];
    u.uHL.value[i].set(...reg.pos).setX(Math.abs(reg.pos[0]));
    u.uHLCol.value[i].set(toneColor(style, reg.tone)).multiplyScalar(style.glow);
    u.uHLRad.value[i] = reg.radius;
    u.uHLBi.value[i] = reg.bilateral ? 1 : 0;
  });
  const glows = keys.map((k) => {
    const reg = BRAIN_REGIONS[k];
    return (reg.bilateral ? [-1, 1] : [1]).map((sd) => {
      const g = glowSprite(toneColor(style, reg.tone), reg.radius * 3.2, 0);
      g.position.set(reg.pos[0] * sd, reg.pos[1], reg.pos[2]);
      root.add(g);
      return g;
    });
  });

  // vías dopaminérgicas: mesolímbica (ATV → accumbens) y mesocortical (ATV → prefrontal)
  const curves: { cv: THREE.CatmullRomCurve3; limbic: boolean }[] = [];
  const tubes: THREE.Mesh[] = [];
  const pulses: THREE.Sprite[] = [];
  if (sc.params.pathways) {
    const vta = v3(BRAIN_REGIONS.vta.pos);
    for (const s of [-1, 1]) {
      const nacc = v3(BRAIN_REGIONS.nacc.pos).setX(BRAIN_REGIONS.nacc.pos[0] * s);
      curves.push({ cv: new THREE.CatmullRomCurve3([vta, new THREE.Vector3(0.07 * s, -0.24, 0.06), nacc]), limbic: true });
      curves.push({ cv: new THREE.CatmullRomCurve3([vta, new THREE.Vector3(0.1 * s, -0.05, 0.35), new THREE.Vector3(0.22 * s, 0.24, 0.8)]), limbic: false });
    }
    for (const c of curves) {
      const m = new THREE.Mesh(
        new THREE.TubeGeometry(c.cv, 64, 0.008, 6, false),
        new THREE.MeshBasicMaterial({ color: style.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
      );
      root.add(m);
      tubes.push(m);
    }
    for (let i = 0; i < 36; i++) {
      const p = glowSprite(style.accent, 0.07, 0);
      root.add(p);
      pulses.push(p);
    }
  }

  return {
    scene,
    camera,
    update(lt, dur) {
      applyCamera(camera, sc.camera, lt, dur, { target: new THREE.Vector3(0, 0.02, 0), radius: 1.05, azimuth: 1.05, elevation: 0.18 });
      root.rotation.y = 0.05 * Math.sin(lt * 0.4);
      const appear = smooth(0, 1.2, lt);
      u.uAlpha.value = appear;
      u.uScale.value = camera.userData.pointScale ?? 1;
      // barrido de escaneo al aparecer
      u.uScanY.value = lt < 2.2 ? 0.7 - lt * 0.75 : -3;
      keys.forEach((_, i) => {
        const on = smooth(0.6 + i * 0.35, 1.4 + i * 0.35, lt);
        // pulso al ritmo del latido de la banda sonora
        const beat = 0.8 + 0.3 * Math.exp(-frac((lt - 0.3) * HEART_HZ) * 5);
        u.uHLAmt.value[i] = on * beat * 1.4;
        glows[i].forEach((g) => (g.material.opacity = on * beat * 0.55));
      });
      const pathOn = smooth(0.8, 1.8, lt);
      tubes.forEach((m, i) => ((m.material as THREE.MeshBasicMaterial).opacity = pathOn * (curves[i].limbic ? 0.85 : 0.4)));
      pulses.forEach((p, i) => {
        const c = curves[i % curves.length];
        const k = frac(lt * 0.55 + i * 0.137);
        c.cv.getPoint(k, p.position);
        p.material.opacity = pathOn * Math.sin(k * Math.PI) * (c.limbic ? 1 : 0.6);
        p.scale.setScalar(0.04 + 0.04 * Math.sin(k * Math.PI));
      });
    },
    labels() {
      const out: Label3D[] = [];
      for (const k of keys) {
        const reg = BRAIN_REGIONS[k];
        out.push({ pos: v3(reg.pos).applyMatrix4(root.matrixWorld), text: reg.name, color: toneColor(style, reg.tone) });
      }
      return out;
    },
    dispose() {
      disposeObject(scene);
    },
  };
};
