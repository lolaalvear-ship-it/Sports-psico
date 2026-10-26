import type { AssetResolver } from '../engine/runtime';

/** Modelos GLB/GLTF importados por el usuario, guardados en IndexedDB del teléfono. */
export interface StoredModel { id: string; name: string; size: number; createdAt: number; data: ArrayBuffer }

const DB = 'sms-assets', STORE = 'models';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function importModel(file: File): Promise<StoredModel> {
  if (!/\.(glb|gltf)$/i.test(file.name)) throw new Error('Solo se aceptan archivos .glb o .gltf (con texturas incrustadas).');
  const m: StoredModel = { id: 'm' + Date.now().toString(36), name: file.name, size: file.size, createdAt: Date.now(), data: await file.arrayBuffer() };
  await tx('readwrite', (s) => s.put(m));
  return m;
}

export async function listModels(): Promise<Omit<StoredModel, 'data'>[]> {
  try {
    const all = await tx<StoredModel[]>('readonly', (s) => s.getAll() as IDBRequest<StoredModel[]>);
    return all.map(({ data: _data, ...rest }) => rest).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export const deleteModel = (id: string) => tx('readwrite', (s) => s.delete(id));

export const assets: AssetResolver = {
  async getModel(id) {
    try {
      const m = await tx<StoredModel | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredModel | undefined>);
      return m ? { name: m.name, data: m.data } : null;
    } catch {
      return null;
    }
  },
};
