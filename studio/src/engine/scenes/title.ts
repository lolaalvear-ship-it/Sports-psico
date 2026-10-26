import * as THREE from 'three';
import { rng, smooth } from '../math';
import { applyCamera, disposeObject, dustField, glowSprite } from '../three-utils';
import type { SceneBuilder } from '../runtime';

/** Fondo para títulos: constelación de nodos conectados que se dibuja poco a poco. */
export const buildTitle: SceneBuilder = ({ scene: sc, style }) => {
  const r = rng(91);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 100);
  const nodes = Array.from({ length: 60 }, () => new THREE.Vector3((r() - 0.5) * 4, (r() - 0.5) * 6, (r() - 0.5) * 3 - 0.5));
  const seg: number[] = [];
  const order: number[] = [];
  nodes.forEach((a, i) => nodes.forEach((b, j) => {
    if (j <= i || a.distanceTo(b) > 0.95) return;
    seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const o = r();
    order.push(o, o); // mismo orden para los dos extremos del segmento
  }));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  lg.setAttribute('aOrder', new THREE.Float32BufferAttribute(order, 1));
  const lineMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { uP: { value: 0 }, uCol: { value: new THREE.Color(style.primary) } },
    vertexShader: 'attribute float aOrder; varying float vO; void main(){ vO = aOrder; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float uP; uniform vec3 uCol; varying float vO; void main(){ float a = smoothstep(vO, vO+0.15, uP); gl_FragColor = vec4(uCol*a*0.45, 1.0); }',
  });
  scene.add(new THREE.LineSegments(lg, lineMat));
  const sprites = nodes.map((n, i) => {
    const s = glowSprite(i % 5 === 0 ? style.accent : style.secondary, 0.12 + r() * 0.1, 0);
    s.position.copy(n);
    scene.add(s);
    return { s, ph: r() * 6 };
  });
  scene.add(dustField(17, 1200, 10, style.primary, 0.025));
  return {
    scene,
    camera,
    update(lt, dur) {
      applyCamera(camera, sc.camera, lt, dur, { target: new THREE.Vector3(0, 0, -0.5), radius: 1.8, azimuth: 0, elevation: 0 });
      lineMat.uniforms.uP.value = smooth(0, 2.5, lt) * 1.15;
      sprites.forEach(({ s, ph }) => (s.material.opacity = smooth(0, 1.5, lt) * (0.5 + 0.5 * Math.sin(lt * 1.5 + ph))));
    },
    labels: () => [],
    dispose() {
      disposeObject(scene);
    },
  };
};
