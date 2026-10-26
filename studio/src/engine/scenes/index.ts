import type { SceneBuilder } from '../runtime';
import type { SceneKind } from '../types';
import { buildBlood } from './blood';
import { buildBrain } from './brain';
import { buildCell } from './cell';
import { buildModel } from './model';
import { buildMolecule } from './molecule';
import { buildNetwork } from './network';
import { buildSynapse } from './synapse';
import { buildTitle } from './title';

/** Registro de tipos de escena: añadir uno nuevo = un archivo + una línea aquí. */
export const SCENE_BUILDERS: Record<SceneKind, SceneBuilder> = {
  title: buildTitle,
  brain: buildBrain,
  network: buildNetwork,
  synapse: buildSynapse,
  blood: buildBlood,
  molecule: buildMolecule,
  cell: buildCell,
  model: buildModel,
};

export const SCENE_INFO: Record<SceneKind, { name: string; icon: string; description: string }> = {
  title: { name: 'Título', icon: '✦', description: 'Constelación luminosa con texto grande' },
  brain: { name: 'Cerebro 3D', icon: '🧠', description: 'Cerebro de partículas con regiones resaltadas y vías' },
  network: { name: 'Red neuronal', icon: '🕸️', description: 'Neuronas con impulsos eléctricos' },
  synapse: { name: 'Sinapsis', icon: '⚡', description: 'Liberación de neurotransmisores' },
  blood: { name: 'Circulación', icon: '🩸', description: 'Interior de un vaso con flujo pulsátil' },
  molecule: { name: 'Molécula', icon: '⚛️', description: 'Estructura de átomos y enlaces' },
  cell: { name: 'Célula', icon: '🦠', description: 'Célula eucariota con orgánulos' },
  model: { name: 'Modelo GLB', icon: '📦', description: 'Tu modelo anatómico importado' },
};
