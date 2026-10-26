import { useState } from 'react';
import { BRAIN_REGIONS } from '../engine/scenes/brain';
import { SCENE_INFO } from '../engine/scenes';
import { MOLECULE_NAMES } from '../engine/scenes/molecule';
import { TRANSMITTERS } from '../engine/scenes/synapse';
import type { CameraMove, Scene, SceneKind } from '../engine/types';
import type { StoredModel } from '../storage/models';

const CAMERAS: Record<CameraMove, string> = {
  orbit: 'Órbita', 'dolly-in': 'Acercamiento', 'pull-back': 'Alejamiento', pan: 'Paneo', static: 'Fija',
};

function toggle(list: string[] | undefined, k: string) {
  const s = new Set(list ?? []);
  if (s.has(k)) s.delete(k); else s.add(k);
  return [...s];
}

interface Props {
  scene: Scene;
  index: number;
  count: number;
  start: number;
  models: Omit<StoredModel, 'data'>[];
  onChange: (s: Scene) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onSeek: () => void;
}

export function SceneEditor({ scene: s, index, count, start, models, onChange, onMove, onDelete, onSeek }: Props) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Scene>) => onChange({ ...s, ...patch });
  const setP = (patch: Partial<Scene['params']>) => onChange({ ...s, params: { ...s.params, ...patch } });
  const info = SCENE_INFO[s.kind];
  return (
    <div className={'scene-card ' + (open ? 'open' : '')}>
      <div className="scene-head" onClick={() => { setOpen(!open); onSeek(); }}>
        <span className="scene-icon">{info.icon}</span>
        <div className="scene-sum">
          <b>{index + 1}. {s.title || info.name}</b>
          <small>{info.name} · {s.duration.toFixed(1)} s · desde {start.toFixed(1)} s</small>
        </div>
        <span className="chev">{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div className="scene-body">
          <label className="field"><span>Título</span>
            <input value={s.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          {s.kind === 'title' && (
            <label className="field"><span>Subtítulo</span>
              <input value={s.params.subtitle ?? ''} onChange={(e) => setP({ subtitle: e.target.value })} />
            </label>
          )}
          <label className="field"><span>Texto científico</span>
            <textarea rows={3} value={s.caption} onChange={(e) => set({ caption: e.target.value })} />
          </label>
          <div className="row2">
            <label className="field"><span>Duración (s)</span>
              <input type="number" min={1.5} max={20} step={0.5} value={s.duration} onChange={(e) => set({ duration: Math.max(1.5, Math.min(20, Number(e.target.value) || 1.5)) })} />
            </label>
            <label className="field"><span>Cámara</span>
              <select value={s.camera} onChange={(e) => set({ camera: e.target.value as CameraMove })}>
                {Object.entries(CAMERAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          {s.kind === 'brain' && (
            <div className="field"><span>Regiones resaltadas</span>
              <div className="chips">
                {Object.entries(BRAIN_REGIONS).map(([k, r]) => (
                  <button key={k} className={s.params.highlights?.includes(k) ? 'on' : ''} onClick={() => setP({ highlights: toggle(s.params.highlights, k) })}>{r.name}</button>
                ))}
              </div>
              <label className="check"><input type="checkbox" checked={!!s.params.pathways} onChange={(e) => setP({ pathways: e.target.checked })} /> Vías dopaminérgicas con impulsos</label>
              <label className="check"><input type="checkbox" checked={!!s.params.heartbeat} onChange={(e) => setP({ heartbeat: e.target.checked })} /> Latido en el audio</label>
            </div>
          )}
          {s.kind === 'synapse' && (
            <div className="field"><span>Neurotransmisores</span>
              <div className="chips">
                {Object.entries(TRANSMITTERS).map(([k, t]) => (
                  <button key={k} className={s.params.transmitters?.includes(k) ? 'on' : ''} style={{ ['--chip' as string]: t.color }} onClick={() => setP({ transmitters: toggle(s.params.transmitters, k) })}>{t.name}</button>
                ))}
              </div>
            </div>
          )}
          {s.kind === 'molecule' && (
            <label className="field"><span>Molécula</span>
              <select value={s.params.molecule} onChange={(e) => setP({ molecule: e.target.value })}>
                {Object.entries(MOLECULE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
          {s.kind === 'model' && (
            <>
              <label className="field"><span>Modelo</span>
                <select value={s.params.modelId ?? ''} onChange={(e) => setP({ modelId: e.target.value })}>
                  <option value="">— elige un modelo importado —</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Aspecto</span>
                <select value={s.params.modelLook ?? 'original'} onChange={(e) => setP({ modelLook: e.target.value as 'original' | 'holograma' })}>
                  <option value="original">Materiales originales</option>
                  <option value="holograma">Holograma</option>
                </select>
              </label>
            </>
          )}
          <label className="check"><input type="checkbox" checked={s.showLabels} onChange={(e) => set({ showLabels: e.target.checked })} /> Etiquetas anatómicas</label>
          <label className="check"><input type="checkbox" checked={s.conceptual} onChange={(e) => set({ conceptual: e.target.checked })} /> Aviso «Representación conceptual»</label>
          <div className="scene-actions">
            <button className="btn small" disabled={index === 0} onClick={() => onMove(-1)}>↑ Subir</button>
            <button className="btn small" disabled={index === count - 1} onClick={() => onMove(1)}>↓ Bajar</button>
            <button className="btn small danger" disabled={count === 1} onClick={onDelete}>Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export const ADDABLE: SceneKind[] = ['title', 'brain', 'network', 'synapse', 'blood', 'molecule', 'cell', 'model'];
