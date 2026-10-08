import { FEED_PAGE, type Capsule, type FeedQuery, type NewCapsule, type Visibility } from '../types/capsule';
import { computePlaceStats, type PlaceStat, type RankingDays } from './ranking';
import { uuid } from './uuid';

// 기기 저장소: Supabase 설정이 없을 때 로그인 없이 이 브라우저의 IndexedDB에 저장한다 (친구·태그 없음).
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

/** 계정 정보가 없던 예전 기록도 같은 모양으로 맞춘다 */
const normalize = (c: Capsule): Capsule => ({ ...c, userId: c.userId ?? '', author: c.author ?? null, tags: c.tags ?? [], visibility: 'friends', verified: !!c.verified });

/** 새 기록 저장. id와 생성 시각은 여기서 채운다. 태그는 기기 저장에서 쓰지 않는다. */
export async function addCapsule(data: NewCapsule): Promise<Capsule> {
  const capsule: Capsule = {
    id: uuid(),
    userId: '',
    author: null,
    tags: [],
    placeId: data.placeId,
    placeName: data.placeName,
    lat: data.lat,
    lng: data.lng,
    video: data.video,
    clipStart: data.clipStart,
    clipDuration: data.clipDuration,
    thumbnail: data.thumbnail,
    createdAt: Date.now(),
    // 기기 저장은 이 기기에서만 보여서 공개 범위가 없다
    visibility: 'friends',
    verified: false,
  };
  await run('readwrite', (s) => s.put(capsule));
  return capsule;
}

export async function getCapsule(id: string): Promise<Capsule | undefined> {
  const capsule = await run<Capsule | undefined>('readonly', (s) => s.get(id));
  return capsule && normalize(capsule);
}

/** 이 기기의 모든 기록 (최신순). 다른 사람 지도는 없어서 ownerId는 쓰지 않는다. */
export async function listCapsules(ownerId?: string): Promise<Capsule[]> {
  if (ownerId) return [];
  const list = await run<Capsule[]>('readonly', (s) => s.getAll());
  return list.map(normalize).sort((a, b) => b.createdAt - a.createdAt);
}

/** 피드 (기기 저장은 친구·동네가 없어서 이 기기의 기록만) */
export async function listFeed({ scope, before, limit = FEED_PAGE }: FeedQuery): Promise<Capsule[]> {
  if (scope === 'town') return [];
  const list = await listCapsules();
  return list.filter((c) => !before || c.createdAt < before).slice(0, limit);
}

export async function listPlaceCapsules(placeId: string, limit = 20): Promise<Capsule[]> {
  return (await listCapsules()).filter((c) => c.placeId === placeId).slice(0, limit);
}

/** 기기 저장은 이 기기에서만 보여서 공개 범위를 바꿀 것이 없다 */
export const setVisibility: (id: string, visibility: Visibility) => Promise<void> = async () => {};

export async function deleteCapsule(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

/** 동네 랭킹 (기기 저장은 이 기기의 기록만으로 센다) */
export async function listPlaceStats(days: RankingDays): Promise<PlaceStat[]> {
  const list = await listCapsules();
  return computePlaceStats(list.map((c) => ({ placeId: c.placeId, createdAt: c.createdAt, people: [c.userId], verified: c.verified })), days);
}
