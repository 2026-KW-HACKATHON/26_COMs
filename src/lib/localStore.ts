import type { Capsule, NewCapsule } from '../types/capsule';
import { uuid } from './uuid';

// 기기 저장소: 영상 기록을 이 브라우저의 IndexedDB에 저장한다 (Supabase 설정이 없을 때).
const DB_NAME = 'memory-capsule';
const DB_VERSION = 2;
const STORE = 'capsules';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        // v1(봉인 캡슐) 데이터는 구조가 달라서 새로 만든다
        if (req.result.objectStoreNames.contains(STORE)) req.result.deleteObjectStore(STORE);
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** 새 기록 저장. id와 생성 시각은 여기서 채운다. */
export async function addCapsule(data: NewCapsule): Promise<Capsule> {
  const capsule: Capsule = { ...data, id: uuid(), createdAt: Date.now() };
  await run('readwrite', (s) => s.put(capsule));
  return capsule;
}

export function getCapsule(id: string): Promise<Capsule | undefined> {
  return run<Capsule | undefined>('readonly', (s) => s.get(id));
}

export async function listCapsules(): Promise<Capsule[]> {
  const list = await run<Capsule[]>('readonly', (s) => s.getAll());
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteCapsule(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}
