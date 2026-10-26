import * as THREE from 'three';
import { TAU, frac, rng, smooth } from '../math';
import { disposeObject, fresnelMaterial } from '../three-utils';
import type { SceneBuilder } from '../runtime';

/** Frecuencia cardiaca de la escena (≈ 66 latidos por minuto). La usa también el audio. */
export const HEART_HZ = 1.1;

/** Perfil bicóncavo del eritrocito (aproximación de Evans y Fung), girado alrededor del eje Y. */
function rbcGeometry() {
  const pts: THREE.Vector2[] = [];
  const R = 0.1;
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * R, q = x / R, s = Math.sqrt(Math.max(0, 1 - q * q));
    pts.push(new THREE.Vector2(x, R * 0.5 * s * (0.207 + 2.003 * q * q - 1.123 * q ** 4)));
  }
  for (let i = 23; i >= 0; i--) pts.push(new THREE.Vector2(pts[i].x, -pts[i].y));
  const g = new THREE.LatheGeometry(pts, 32);
  g.computeVertexNormals();
  return g;
}

/** Flujo pulsátil: posición integrada de v(t) = v0·(1 + 0,45·sin(2πft)). */
const flow = (t: number, v0: number) => v0 * t + ((v0 * 0.45) / (TAU * HEART_HZ)) * (1 - Math.cos(TAU * HEART_HZ * t));

export const buildBlood: SceneBuilder = ({ scene: sc, style }) => {
  const r = rng(51);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 9 / 16, 0.01, 100);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.8) * 0.9, Math.cos(i * 0.55) * 0.6, -i * 2.2));
  const curve = new THREE.CatmullRomCurve3(pts);
  const L = curve.getLength();
  const R = 0.55;

  // pared del vaso (endotelio), vista desde dentro
  const wallMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uT: { value: 0 }, uA: { value: 1 }, uCol: { value: new THREE.Color('#5a0b14') }, uRim: { value: new THREE.Color(style.warm) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0);
        vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uT, uA; uniform vec3 uCol, uRim; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float cells = 0.5 + 0.5*sin(vUv.x*900.0 + sin(vUv.y*40.0)*3.0) * sin(vUv.y*60.0 + sin(vUv.x*300.0));
        float f = pow(1.0 - abs(dot(vN, vV)), 1.5);
        vec3 c = uCol*(0.5+0.5*cells) + uRim*f*0.5;
        gl_FragColor = vec4(c*uA, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, R, 48, false), wallMat));

  // eritrocitos
  const N = 170;
  const cells = Array.from({ length: N }, () => ({
    u0: r(), rad: Math.sqrt(r()) * (R - 0.14), ang: r() * TAU,
    rot: new THREE.Euler(r() * TAU, r() * TAU, r() * TAU), spin: (r() - 0.5) * 2, speed: 0.85 + r() * 0.3,
  }));
  const rbcMat = new THREE.MeshStandardMaterial({ color: '#c3172b', roughness: 0.45, metalness: 0.05, emissive: '#3a0208' });
  const rbc = new THREE.InstancedMesh(rbcGeometry(), rbcMat, N);
  rbc.frustumCulled = false;
  scene.add(rbc);
  // plaquetas y plasma
  const plt = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.018, 1), fresnelMaterial('#ffd7a8', '#fff2d0', { additive: true, base: 0.5, alpha: 0.7 }), 60);
  plt.frustumCulled = false;
  scene.add(plt);
  const plats = Array.from({ length: 60 }, () => ({ u0: r(), rad: Math.sqrt(r()) * (R - 0.08), ang: r() * TAU }));

  scene.add(new THREE.HemisphereLight('#ff9a8a', '#200004', 1.4));
  const head = new THREE.PointLight('#ffffff', 3, 4, 1.5);
  scene.add(head);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const frame = (u: number, rad: number, ang: number, out: THREE.Vector3) => {
    curve.getPointAt(u, out);
    curve.getTangentAt(u, tan);
    nrm.crossVectors(tan, up).normalize();
    bin.crossVectors(nrm, tan).normalize();
    return out.addScaledVector(nrm, Math.cos(ang) * rad).addScaledVector(bin, Math.sin(ang) * rad);
  };
  let anchorCell = new THREE.Vector3();
  let anchorWall = new THREE.Vector3();

  return {
    scene,
    camera,
    update(lt) {
      const on = smooth(0, 1, lt);
      wallMat.uniforms.uA.value = on;
      rbcMat.opacity = 1;
      const camU = 0.06 + flow(lt, 0.25) / L;
      const look = camU + 0.04;
      // la cámara viaja dentro del vaso; los movimientos se traducen en desplazamiento lateral
      const lat = sc.camera === 'pan' ? Math.sin(lt * 0.4) * 0.15 : 0.05 * Math.sin(lt * 0.5);
      frame(Math.min(camU, 0.9), 0.12 + lat, 0.3, camera.position);
      frame(Math.min(look, 0.95), 0, 0, p);
      camera.lookAt(p);
      camera.updateMatrixWorld();
      head.position.copy(camera.position);
      head.intensity = 3 * on;
      const fl = flow(lt, 0.8);
      let best = 1e9;
      cells.forEach((c, i) => {
        const u = frac(c.u0 + (fl * c.speed) / L);
        frame(u, c.rad, c.ang + lt * 0.1, p);
        q.setFromEuler(new THREE.Euler(c.rot.x + lt * c.spin, c.rot.y, c.rot.z + lt * c.spin * 0.6));
        rbc.setMatrixAt(i, m4.compose(p, q, sc3));
        const d = p.distanceTo(camera.position);
        const ahead = u > camU + 0.012 && u < camU + 0.05;
        if (ahead && d < best) { best = d; anchorCell = p.clone(); }
      });
      rbc.instanceMatrix.needsUpdate = true;
      plats.forEach((c, i) => {
        const u = frac(c.u0 + (fl * 1.1) / L);
        frame(u, c.rad, c.ang, p);
        plt.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
      });
      plt.instanceMatrix.needsUpdate = true;
      frame(Math.min(camU + 0.035, 0.97), R * 0.98, Math.PI * 0.8, anchorWall);
    },
    labels() {
      return [
        { pos: anchorCell.clone(), text: 'Eritrocito (glóbulo rojo)', color: style.warm },
        { pos: anchorWall.clone(), text: 'Pared del vaso (endotelio)' },
      ];
    },
    dispose() {
      disposeObject(scene);
    },
  };
};
