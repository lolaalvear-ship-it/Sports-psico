import { useEffect, useState } from 'react';
import { timeline, projectDuration } from '../engine/engine';
import { SCENE_INFO } from '../engine/scenes';
import { STYLES } from '../engine/styles';
import type { AudioMood, Project, Scene, SceneKind } from '../engine/types';
import { newScene } from '../generator/generator';
import { listModels, type StoredModel } from '../storage/models';
import { ExportPanel } from './ExportPanel';
import { Player } from './Player';
import { ADDABLE, SceneEditor } from './SceneEditor';

export function EditorView({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [seek, setSeek] = useState<{ t: number; n: number }>();
  const [models, setModels] = useState<Omit<StoredModel, 'data'>[]>([]);
  const [addKind, setAddKind] = useState<SceneKind>('brain');
  useEffect(() => { listModels().then(setModels); }, []);

  const set = (patch: Partial<Project>) => onChange({ ...project, ...patch });
  const setScenes = (scenes: Scene[]) => set({ scenes });
  const tl = timeline(project);

  return (
    <div className="view editor">
      <Player project={project} seekTo={seek} />
      <section className="card">
        <div className="card-title">
          <h2>Escenas</h2>
          <span className="muted small">{tl.length} escenas · {projectDuration(project).toFixed(1)} s</span>
        </div>
        {project.scenes.map((s, i) => (
          <SceneEditor
            key={s.id}
            scene={s}
            index={i}
            count={project.scenes.length}
            start={tl[i].start}
            models={models}
            onSeek={() => setSeek({ t: tl[i].start + Math.min(1.5, s.duration / 2), n: Date.now() })}
            onChange={(ns) => setScenes(project.scenes.map((x) => (x.id === s.id ? ns : x)))}
            onDelete={() => setScenes(project.scenes.filter((x) => x.id !== s.id))}
            onMove={(d) => {
              const arr = [...project.scenes];
              [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
              setScenes(arr);
            }}
          />
        ))}
        <div className="add-scene">
          <select value={addKind} onChange={(e) => setAddKind(e.target.value as SceneKind)}>
            {ADDABLE.map((k) => <option key={k} value={k}>{SCENE_INFO[k].icon} {SCENE_INFO[k].name}</option>)}
          </select>
          <button className="btn" onClick={() => setScenes([...project.scenes, newScene(addKind, { title: SCENE_INFO[addKind].name })])}>+ Añadir escena</button>
        </div>
      </section>

      <section className="card">
        <h2>Proyecto</h2>
        <label className="field"><span>Nombre</span>
          <input value={project.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div className="row2">
          <label className="field"><span>Estilo</span>
            <select value={project.styleId} onChange={(e) => set({ styleId: e.target.value })}>
              {STYLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Formato</span>
            <select value={project.aspect} onChange={(e) => set({ aspect: e.target.value as Project['aspect'] })}>
              <option value="9:16">9:16 vertical</option>
              <option value="16:9">16:9 horizontal</option>
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field"><span>Música</span>
            <select value={project.audio.mood} onChange={(e) => set({ audio: { ...project.audio, mood: e.target.value as AudioMood } })}>
              <option value="ambiental">Ambiental</option>
              <option value="calido">Cálida</option>
              <option value="tension">Tensión</option>
            </select>
          </label>
          <label className="check" style={{ alignSelf: 'end' }}>
            <input type="checkbox" checked={project.audio.enabled} onChange={(e) => set({ audio: { ...project.audio, enabled: e.target.checked } })} /> Audio
          </label>
        </div>
        <label className="field"><span>Fuentes (aparecen al final)</span>
          <textarea rows={2} value={project.citations} onChange={(e) => set({ citations: e.target.value })} />
        </label>
      </section>

      <ExportPanel project={project} />
    </div>
  );
}
