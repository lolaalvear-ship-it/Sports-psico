import { useRef, useState } from 'react';
import { projectDuration } from '../engine/engine';
import { uid } from '../engine/math';
import type { Project } from '../engine/types';
import { deleteProject, listProjects, projectFromFile, projectToFile, saveProject } from '../storage/projects';

export function ProjectsView({ currentId, onOpen }: { currentId?: string; onOpen: (p: Project) => void }) {
  const [list, setList] = useState(listProjects);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => setList(listProjects());

  function download(p: Project) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(projectToFile(p));
    a.download = `${p.name.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '_')}.sms.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="view">
      {msg && <p className="toast" onClick={() => setMsg(null)}>{msg}</p>}
      <section className="card">
        <h2>Mis proyectos</h2>
        <p className="muted small">Se guardan automáticamente en este teléfono. Para no perderlos si borras los datos del navegador, descarga una copia (.json).</p>
        {!list.length && <p className="muted">Aún no hay proyectos.</p>}
        {list.map((p) => (
          <div key={p.id} className={'lib-item ' + (p.id === currentId ? 'current' : '')}>
            <div onClick={() => onOpen(p)} style={{ flex: 1 }}>
              <b>{p.name}</b>
              <small>{p.aspect} · {projectDuration(p).toFixed(0)} s · {new Date(p.updatedAt).toLocaleString()}</small>
            </div>
            <button className="btn small" onClick={() => onOpen(p)}>Abrir</button>
            <button className="btn small" onClick={() => download(p)} aria-label="Descargar copia">⬇</button>
            <button className="btn small" onClick={() => { const c = { ...structuredClone(p), id: uid(), name: p.name + ' (copia)', updatedAt: Date.now() }; saveProject(c); refresh(); }} aria-label="Duplicar">⧉</button>
            <button className="btn small danger" onClick={() => { if (confirm(`¿Eliminar «${p.name}»?`)) { deleteProject(p.id); refresh(); } }}>✕</button>
          </div>
        ))}
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try { const p = await projectFromFile(f); saveProject(p); refresh(); onOpen(p); } catch (err) { setMsg((err as Error).message); }
        }} />
        <button className="btn" onClick={() => input.current?.click()}>Abrir copia (.json)</button>
      </section>
    </div>
  );
}
