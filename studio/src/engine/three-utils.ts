import * as THREE from 'three';
import { clamp, easeInOut, lerp } from './math';
import type { CameraMove } from './types';

let glowTex: THREE.Texture | null = null;
/** Textura radial suave para destellos (compartida). */
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color: THREE.ColorRepresentation, size: number, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

export interface FresnelOpts {
  pow?: number; alpha?: number; glow?: number; base?: number;
  additive?: boolean; side?: THREE.Side; depthWrite?: boolean;
}
/** Material translúcido con borde luminoso (efecto «rayos X» / membrana). */
export function fresnelMaterial(col: THREE.ColorRepresentation, rim: THREE.ColorRepresentation, o: FresnelOpts = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: o.depthWrite ?? false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: o.side ?? THREE.FrontSide,
    uniforms: {
      uCol: { value: new THREE.Color(col) },
      uRim: { value: new THREE.Color(rim) },
      uPow: { value: o.pow ?? 2.2 },
      uAlpha: { value: o.alpha ?? 1 },
      uGlow: { value: o.glow ?? 1.4 },
      uBase: { value: o.base ?? 0.25 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol, uRim; uniform float uPow, uAlpha, uGlow, uBase;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        vec3 c = uCol + uRim * f * uGlow;
        gl_FragColor = vec4(c, (uBase + (1.0 - uBase) * f) * uAlpha);
      }`,
  });
}

/** Distancia para que una esfera de radio r quepa en pantalla con cualquier proporción. */
export function fitDistance(radius: number, fovDeg: number, aspect: number) {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  return radius / Math.min(t, t * aspect);
}

export interface Framing {
  target: THREE.Vector3;
  /** radio del sujeto (para encuadrar) */
  radius: number;
  azimuth: number;
  elevation: number;
}

/** Movimientos de cámara cinematográficos, todos función del tiempo local. */
export function applyCamera(cam: THREE.PerspectiveCamera, move: CameraMove, lt: number, dur: number, f: Framing) {
  const u = easeInOut(clamp(lt / Math.max(dur, 0.01)));
  const base = fitDistance(f.radius, cam.fov, cam.aspect);
  let dist = base, az = f.azimuth, el = f.elevation;
  const target = f.target.clone();
  switch (move) {
    case 'orbit': az += lerp(-0.45, 0.45, u); break;
    case 'dolly-in': dist *= lerp(1.2, 0.78, u); az += 0.18 * u; break;
    case 'pull-back': dist *= lerp(0.72, 1.12, u); az -= 0.15 * u; break;
    case 'pan': az += 0.1 * u; target.x += lerp(-0.18, 0.18, u) * f.radius; break;
    case 'static': az += 0.04 * Math.sin(lt * 0.5); break;
  }
  el += 0.025 * Math.sin(lt * 0.7);
  cam.position.set(
    target.x + Math.sin(az) * Math.cos(el) * dist,
    target.y + Math.sin(el) * dist,
    target.z + Math.cos(az) * Math.cos(el) * dist,
  );
  cam.lookAt(target);
  cam.updateMatrixWorld();
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose?.();
  });
}

/** Nube de polvo de fondo, común a varias escenas. */
export function dustField(seed: number, n: number, spread: number, color: THREE.ColorRepresentation, size = 0.02) {
  let a = seed;
  const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const P: number[] = [];
  for (let i = 0; i < n; i++) P.push((r() - 0.5) * spread, (r() - 0.5) * spread * 1.4, (r() - 0.5) * spread - spread * 0.2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    color, size, map: glowTexture(), transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pts.frustumCulled = false;
  return pts;
}
