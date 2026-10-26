import * as THREE from 'three';
import { TAU, rng, smooth } from '../math';
import { applyCamera, disposeObject, dustField, fresnelMaterial, glowTexture } from '../three-utils';
import type { SceneBuilder } from '../runtime';

/** Célula eucariota esquemática: membrana ondulante, núcleo, nucléolo, mitocondrias y vesículas. */
export const buildCell: SceneBuilder = ({ scene: sc, style }) => {
  const r = rng(77);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.05, 100);
  const root = new THREE.Group();
  scene.add(root);

  const memMat = fresnelMaterial(new THREE.Color(style.primary).multiplyScalar(0.08), style.secondary, { alpha: 1, base: 0.06, glow: 1.5 * style.glow, pow: 2.6, additive: true });
  memMat.vertexShader = memMat.vertexShader
    .replace('void main(){', 'uniform float uT;\nvoid main(){')
    .replace(
      'vec4 mv = modelViewMatrix * vec4(position,1.0);',
      `vec3 p = position;
        float w = sin(p.x*4.0+uT*1.1)*sin(p.y*3.5+uT*0.9)*sin(p.z*4.5+uT*0.7);
        p += normal * w * 0.05;
        vec4 mv = modelViewMatrix * vec4(p,1.0);`,
    );
  memMat.uniforms.uT = { value: 0 };
  const membrane = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 32), memMat);
  membrane.scale.set(1.15, 0.95, 1);
  root.add(membrane);

  const nucleusPos = new THREE.Vector3(0.12, 0.05, 0);
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.36, 48, 32), fresnelMaterial(new THREE.Color(style.primary).multiplyScalar(0.25), style.primary, { additive: true, base: 0.2, glow: 1.6 * style.glow }));
  nucleus.position.copy(nucleusPos);
  root.add(nucleus);
  const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), fresnelMaterial(new THREE.Color(style.accent).multiplyScalar(0.4), style.accent, { additive: true, base: 0.4 }));
  nucleolus.position.copy(nucleusPos).add(new THREE.Vector3(0.08, 0.05, 0.1));
  root.add(nucleolus);
  // cromatina como puntos dentro del núcleo
  const chrom: number[] = [];
  for (let i = 0; i < 1500; i++) {
    const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5);
    if (v.length() > 0.5) continue;
    v.multiplyScalar(0.62).add(nucleusPos);
    chrom.push(v.x, v.y, v.z);
  }
  const chromGeo = new THREE.BufferGeometry();
  chromGeo.setAttribute('position', new THREE.Float32BufferAttribute(chrom, 3));
  root.add(new THREE.Points(chromGeo, new THREE.PointsMaterial({ color: style.secondary, size: 0.015, map: glowTexture(), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })));

  // mitocondrias
  const mitoMat = fresnelMaterial(new THREE.Color(style.warm).multiplyScalar(0.3), style.accent, { additive: true, base: 0.25, glow: 1.3 });
  const mitos = Array.from({ length: 9 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 8, 16), mitoMat);
    const a = (i / 9) * TAU + r() * 0.4, rad = 0.55 + r() * 0.2;
    m.position.set(Math.cos(a) * rad * 1.05, (r() - 0.5) * 0.9, Math.sin(a) * rad * 0.8);
    m.rotation.set(r() * TAU, r() * TAU, r() * TAU);
    root.add(m);
    return { m, base: m.position.clone(), ph: r() * TAU };
  });

  // vesículas y ribosomas en el citoplasma
  const cyto: number[] = [];
  for (let i = 0; i < 2500; i++) {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    const l = v.length();
    if (l > 0.95 || v.distanceTo(nucleusPos) < 0.42) continue;
    cyto.push(v.x * 1.1, v.y * 0.9, v.z * 0.95);
  }
  const cytoGeo = new THREE.BufferGeometry();
  cytoGeo.setAttribute('position', new THREE.Float32BufferAttribute(cyto, 3));
  const cytoPts = new THREE.Points(cytoGeo, new THREE.PointsMaterial({ color: style.primary, size: 0.012, map: glowTexture(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(cytoPts);
  scene.add(dustField(13, 600, 8, style.primary, 0.02));

  return {
    scene,
    camera,
    update(lt, dur) {
      applyCamera(camera, sc.camera, lt, dur, { target: new THREE.Vector3(), radius: 1.2, azimuth: 0.4, elevation: 0.15 });
      root.rotation.y = lt * 0.12;
      memMat.uniforms.uT.value = lt;
      const on = smooth(0, 1.2, lt);
      memMat.uniforms.uAlpha.value = on;
      for (const o of root.children) {
        const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | THREE.PointsMaterial;
        if ((mat as THREE.ShaderMaterial).uniforms?.uAlpha) (mat as THREE.ShaderMaterial).uniforms.uAlpha.value = on;
        else if (mat && 'opacity' in mat) mat.opacity = on * 0.6;
      }
      mitos.forEach((x) => {
        x.m.position.copy(x.base).add(new THREE.Vector3(Math.sin(lt * 0.6 + x.ph), Math.cos(lt * 0.5 + x.ph), Math.sin(lt * 0.4 + x.ph * 2)).multiplyScalar(0.03));
      });
      cytoPts.rotation.y = lt * 0.03;
      root.updateMatrixWorld();
    },
    labels() {
      const w = (v: THREE.Vector3) => v.clone().applyMatrix4(root.matrixWorld);
      return [
        { pos: w(new THREE.Vector3(1.12, 0.2, 0)), text: 'Membrana plasmática' },
        { pos: w(nucleusPos.clone().add(new THREE.Vector3(-0.2, 0.25, 0.1))), text: 'Núcleo' },
        { pos: w(mitos[0].base), text: 'Mitocondria', color: style.accent },
      ];
    },
    dispose() {
      disposeObject(scene);
    },
  };
};
