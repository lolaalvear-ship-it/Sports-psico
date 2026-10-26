import { uid } from '../engine/math';
import { BRAIN_REGIONS } from '../engine/scenes/brain';
import { MOLECULES } from '../engine/scenes/molecule';
import { TRANSMITTERS } from '../engine/scenes/synapse';
import type { Aspect, CameraMove, Project, Scene, SceneKind, SceneParams } from '../engine/types';

export const SPECIALTIES = [
  'Neurociencia', 'Psicología', 'Cardiología', 'Hematología', 'Biología celular', 'Farmacología', 'Bioquímica', 'Medicina general',
];
export const DURATIONS = [15, 30, 45, 60];

export interface GenerateInput { topic: string; specialty: string; duration: number; aspect: Aspect; styleId: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function newScene(kind: SceneKind, o: Partial<Scene> = {}, params: SceneParams = {}): Scene {
  const defaults: Record<SceneKind, Partial<Scene>> = {
    title: { camera: 'dolly-in', conceptual: false },
    brain: { camera: 'orbit', params: { highlights: ['pfc'], pathways: false } },
    network: { camera: 'dolly-in' },
    synapse: { camera: 'pull-back', params: { transmitters: ['dopamina'] } },
    blood: { camera: 'static' },
    molecule: { camera: 'static', conceptual: false, params: { molecule: 'dopamina' } },
    cell: { camera: 'orbit' },
    model: { camera: 'orbit', conceptual: false, params: { modelLook: 'original' } },
  };
  const d = defaults[kind];
  return {
    id: uid(), kind, duration: 4, title: '', caption: '', camera: (d.camera ?? 'orbit') as CameraMove,
    conceptual: d.conceptual ?? true, showLabels: true,
    ...o,
    params: { ...(d.params ?? {}), ...params },
  };
}

const REGION_WORDS: [RegExp, string[]][] = [
  [/memori|recuerd|aprend/, ['hippocampus']],
  [/miedo|ansiedad|estres|emoci|panico|amenaz/, ['amygdala']],
  [/recompens|placer|adicc|motivac|amor|enamor|deseo|obsesi/, ['vta', 'caudate', 'nacc']],
  [/decisi|atenci|planific|control|impuls|juicio/, ['pfc']],
  [/dolor/, ['insula', 'acc']],
  [/movimient|motor|parkinson/, ['motor']],
  [/vision|visual|ver\b|ojo/, ['visual']],
  [/equilibri|coordinac/, ['cerebellum']],
  [/hambre|sueno|hormon|apetito|temperatura/, ['hypothalamus']],
];
const TX_WORDS: [RegExp, string][] = [
  [/dopamin/, 'dopamina'], [/serotonin/, 'serotonina'], [/oxitocin/, 'oxitocina'], [/vasopresin/, 'vasopresina'],
  [/noradrenalin|adrenalin|norepinefrin/, 'noradrenalina'], [/glutamat/, 'glutamato'], [/gaba/, 'gaba'], [/acetilcolin/, 'acetilcolina'],
];

function pickRegions(t: string) {
  const out = new Set<string>();
  for (const [re, keys] of REGION_WORDS) if (re.test(t)) keys.forEach((k) => out.add(k));
  if (!out.size) ['pfc', 'amygdala', 'hippocampus'].forEach((k) => out.add(k));
  return [...out].slice(0, 4);
}
function pickTransmitters(t: string) {
  const out = TX_WORDS.filter(([re]) => re.test(t)).map(([, k]) => k);
  if (out.length) return out.slice(0, 3);
  if (/depres|animo|tristeza/.test(t)) return ['serotonina', 'noradrenalina'];
  if (/amor|enamor|vinculo|apego/.test(t)) return ['dopamina', 'oxitocina'];
  if (/estres|miedo|alerta/.test(t)) return ['noradrenalina', 'glutamato'];
  return ['dopamina', 'glutamato'];
}
const pickMolecule = (t: string) => Object.keys(MOLECULES).find((k) => t.includes(k.slice(0, 7))) ?? 'dopamina';

const regionList = (keys: string[]) => keys.map((k) => BRAIN_REGIONS[k].name).join(', ');
const txList = (keys: string[]) => keys.map((k) => TRANSMITTERS[k].name).join(', ');

/**
 * Composición automática por plantillas (fase 1, sin IA ni servidor).
 * Elige escenas según la especialidad y palabras clave del tema; los textos son un
 * borrador genérico que conviene revisar en el editor.
 */
export function generateProject(inp: GenerateInput): Project {
  const t = norm(inp.topic);
  const spec = norm(inp.specialty);
  if (/enamor|amor romantic/.test(t) && inp.duration === 15) return loveDemo(inp.aspect, inp.styleId);

  const title = newScene('title', { title: inp.topic.trim() || 'Tema científico', duration: 3 }, { subtitle: inp.specialty });
  const body: Scene[] = [];
  const regions = pickRegions(t);
  const tx = pickTransmitters(t);
  const brain = () => newScene('brain', { title: 'Regiones implicadas', caption: `Áreas que suelen asociarse con este tema: ${regionList(regions)}.` }, { highlights: regions, pathways: regions.includes('vta') });
  const network = () => newScene('network', { title: 'Comunicación neuronal', caption: 'Las neuronas se comunican mediante impulsos eléctricos que recorren sus axones.' });
  const synapse = () => newScene('synapse', { title: 'Sinapsis', caption: `En la sinapsis se liberan neurotransmisores: ${txList(tx)}.` }, { transmitters: tx });
  const molecule = (m = pickMolecule(t)) => newScene('molecule', { title: 'Estructura molecular', caption: 'Modelo de esferas y varillas: cada esfera es un átomo y cada varilla, un enlace.' }, { molecule: m });
  const blood = () => newScene('blood', { title: 'Circulación sanguínea', caption: 'Los glóbulos rojos transportan oxígeno; el flujo se acelera con cada latido.' });
  const cell = () => newScene('cell', { title: 'La célula', caption: 'Núcleo, mitocondrias y membrana: los componentes básicos de una célula eucariota.' });

  if (/neuro|psico/.test(spec)) body.push(brain(), network(), synapse());
  else if (/cardio|hemato/.test(spec)) body.push(blood(), cell());
  else if (/celular/.test(spec)) body.push(cell(), molecule());
  else if (/farmaco|bioquim/.test(spec)) body.push(molecule(), synapse());
  else body.push(cell(), blood(), brain());
  if (inp.duration >= 30) {
    if (/neuro|psico/.test(spec)) body.push(molecule(tx.find((k) => MOLECULES[k]) ?? 'dopamina'));
    else body.push(network());
  }
  const closing = inp.duration >= 20 ? [newScene('title', { title: inp.topic.trim(), duration: 3, camera: 'pull-back' }, { subtitle: 'Visualización educativa' })] : [];
  const fixed = title.duration + closing.reduce((s, x) => s + x.duration, 0);
  const each = Math.max(2.5, Math.round(((inp.duration - fixed) / body.length) * 10) / 10);
  body.forEach((s) => (s.duration = each));
  // ajuste para cuadrar la duración exacta
  const diff = inp.duration - fixed - each * body.length;
  body[body.length - 1].duration = Math.round((each + diff) * 10) / 10;

  return baseProject({
    name: inp.topic.trim() || 'Proyecto sin título', topic: inp.topic, specialty: inp.specialty, styleId: inp.styleId, aspect: inp.aspect,
    scenes: [title, ...body, ...closing], citations: 'Añade aquí tus fuentes (editor → Proyecto).',
  });
}

function baseProject(p: Pick<Project, 'name' | 'topic' | 'specialty' | 'styleId' | 'aspect' | 'scenes' | 'citations'> & Partial<Project>): Project {
  const now = Date.now();
  return { version: 1, id: uid(), fps: 30, audio: { enabled: true, mood: 'ambiental' }, createdAt: now, updatedAt: now, ...p };
}

/** Primer video de prueba: «¿Qué sucede en tu cerebro cuando te enamoras?» (15 s). */
export function loveDemo(aspect: Aspect = '9:16', styleId = 'calido'): Project {
  return baseProject({
    name: '¿Qué sucede en tu cerebro cuando te enamoras?',
    topic: '¿Qué sucede en tu cerebro cuando te enamoras?',
    specialty: 'Neurociencia',
    styleId,
    aspect,
    audio: { enabled: true, mood: 'calido' },
    citations: 'Fuentes: Fisher, Aron y Brown, J Neurophysiol 2005 · Bartels y Zeki, NeuroReport 2000 · Young y Wang, Nat Neurosci 2004',
    scenes: [
      newScene('title', { title: '¿Qué sucede en tu cerebro cuando te enamoras?', duration: 3 }, { subtitle: 'Neurociencia del amor romántico' }),
      newScene('brain', {
        title: 'Sistema de recompensa', duration: 4.5, camera: 'orbit',
        caption: 'En resonancias de personas recién enamoradas se activan el área tegmental ventral y el núcleo caudado.',
      }, { highlights: ['vta', 'caudate'], pathways: true, heartbeat: true }),
      newScene('network', {
        title: 'Impulsos eléctricos', duration: 3, camera: 'dolly-in',
        caption: 'Las neuronas se comunican con impulsos eléctricos que viajan por sus axones.',
      }),
      newScene('synapse', {
        title: 'Neurotransmisores', duration: 4.5, camera: 'pull-back',
        caption: 'La dopamina se asocia con la motivación; la oxitocina y la vasopresina, con el vínculo.',
      }, { transmitters: ['dopamina', 'oxitocina', 'vasopresina'] }),
    ],
  });
}
