import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, frac, rng, smooth } from '../math';
import { applyCamera, disposeObject, dustField, glowSprite } from '../three-utils';
import type { SceneBuilder } from '../runtime';

interface Edge { a: number; b: number; cv: THREE.CatmullRomCurve3; rate: number; phase: number }

/**
 * Red de neuronas: somas, dendritas ramificadas y axones curvos.
 * Los impulsos recorren cada axón a un ritmo fijo; al llegar, la neurona destino destella.
 */
export const buildNetwork: SceneBuilder = ({ scene: sc, style }) => {
  const r = rng(21);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 100);
  const N = 26;
  const somas: THREE.Vector3[] = [];
  while (somas.length < N) {
    const p = new THREE.Vector3((r() - 0.5) * 2.4, (r() - 0.5) * 3.2, (r() - 0.5) * 1.6);
    if (somas.every((q) => q.distanceTo(p) > 0.42)) somas.push(p);
  }

  // dendritas: paseos aleatorios con ramificación
  const dendGeos: THREE.BufferGeometry[] = [];
  for (const s of somas) {
    const branches = 5 + Math.floor(r() * 3);
    for (let b = 0; b < branches; b++) {
      const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const pts = [s.clone()];
      let p = s.clone();
      const len = 4 + Math.floor(r() * 3);
      for (let k = 0; k < len; k++) {
        dir.add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.7)).normalize();
        p = p.clone().addScaledVector(dir, 0.05 + r() * 0.04);
        pts.push(p);
      }
      dendGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0055 * (0.8 + r() * 0.4), 4, false));
      if (r() < 0.6) { // rama secundaria
        const q = pts[Math.floor(pts.length / 2)];
        const d2 = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
        dendGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([q, q.clone().addScaledVector(d2, 0.08), q.clone().addScaledVector(d2, 0.16)]), 6, 0.004, 4, false));
      }
    }
  }
  const dendMat = new THREE.MeshBasicMaterial({ color: style.primary, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Mesh(mergeGeometries(dendGeos), dendMat));
  dendGeos.forEach((g) => g.dispose());

  // axones: cada neurona conecta con 2 vecinas cercanas
  const edges: Edge[] = [];
  somas.forEach((s, a) => {
    const near = somas.map((q, b) => ({ b, d: q.distanceTo(s) })).filter((x) => x.b !== a).sort((x, y) => x.d - y.d).slice(0, 2);
    for (const { b } of near) {
      if (edges.some((e) => e.a === b && e.b === a)) continue;
      const mid = s.clone().lerp(somas[b], 0.5).add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.35));
      edges.push({ a, b, cv: new THREE.CatmullRomCurve3([s, mid, somas[b]]), rate: 0.45 + r() * 0.5, phase: r() });
    }
  });
  const axonMat = new THREE.MeshBasicMaterial({ color: style.secondary, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  const axGeo = mergeGeometries(edges.map((e) => new THREE.TubeGeometry(e.cv, 40, 0.006, 5, false)));
  scene.add(new THREE.Mesh(axGeo, axonMat));

  // somas
  const somaMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const somaMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 2), somaMat, N);
  const m4 = new THREE.Matrix4();
  somas.forEach((s, i) => somaMesh.setMatrixAt(i, m4.makeTranslation(s.x, s.y, s.z)));
  scene.add(somaMesh);
  const somaGlows = somas.map((s) => {
    const g = glowSprite(style.secondary, 0.3, 0.4);
    g.position.copy(s);
    scene.add(g);
    return g;
  });
  const pulseSprites = edges.map(() => {
    const g = glowSprite(style.accent, 0.09, 0);
    scene.add(g);
    return g;
  });
  scene.add(dustField(11, 700, 8, style.primary, 0.02));

  const baseCol = new THREE.Color(style.primary);
  const flashCol = new THREE.Color(style.accent);
  const tmp = new THREE.Color();
  const center = new THREE.Vector3();

  return {
    scene,
    camera,
    update(lt, dur) {
      applyCamera(camera, sc.camera, lt, dur, { target: center, radius: 1.25, azimuth: 0.3, elevation: 0.08 });
      const on = smooth(0, 1, lt);
      dendMat.opacity = 0.55 * on * style.glow;
      axonMat.opacity = 0.28 * on * style.glow;
      const flash = new Array(N).fill(0);
      edges.forEach((e, i) => {
        // k: posición del impulso a lo largo del axón (0 → 1)
        const k = frac(lt * e.rate + e.phase);
        e.cv.getPoint(k, pulseSprites[i].position);
        pulseSprites[i].material.opacity = on * Math.sin(k * Math.PI) ** 0.5;
        // tiempo transcurrido desde la última llegada al soma destino
        const since = k / e.rate;
        flash[e.b] += Math.exp(-since * 5);
      });
      somas.forEach((_, i) => {
        const f = Math.min(1, flash[i]);
        tmp.copy(baseCol).lerp(flashCol, f).multiplyScalar(on * (0.8 + f));
        somaMesh.setColorAt(i, tmp);
        somaGlows[i].material.opacity = on * (0.25 + 0.75 * f) * style.glow;
        somaGlows[i].scale.setScalar(0.22 + 0.25 * f + 0.02 * Math.sin(lt * TAU * 0.3 + i));
      });
      if (somaMesh.instanceColor) somaMesh.instanceColor.needsUpdate = true;
    },
    labels() {
      // la neurona más cercana al centro de la imagen
      const i = somas.reduce((best, s, j) => (s.length() < somas[best].length() ? j : best), 0);
      const e = edges.find((x) => x.a === i || x.b === i) ?? edges[0];
      return [
        { pos: somas[i].clone(), text: 'Neurona (soma)' },
        { pos: e.cv.getPoint(0.5), text: 'Impulso eléctrico (potencial de acción)', color: style.accent },
      ];
    },
    dispose() {
      disposeObject(scene);
    },
  };
};
