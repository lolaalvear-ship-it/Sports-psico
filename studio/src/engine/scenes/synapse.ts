import * as THREE from 'three';
import { easeInOut, rng, smooth } from '../math';
import { applyCamera, disposeObject, dustField, fresnelMaterial, glowSprite } from '../three-utils';
import type { SceneBuilder } from '../runtime';

export interface Transmitter { name: string; color: string; note: string }
export const TRANSMITTERS: Record<string, Transmitter> = {
  dopamina: { name: 'Dopamina', color: '#ffb347', note: 'motivación y recompensa' },
  oxitocina: { name: 'Oxitocina', color: '#ff6fb5', note: 'vínculo social' },
  vasopresina: { name: 'Vasopresina', color: '#b98cff', note: 'vínculo de pareja (sobre todo en animales)' },
  serotonina: { name: 'Serotonina', color: '#7d8cff', note: 'estado de ánimo' },
  noradrenalina: { name: 'Noradrenalina', color: '#ff7a4d', note: 'alerta y activación' },
  glutamato: { name: 'Glutamato', color: '#7dffb0', note: 'principal excitador' },
  gaba: { name: 'GABA', color: '#6fd3ff', note: 'principal inhibidor' },
  acetilcolina: { name: 'Acetilcolina', color: '#f6ff7d', note: 'músculo y atención' },
};

/** Cada 1,6 s llega un potencial de acción y se liberan vesículas. Lo usa también el audio. */
export const SYNAPSE_BURST = { first: 0.8, period: 1.6 };

const V = 16, PER_VESICLE = 10, GROUPS = 4;

export const buildSynapse: SceneBuilder = ({ scene: sc, style }) => {
  const r = rng(33);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 9 / 16, 0.05, 100);
  const tx = (sc.params.transmitters ?? ['dopamina']).filter((k) => TRANSMITTERS[k]);
  if (!tx.length) tx.push('dopamina');

  // terminal presináptico (torno alrededor del eje Y)
  const profile = [[0.0, 0.15], [0.3, 0.17], [0.48, 0.28], [0.56, 0.55], [0.48, 0.85], [0.25, 1.05], [0.13, 1.3], [0.12, 2.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const pre = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), fresnelMaterial(new THREE.Color(style.primary).multiplyScalar(0.12), style.primary, { side: THREE.DoubleSide, alpha: 0.9, base: 0.12, glow: 1.6 * style.glow }));
  scene.add(pre);
  // membrana postsináptica
  const post = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), fresnelMaterial(new THREE.Color(style.secondary).multiplyScalar(0.1), style.secondary, { alpha: 0.85, base: 0.15, glow: 1.2 * style.glow }));
  post.scale.set(1.6, 0.5, 1.2);
  post.position.y = -0.55;
  scene.add(post);

  // receptores sobre la membrana postsináptica
  const receptors: THREE.Vector3[] = [];
  while (receptors.length < 22) {
    const x = (r() - 0.5) * 0.9, z = (r() - 0.5) * 0.9;
    if (x * x + z * z > 0.2) continue;
    const y = -0.55 + 0.5 * Math.sqrt(Math.max(0, 1 - (x / 1.6) ** 2 - (z / 1.2) ** 2));
    receptors.push(new THREE.Vector3(x, y + 0.02, z));
  }
  const recMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const recMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.03, 0.05, 10), recMat, receptors.length);
  const m4 = new THREE.Matrix4();
  receptors.forEach((p, i) => recMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  scene.add(recMesh);

  // vesículas
  const vesicles = Array.from({ length: V }, (_, i) => {
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 0.3;
    const home = new THREE.Vector3(Math.cos(a) * rad, 0.38 + r() * 0.42, Math.sin(a) * rad);
    const da = r() * Math.PI * 2, dr = Math.sqrt(r()) * 0.22;
    const dock = new THREE.Vector3(Math.cos(da) * dr, 0.23, Math.sin(da) * dr);
    const t = TRANSMITTERS[tx[i % tx.length]];
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), fresnelMaterial(new THREE.Color(t.color).multiplyScalar(0.25), t.color, { additive: true, alpha: 0.9, base: 0.3 }));
    scene.add(mesh);
    const targets = Array.from({ length: PER_VESICLE }, () => Math.floor(r() * receptors.length));
    const jit = Array.from({ length: PER_VESICLE }, () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5));
    return { home, dock, mesh, group: i % GROUPS, color: new THREE.Color(t.color), targets, jit, seed: r() * 10 };
  });
  const partMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.014, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), V * PER_VESICLE);
  partMesh.frustumCulled = false;
  scene.add(partMesh);
  const impulse = glowSprite(style.accent, 0.35, 0);
  scene.add(impulse);
  const calcium = glowSprite(style.secondary, 1.1, 0);
  calcium.position.set(0, 0.3, 0);
  scene.add(calcium);
  scene.add(dustField(5, 600, 7, style.primary, 0.02));

  const { first, period } = SYNAPSE_BURST;
  const cycle = period * GROUPS;
  const tmpC = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const recBase = new THREE.Color(style.secondary).multiplyScalar(0.5);
  const target = new THREE.Vector3(0, 0.15, 0);

  return {
    scene,
    camera,
    update(lt, dur) {
      applyCamera(camera, sc.camera, lt, dur, { target, radius: 1.0, azimuth: 0.5, elevation: 0.12 });
      const on = smooth(0, 1, lt);
      // impulso eléctrico bajando por el axón antes de cada liberación
      const k = Math.max(0, Math.floor((lt - first + period) / period));
      const tk = first + k * period; // próxima liberación
      const ap = 1 - (tk - lt) / 0.6; // 0→1 durante los 0,6 s previos
      if (ap >= 0 && ap <= 1) {
        impulse.position.set(0, 2.0 - ap * 1.6, 0);
        impulse.material.opacity = on * Math.sin(ap * Math.PI) * 1.2;
      } else impulse.material.opacity = 0;
      const sinceBurst = lt - (tk - period);
      calcium.material.opacity = on * (lt > first ? Math.exp(-Math.max(0, sinceBurst) * 4) * 0.6 : 0);

      const bound = new Array(receptors.length).fill(0);
      vesicles.forEach((v, i) => {
        // última liberación de esta vesícula (pertenece a un grupo que se turna)
        const off = first + v.group * period;
        const n = Math.floor((lt - off) / cycle);
        const tr = off + n * cycle; // si n < 0 aún no se ha liberado
        const tNext = tr + cycle;
        const s = lt - tr; // tiempo desde la última liberación
        let pos = v.home.clone(), scale = 1;
        const wob = new THREE.Vector3(Math.sin(lt * 1.3 + v.seed), Math.sin(lt * 1.1 + v.seed * 2), Math.cos(lt * 1.2 + v.seed)).multiplyScalar(0.02);
        if (lt > tNext - 0.8) pos.lerp(v.dock, easeInOut((lt - (tNext - 0.8)) / 0.8)); // se acerca a la membrana
        else if (n >= 0 && s < 0.15) { pos = v.dock.clone(); scale = 1 - s / 0.15; } // fusión
        else if (n >= 0 && s < 1.5) scale = 0;
        else if (n >= 0 && s < 2.5) scale = (s - 1.5) / 1.0; // reciclaje
        v.mesh.position.copy(pos.add(wob));
        v.mesh.scale.setScalar(Math.max(scale, 0.0001));
        (v.mesh.material as THREE.ShaderMaterial).uniforms.uAlpha.value = on * 0.9;

        for (let j = 0; j < PER_VESICLE; j++) {
          const idx = i * PER_VESICLE + j;
          if (n < 0 || s > 1.6) { partMesh.setMatrixAt(idx, zero); continue; }
          const rec = receptors[v.targets[j]];
          const travel = easeInOut(Math.min(1, s / 0.8));
          const p = v.dock.clone().lerp(rec, travel);
          const spread = Math.sin(Math.min(1, s / 0.8) * Math.PI) * 0.12;
          p.addScaledVector(v.jit[j], spread);
          p.y += 0.04 * (1 - travel);
          const fade = s > 1.3 ? 1 - (s - 1.3) / 0.3 : 1;
          if (s > 0.75 && s < 1.4) bound[v.targets[j]] += 1;
          partMesh.setMatrixAt(idx, m4.makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeScale(fade, fade, fade)));
          partMesh.setColorAt(idx, tmpC.copy(v.color).multiplyScalar(1.4 * on));
        }
      });
      partMesh.instanceMatrix.needsUpdate = true;
      if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
      receptors.forEach((_, i) => {
        const b = Math.min(1, bound[i] * 0.5);
        recMesh.setColorAt(i, tmpC.copy(recBase).lerp(new THREE.Color(style.accent), b).multiplyScalar(on * (0.7 + b)));
      });
      if (recMesh.instanceColor) recMesh.instanceColor.needsUpdate = true;
      (pre.material as THREE.ShaderMaterial).uniforms.uAlpha.value = on * 0.9;
      (post.material as THREE.ShaderMaterial).uniforms.uAlpha.value = on * 0.85;
    },
    labels() {
      return [
        { pos: new THREE.Vector3(0.5, 0.75, 0), text: 'Neurona presináptica' },
        { pos: vesicles[0].home.clone(), text: 'Vesículas' },
        { pos: new THREE.Vector3(-0.45, 0.06, 0), text: 'Hendidura sináptica' },
        { pos: receptors[0].clone(), text: 'Receptores', color: style.accent },
      ];
    },
    legend() {
      return tx.map((k) => ({ color: TRANSMITTERS[k].color, text: `${TRANSMITTERS[k].name}: ${TRANSMITTERS[k].note}` }));
    },
    dispose() {
      disposeObject(scene);
    },
  };
};
