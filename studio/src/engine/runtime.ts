import type * as THREE from 'three';
import type { VisualStyle } from './styles';
import type { Scene } from './types';

export interface AssetResolver {
  /** Devuelve el archivo GLB/GLTF guardado en el teléfono. */
  getModel(id: string): Promise<{ name: string; data: ArrayBuffer } | null>;
}

export interface BuildContext {
  scene: Scene;
  style: VisualStyle;
  assets: AssetResolver;
}

export interface Label3D {
  pos: THREE.Vector3;
  text: string;
  color?: string;
}

/**
 * Una escena construida. Todo lo que se dibuja depende solo del tiempo local `lt`,
 * así la vista previa y la exportación fotograma a fotograma producen la misma imagen.
 */
export interface SceneRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(lt: number, dur: number): void;
  /** Etiquetas ancladas a puntos 3D (coordenadas de mundo, tras update). */
  labels(): Label3D[];
  /** Leyenda de colores opcional (p. ej., neurotransmisores). */
  legend?(): { color: string; text: string }[];
  dispose(): void;
}

export type SceneBuilder = (ctx: BuildContext) => SceneRuntime | Promise<SceneRuntime>;
