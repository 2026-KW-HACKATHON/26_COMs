import type { Capsule, NewCapsule } from '../types/capsule';
import { supabase } from './supabase';
import { uuid } from './uuid';

// 서버 저장소 (Supabase). 로그인 화면 없이 처음 저장할 때 익명 계정을 만들고,
// 행 보안 정책(RLS)으로 본인 기록만 읽고 쓸 수 있다. 테이블·버킷은 supabase/schema.sql 참고.
const TABLE = 'capsules';
const BUCKET = 'capsules';
/** 영상·썸네일 서명 URL 유효 시간(초). 목록·상세 화면에 들어올 때마다 새로 받는다. */
const SIGNED_URL_SECONDS = 60 * 60;

const EXTENSION: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

interface CapsuleRow {
  id: string;
  place_id: string;
  place_name: string;
  lat: number;
  lng: number;
  video_path: string;
  thumbnail_path: string | null;
  clip_start: number;
  clip_duration: number;
  created_at: string;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await client().auth.getSession();
  return data.session?.user.id ?? null;
}

/** 둘러보기만 하는 방문자는 계정을 만들지 않고, 처음 저장할 때 익명 계정을 만든다. */
async function ensureUserId(): Promise<string> {
  const id = await currentUserId();
  if (id) return id;
  const { data, error } = await client().auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('anonymous sign-in failed');
  return data.user.id;
}

/** 'video/webm;codecs=vp9,opus' → 'video/webm'. 형식을 모르면 휴대폰 영상에 가장 흔한 mp4로 본다. */
function baseType(blob: Blob, fallback: string) {
  return blob.type.split(';')[0].trim() || fallback;
}

async function upload(path: string, blob: Blob, contentType: string) {
  const { error } = await client().storage.from(BUCKET).upload(path, blob, { contentType });
  if (error) throw error;
}

async function removeFiles(paths: (string | null)[]) {
  const existing = paths.filter((p): p is string => !!p);
  await client().storage.from(BUCKET).remove(existing).catch(() => undefined);
}

async function toCapsules(rows: CapsuleRow[]): Promise<Capsule[]> {
  const paths = rows.flatMap((r) => (r.thumbnail_path ? [r.video_path, r.thumbnail_path] : [r.video_path]));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await client().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;
    for (const d of data) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    placeName: r.place_name,
    lat: r.lat,
    lng: r.lng,
    video: urls.get(r.video_path) ?? '',
    clipStart: r.clip_start,
    clipDuration: r.clip_duration,
    thumbnail: (r.thumbnail_path && urls.get(r.thumbnail_path)) || null,
    createdAt: Date.parse(r.created_at),
  }));
}

/** 새 기록 저장: 영상·썸네일을 Storage에 올린 뒤 테이블에 행을 추가한다. */
export async function addCapsule(data: NewCapsule): Promise<Capsule> {
  const owner = await ensureUserId();
  const id = uuid();
  const videoType = baseType(data.video, 'video/mp4');
  // Storage 정책이 첫 폴더 이름을 사용자 id와 비교한다
  const videoPath = `${owner}/${id}.${EXTENSION[videoType] ?? 'mp4'}`;
  const thumbnailPath = data.thumbnail ? `${owner}/${id}.jpg` : null;
  try {
    await upload(videoPath, data.video, videoType);
    if (data.thumbnail && thumbnailPath) await upload(thumbnailPath, data.thumbnail, 'image/jpeg');
    const { error } = await client().from(TABLE).insert({
      id,
      place_id: data.placeId,
      place_name: data.placeName,
      lat: data.lat,
      lng: data.lng,
      video_path: videoPath,
      thumbnail_path: thumbnailPath,
      clip_start: data.clipStart,
      clip_duration: data.clipDuration,
    });
    if (error) throw error;
  } catch (err) {
    // 기록이 저장되지 않았으면 먼저 올린 파일도 지운다
    await removeFiles([videoPath, thumbnailPath]);
    throw err;
  }
  return { ...data, id, createdAt: Date.now() };
}

export async function getCapsule(id: string): Promise<Capsule | undefined> {
  if (!(await currentUserId())) return undefined;
  const { data, error } = await client().from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const [capsule] = await toCapsules([data as CapsuleRow]);
  return capsule;
}

export async function listCapsules(): Promise<Capsule[]> {
  if (!(await currentUserId())) return [];
  const { data, error } = await client().from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return toCapsules(data as CapsuleRow[]);
}

export async function deleteCapsule(id: string): Promise<void> {
  const { data, error } = await client().from(TABLE).delete().eq('id', id).select('video_path, thumbnail_path').maybeSingle();
  if (error) throw error;
  const row = data as Pick<CapsuleRow, 'video_path' | 'thumbnail_path'> | null;
  if (row) await removeFiles([row.video_path, row.thumbnail_path]);
}
