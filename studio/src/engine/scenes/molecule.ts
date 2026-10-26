import * as THREE from 'three';
import { smooth } from '../math';
import { applyCamera, disposeObject, dustField } from '../three-utils';
import type { SceneBuilder } from '../runtime';

type El = 'C' | 'N' | 'O';
interface Mol { name: string; formula: string; note: string; atoms: { el: El; p: [number, number, number] }[]; bonds: [number, number, number][] }

const deg = (a: number) => (a * Math.PI) / 180;

/** Constructor mínimo de moléculas planas (coordenadas 2D en Å, ángulos de enlace de 120°). */
class MolBuilder {
  atoms: { el: El; p: [number, number, number] }[] = [];
  bonds: [number, number, number][] = [];
  add(el: El, x: number, y: number, z = 0) { this.atoms.push({ el, p: [x, y, z] }); return this.atoms.length - 1; }
  bond(a: number, b: number, order = 1) { this.bonds.push([a, b, order]); }
  /** Átomo nuevo a distancia d de `from`, en la dirección `angle` (grados). */
  from(from: number, el: El, angle: number, d = 1.45, order = 1, z = 0) {
    const [x, y] = this.atoms[from].p;
    const i = this.add(el, x + Math.cos(deg(angle)) * d, y + Math.sin(deg(angle)) * d, z);
    this.bond(from, i, order);
    return i;
  }
  /** Anillo regular: devuelve los índices de los vértices. */
  ring(cx: number, cy: number, n: number, rad: number, start: number, orders: number[]) {
    const idx = Array.from({ length: n }, (_, k) => this.add('C', cx + Math.cos(deg(start + (360 / n) * k)) * rad, cy + Math.sin(deg(start + (360 / n) * k)) * rad));
    idx.forEach((a, k) => this.bond(a, idx[(k + 1) % n], orders[k]));
    return idx;
  }
}

function catecholamine(name: string, beta: boolean): Mol {
  const m = new MolBuilder();
  const c = m.ring(0, 0, 6, 1.39, 0, [2, 1, 2, 1, 2, 1]); // C1 a 0°, C3 a 120°, C4 a 180°
  m.from(c[2], 'O', 120, 1.36); // OH en C3
  m.from(c[3], 'O', 180, 1.36); // OH en C4
  const ca = m.from(c[0], 'C', 0, 1.51);
  if (beta) m.from(ca, 'O', -60, 1.43); // OH en el carbono β (noradrenalina)
  const cb = m.from(ca, 'C', 60, 1.53);
  m.from(cb, 'N', 0, 1.47);
  return { name, formula: beta ? 'C₈H₁₁NO₃' : 'C₈H₁₁NO₂', note: 'Catecolamina', atoms: m.atoms, bonds: m.bonds };
}

function serotonin(): Mol {
  const m = new MolBuilder();
  // benceno con vértices a 30°+60k; el lado derecho (30° y 330°) se comparte con el pirrol
  const b = m.ring(0, 0, 6, 1.4, 30, [1, 2, 1, 2, 1, 2]); // b0=C3a, b1=C4, b2=C5, b3=C6, b4=C7, b5=C7a
  const [x0, y0] = m.atoms[b[0]].p, [x5, y5] = m.atoms[b[5]].p;
  const side = Math.hypot(x0 - x5, y0 - y5);
  const cx = x0 + side / (2 * Math.tan(deg(36))), cy = 0; // centro del pentágono
  const R5 = side / (2 * Math.sin(deg(36)));
  const a0 = Math.atan2(y0 - cy, x0 - cx) * (180 / Math.PI);
  const p = (k: number) => [cx + Math.cos(deg(a0 - 72 * k)) * R5, cy + Math.sin(deg(a0 - 72 * k)) * R5];
  const c3 = m.add('C', ...(p(1) as [number, number]));
  const c2 = m.add('C', ...(p(2) as [number, number]));
  const n1 = m.add('N', ...(p(3) as [number, number]));
  m.bond(b[0], c3); m.bond(c3, c2, 2); m.bond(c2, n1); m.bond(n1, b[5]);
  m.from(b[2], 'O', 150, 1.37); // 5-hidroxi
  const ang = Math.atan2(m.atoms[c3].p[1] - cy, m.atoms[c3].p[0] - cx) * (180 / Math.PI);
  const ca = m.from(c3, 'C', ang, 1.5);
  const cb = m.from(ca, 'C', ang - 60, 1.53);
  m.from(cb, 'N', ang, 1.47);
  return { name: 'Serotonina', formula: 'C₁₀H₁₂N₂O', note: 'Indolamina (5-HT)', atoms: m.atoms, bonds: m.bonds };
}

function acetylcholine(): Mol {
  const m = new MolBuilder();
  const c1 = m.add('C', -3.6, 0);
  const c2 = m.from(c1, 'C', 30, 1.5);
  m.from(c2, 'O', 90, 1.22, 2);
  const o = m.from(c2, 'O', -30, 1.34);
  const c4 = m.from(o, 'C', 30, 1.44);
  const c5 = m.from(c4, 'C', -30, 1.52);
  const n = m.from(c5, 'N', 30, 1.5);
  m.from(n, 'C', -30, 1.49);
  m.from(n, 'C', 90, 1.49);
  m.from(n, 'C', 30, 0.9, 1, 1.2);
  return { name: 'Acetilcolina', formula: 'C₇H₁₆NO₂⁺', note: 'Éster de colina', atoms: m.atoms, bonds: m.bonds };
}

export const MOLECULES: Record<string, () => Mol> = {
  dopamina: () => catecholamine('Dopamina', false),
  noradrenalina: () => catecholamine('Noradrenalina', true),
  serotonina: serotonin,
  acetilcolina: acetylcholine,
};
export const MOLECULE_NAMES: Record<string, string> = { dopamina: 'Dopamina', noradrenalina: 'Noradrenalina', serotonina: 'Serotonina', acetilcolina: 'Acetilcolina' };

const CPK: Record<El, { color: string; r: number; name: string }> = {
  C: { color: '#8a94a6', r: 0.34, name: 'Carbono' },
  N: { color: '#4d7dff', r: 0.33, name: 'Nitrógeno' },
  O: { color: '#ff4d4d', r: 0.32, name: 'Oxígeno' },
};

export const buildMolecule: SceneBuilder = ({ scene: sc, style }) => {
  const mol = (MOLECULES[sc.params.molecule ?? 'dopamina'] ?? MOLECULES.dopamina)();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.05, 100);
  const g = new THREE.Group();
  scene.add(g);
  // centrar
  const c = new THREE.Vector3();
  mol.atoms.forEach((a) => c.add(new THREE.Vector3(...a.p)));
  c.divideScalar(mol.atoms.length);
  const P = mol.atoms.map((a) => new THREE.Vector3(...a.p).sub(c).multiplyScalar(0.25));
  const radius = Math.max(...P.map((p) => p.length())) + 0.15;

  const mats: THREE.MeshStandardMaterial[] = [];
  P.forEach((p, i) => {
    const e = CPK[mol.atoms[i].el];
    const m = new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.3, metalness: 0.1, emissive: e.color, emissiveIntensity: 0.15, transparent: true });
    mats.push(m);
    const s = new THREE.Mesh(new THREE.SphereGeometry(e.r * 0.25, 32, 20), m);
    s.position.copy(p);
    g.add(s);
  });
  const bondMat = new THREE.MeshStandardMaterial({ color: '#d5dbe6', roughness: 0.4, transparent: true });
  mats.push(bondMat);
  const cyl = new THREE.CylinderGeometry(0.018, 0.018, 1, 12);
  const up = new THREE.Vector3(0, 1, 0);
  for (const [a, b, order] of mol.bonds) {
    const d = P[b].clone().sub(P[a]);
    const perp = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(0.035);
    const offs = order === 2 ? [perp, perp.clone().negate()] : [new THREE.Vector3()];
    for (const o of offs) {
      const m = new THREE.Mesh(cyl, bondMat);
      m.position.copy(P[a]).add(P[b]).multiplyScalar(0.5).add(o);
      m.scale.set(1, d.length(), 1);
      m.quaternion.setFromUnitVectors(up, d.clone().normalize());
      g.add(m);
    }
  }
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#10131c', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(style.secondary, 2.5);
  rim.position.set(-3, 1, -3);
  scene.add(rim);
  scene.add(dustField(9, 500, 6, style.primary, 0.02));

  const firstOf = (el: El) => P[mol.atoms.findIndex((a) => a.el === el)];
  return {
    scene,
    camera,
    update(lt, dur) {
      applyCamera(camera, sc.camera, lt, dur, { target: new THREE.Vector3(), radius, azimuth: 0, elevation: 0.1 });
      g.rotation.y = lt * 0.45;
      g.rotation.x = 0.25 * Math.sin(lt * 0.3);
      const on = smooth(0, 1, lt);
      mats.forEach((m) => (m.opacity = on));
      g.updateMatrixWorld();
    },
    labels() {
      const out = [{ pos: new THREE.Vector3(0, radius * 0.8, 0), text: `${mol.name} · ${mol.formula}` }];
      const o = firstOf('O'), n = firstOf('N');
      if (o) out.push({ pos: o.clone().applyMatrix4(g.matrixWorld), text: 'O · oxígeno' });
      if (n) out.push({ pos: n.clone().applyMatrix4(g.matrixWorld), text: 'N · nitrógeno' });
      return out;
    },
    legend() {
      return [
        { color: CPK.C.color, text: 'Carbono' },
        { color: CPK.N.color, text: 'Nitrógeno' },
        { color: CPK.O.color, text: 'Oxígeno' },
        { color: '#666c78', text: 'Hidrógenos omitidos' },
      ];
    },
    dispose() {
      disposeObject(scene);
    },
  };
};
