import { useEffect, useState } from 'react';
import type { Project } from './engine/types';
import { listProjects, saveProject } from './storage/projects';
import { CreateView } from './ui/CreateView';
import { EditorView } from './ui/EditorView';
import { LibraryView } from './ui/LibraryView';
import { ProjectsView } from './ui/ProjectsView';

type Tab = 'crear' | 'editor' | 'biblioteca' | 'proyectos';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'crear', icon: '✚', label: 'Crear' },
  { id: 'editor', icon: '🎬', label: 'Editor' },
  { id: 'biblioteca', icon: '🧬', label: 'Biblioteca' },
  { id: 'proyectos', icon: '🗂', label: 'Proyectos' },
];

export default function App() {
  const [project, setProject] = useState<Project | null>(() => listProjects()[0] ?? null);
  const [tab, setTab] = useState<Tab>(() => (listProjects().length ? 'editor' : 'crear'));
  const [saveError, setSaveError] = useState(false);

  // guardado automático
  useEffect(() => {
    if (!project) return;
    const id = setTimeout(() => setSaveError(!saveProject(project)), 400);
    return () => clearTimeout(id);
  }, [project]);

  const update = (p: Project) => setProject({ ...p, updatedAt: Date.now() });
  const open = (p: Project) => { setProject(p); setTab('editor'); };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">◉</span> Scientific Motion Studio</div>
        {project && <div className="proj-name">{project.name}</div>}
      </header>
      {saveError && <p className="toast error">No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.</p>}
      <main>
        {tab === 'crear' && <CreateView onCreate={(p) => { saveProject(p); open(p); }} />}
        {tab === 'editor' && (project ? <EditorView project={project} onChange={update} /> : (
          <div className="view"><section className="card"><p>No hay proyecto abierto.</p><button className="btn primary" onClick={() => setTab('crear')}>Crear uno</button></section></div>
        ))}
        {tab === 'biblioteca' && <LibraryView project={project} onChange={update} />}
        {tab === 'proyectos' && <ProjectsView currentId={project?.id} onOpen={open} />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
