import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { smooth } from '../math';
import { applyCamera, disposeObject, dustField, fresnelMaterial } from '../three-utils';
import type { SceneBuilder } from '../runtime';

/**
 * Escena con un modelo anatómico GLB/GLTF importado por el usuario.
 * El modelo se centra y se escala a radio 1; puede verse con sus materiales o como holograma.
 */
export const buildModel: SceneBuilder = async ({ scene: sc, style, assets }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.01, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);
  let labelText = 'Modelo 3D';
  const file = sc.params.modelId ? await assets.getModel(sc.params.modelId) : null;
  let fadeMats: THREE.Material[] = [];
  if (file) {
    try {
      const gltf = await new GLTFLoader().parseAsync(file.data, '');
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3()).length() / 2 || 1;
      obj.position.sub(box.getCenter(new THREE.Vector3()));
      const wrap = new THREE.Group();
      wrap.add(obj);
      wrap.scale.setScalar(1 / size);
      pivot.add(wrap);
      if (sc.params.modelLook === 'holograma') {
        const mat = fresnelMaterial(new THREE.Color(style.primary).multiplyScalar(0.15), style.secondary, { additive: true, base: 0.08, glow: 1.6 * style.glow, side: THREE.DoubleSide });
        obj.traverse((n) => { if ((n as THREE.Mesh).isMesh) (n as THREE.Mesh).material = mat; });
      }
      obj.traverse((n) => {
        const m = (n as THREE.Mesh).material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.transparent = true; fadeMats.push(x); });
      });
      labelText = file.name.replace(/\.(glb|gltf)$/i, '');
    } catch (e) {
      labelText = 'No se pudo leer el modelo';
      console.error(e);
    }
  }
  if (!pivot.children.length) {
    const ph = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshBasicMaterial({ color: style.secondary, wireframe: true, transparent: true }));
    pivot.add(ph);
    fadeMats = [ph.material];
    if (!file) labelText = 'Modelo no encontrado: impórtalo en Biblioteca';
  }
  scene.add(new THREE.HemisphereLight('#e8f0ff', '#15161c', 1.8));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(2, 3, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(style.secondary, 2);
  rim.position.set(-3, 1, -2);
  scene.add(rim);
  scene.add(dustField(23, 600, 8, style.primary, 0.02));

  return {
    scene,
    camera,
    update(lt, dur) {
      applyCamera(camera, sc.camera, lt, dur, { target: new THREE.Vector3(), radius: 1.05, azimuth: 0.5, elevation: 0.15 });
      pivot.rotation.y = lt * 0.35;
      const on = smooth(0, 1, lt);
      fadeMats.forEach((m) => {
        const sm = m as THREE.ShaderMaterial;
        if (sm.uniforms?.uAlpha) sm.uniforms.uAlpha.value = on;
        else m.opacity = on;
      });
    },
    labels: () => [{ pos: new THREE.Vector3(0, 0.85, 0), text: labelText }],
    dispose() {
      disposeObject(scene);
    },
  };
};
