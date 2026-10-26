export type SceneKind = 'title' | 'brain' | 'network' | 'synapse' | 'blood' | 'molecule' | 'cell' | 'model';
export type CameraMove = 'orbit' | 'dolly-in' | 'pull-back' | 'pan' | 'static';
export type Aspect = '9:16' | '16:9';
export type AudioMood = 'ambiental' | 'calido' | 'tension';

export interface SceneParams {
  /** brain: regiones resaltadas (claves de BRAIN_REGIONS). */
  highlights?: string[];
  /** brain: vías dopaminérgicas con impulsos. */
  pathways?: boolean;
  /** brain: latido en la banda sonora. */
  heartbeat?: boolean;
  /** synapse: neurotransmisores (claves de TRANSMITTERS). */
  transmitters?: string[];
  /** molecule: clave de MOLECULES. */
  molecule?: string;
  /** model: id del modelo GLB/GLTF guardado en el teléfono. */
  modelId?: string;
  modelLook?: 'original' | 'holograma';
  /** title: subtítulo pequeño bajo el título. */
  subtitle?: string;
}

export interface Scene {
  id: string;
  kind: SceneKind;
  /** segundos */
  duration: number;
  title: string;
  caption: string;
  camera: CameraMove;
  /** Muestra la etiqueta «Representación conceptual». */
  conceptual: boolean;
  showLabels: boolean;
  params: SceneParams;
}

export interface Project {
  version: 1;
  id: string;
  name: string;
  topic: string;
  specialty: string;
  styleId: string;
  aspect: Aspect;
  fps: number;
  scenes: Scene[];
  /** Fuentes que aparecen al final del video. */
  citations: string;
  audio: { enabled: boolean; mood: AudioMood };
  createdAt: number;
  updatedAt: number;
}
