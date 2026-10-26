import type { Project } from '../engine/types';

const KEY = 'sms.projects.v1';

function readAll(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Project[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // almacenamiento lleno o bloqueado (modo incógnito)
  }
}

export const listProjects = () => readAll().sort((a, b) => b.updatedAt - a.updatedAt);

export function saveProject(p: Project) {
  const list = readAll().filter((x) => x.id !== p.id);
  list.push(p);
  return writeAll(list);
}

export function deleteProject(id: string) {
  writeAll(readAll().filter((x) => x.id !== id));
}

/** Copia de seguridad: el proyecto como archivo .json que se puede volver a abrir. */
export function projectToFile(p: Project) {
  return new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
}

export async function projectFromFile(f: File): Promise<Project> {
  const p = JSON.parse(await f.text()) as Project;
  if (p.version !== 1 || !Array.isArray(p.scenes)) throw new Error('El archivo no es un proyecto de Scientific Motion Studio.');
  return p;
}
