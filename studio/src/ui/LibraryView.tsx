import { useEffect, useRef, useState } from 'react';
import { BRAIN_REGIONS } from '../engine/scenes/brain';
import { SCENE_INFO } from '../engine/scenes';
import { MOLECULE_NAMES } from '../engine/scenes/molecule';
import type { Project, SceneKind } from '../engine/types';
import { newScene } from '../generator/generator';
import { deleteModel, importModel, listModels, type StoredModel } from '../storage/models';

const BUILTIN: { kind: SceneKind; extra: string }[] = [
  { kind: 'brain', extra: `${Object.keys(BRAIN_REGIONS).length} regiones: ${Object.values(BRAIN_REGIONS).slice(0, 4).map((r) => r.name).join(', ')}…` },
  { kind: 'network', extra: 'Somas, dendritas, axones y potenciales de acción' },
  { kind: 'synapse', extra: 'Vesículas, hendidura, receptores y 8 neurotransmisores' },
  { kind: 'blood', extra: 'Eritrocitos bicóncavos, plaquetas, flujo pulsátil' },
  { kind: 'cell', extra: 'Membrana, núcleo, nucléolo, mitocondrias' },
  { kind: 'molecule', extra: Object.values(MOLECULE_NAMES).join(', ') },
];

export function LibraryView({ project, onChange }: { project: Project | null; onChange: (p: Project) => void }) {
  const [models, setModels] = useState<Omit<StoredModel, 'data'>[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => listModels().then(setModels);
  useEffect(() => { refresh(); }, []);

  function add(kind: SceneKind, modelId?: string, name?: string) {
    if (!project) return setMsg('Primero crea o abre un proyecto.');
    const s = newScene(kind, { title: name ?? SCENE_INFO[kind].name }, modelId ? { modelId } : {});
    onChange({ ...project, scenes: [...project.scenes, s] });
    setMsg(`Añadida al final de «${project.name}».`);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const m = await importModel(f);
      setMsg(`Importado: ${m.name} (${(m.size / 1e6).toFixed(1)} MB)`);
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="view">
      {msg && <p className="toast" onClick={() => setMsg(null)}>{msg}</p>}
      <section className="card">
        <h2>Modelos científicos incluidos</h2>
        <p className="muted small">Generados por código: no ocupan espacio y se ven igual en cualquier resolución.</p>
        {BUILTIN.map((b) => (
          <div key={b.kind} className="lib-item">
            <span className="scene-icon">{SCENE_INFO[b.kind].icon}</span>
            <div><b>{SCENE_INFO[b.kind].name}</b><small>{b.extra}</small></div>
            <button className="btn small" onClick={() => add(b.kind)}>Añadir</button>
          </div>
        ))}
      </section>
      <section className="card">
        <h2>Mis modelos anatómicos (GLB / GLTF)</h2>
        <p className="muted small">Importa archivos .glb desde tu teléfono (por ejemplo, descargados de BodyParts3D, NIH 3D o Sketchfab con licencia libre). Se guardan solo en este navegador.</p>
        <input ref={input} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn" onClick={() => input.current?.click()}>📁 Importar modelo</button>
        {models.map((m) => (
          <div key={m.id} className="lib-item">
            <span className="scene-icon">📦</span>
            <div><b>{m.name}</b><small>{(m.size / 1e6).toFixed(1)} MB</small></div>
            <button className="btn small" onClick={() => add('model', m.id, m.name.replace(/\.(glb|gltf)$/i, ''))}>Añadir</button>
            <button className="btn small danger" onClick={async () => { await deleteModel(m.id); refresh(); }}>✕</button>
          </div>
        ))}
      </section>
    </div>
  );
}
