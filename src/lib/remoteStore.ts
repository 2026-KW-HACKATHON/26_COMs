import type { Capsule, NewCapsule } from '../types/capsule';
import { PROFILE_COLUMNS, listFriendships, toProfile, type ProfileRow } from './social';
import { isUuid, supabase } from './supabase';
import { uuid } from './uuid';

// 서버 저장소 (Supabase). 구글·카카오로 로그인한 계정에 기록이 쌓이고,
// 본인·친구·태그된 사람만 볼 수 있다 (행 보안 정책은 supabase/schema.sql).
const TABLE = 'capsules';
const BUCKET = 'capsules';
/**
 * 영상·썸네일 서명 URL 유효 시간(초). 목록·상세 화면에 들어올 때마다 새로 받는다.
 * 서명 URL은 친구를 끊어도 만료 전까지 쓸 수 있어서 짧게 둔다.
 */
const SIGNED_URL_SECONDS = 10 * 60;
/** 작성자(capsules.user_id → profiles)와 태그된 친구를 한 번에 불러온다 */
const CAPSULE_SELECT = `*, author:profiles!capsules_user_id_fkey(${PROFILE_COLUMNS}), capsule_tags(profile:profiles(${PROFILE_COLUMNS}))`;

const EXTENSION: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

interface CapsuleRow {
  id: string;
  user_id: string;
  place_id: string;
  place_name: string;
  lat: number;
  lng: number;
  video_path: string;
  thumbnail_path: string | null;
  clip_start: number;
  clip_duration: number;
  created_at: string;
  author: ProfileRow | null;
  capsule_tags: { profile: ProfileRow | null }[];
}

export class LoginRequiredError extends Error {}

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await client().auth.getSession();
  return data.session?.user.id ?? null;
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
    userId: r.user_id,
    author: r.author ? toProfile(r.author) : null,
    tags: r.capsule_tags.flatMap((t) => (t.profile ? [toProfile(t.profile)] : [])),
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

/** 새 기록 저장: 영상·썸네일을 Storage에 올리고, 기록과 친구 태그를 추가한다. */
export async function addCapsule(data: NewCapsule): Promise<Capsule> {
  const owner = await currentUserId();
  if (!owner) throw new LoginRequiredError();
  const id = uuid();
  const videoType = baseType(data.video, 'video/mp4');
  // Storage·기록 정책이 첫 폴더 이름을 작성자 id와 비교한다
  const videoPath = `${owner}/${id}.${EXTENSION[videoType] ?? 'mp4'}`;
  const thumbnailPath = data.thumbnail ? `${owner}/${id}.jpg` : null;
  const tagIds = [...new Set(data.tagIds)].filter((tagId) => isUuid(tagId) && tagId !== owner);
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
  await addTags(id, tagIds);
  return {
    id,
    userId: owner,
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
  };
}

/**
 * 친구 태그. 화면을 연 뒤 친구가 끊긴 사람은 정책상 태그할 수 없어서 빼고 붙인다.
 * 태그가 실패해도 이미 올린 영상 기록은 지킨다.
 */
async function addTags(capsuleId: string, tagIds: string[]) {
  if (!tagIds.length) return;
  const friends = await listFriendships().catch(() => null);
  const valid = friends ? tagIds.filter((tagId) => friends.some((f) => f.id === tagId && f.status === 'friend')) : tagIds;
  if (!valid.length) return;
  const { error } = await client().from('capsule_tags').insert(valid.map((userId) => ({ capsule_id: capsuleId, user_id: userId })));
  if (error) console.warn('친구 태그를 저장하지 못했어요', error);
}

export async function getCapsule(id: string): Promise<Capsule | undefined> {
  if (!isUuid(id) || !(await currentUserId())) return undefined;
  const { data, error } = await client().from(TABLE).select(CAPSULE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const [capsule] = await toCapsules([data as unknown as CapsuleRow]);
  return capsule;
}

/**
 * 한 사람의 지도에 올라갈 기록: 그 사람이 남긴 기록 + 그 사람이 태그된 기록 (최신순).
 * ownerId를 생략하면 내 지도. 내가 볼 수 없는 기록(친구가 아닌 사람 것)은 정책이 걸러낸다.
 */
export async function listCapsules(ownerId?: string): Promise<Capsule[]> {
  const me = await currentUserId();
  const target = ownerId ?? me;
  if (!me || !isUuid(target)) return [];
  const { data: tagged, error: tagError } = await client().from('capsule_tags').select('capsule_id').eq('user_id', target);
  if (tagError) throw tagError;
  const taggedIds = (tagged as { capsule_id: string }[]).map((t) => t.capsule_id).filter(isUuid);
  const filter = taggedIds.length ? `user_id.eq.${target},id.in.(${taggedIds.join(',')})` : `user_id.eq.${target}`;
  const { data, error } = await client().from(TABLE).select(CAPSULE_SELECT).or(filter).order('created_at', { ascending: false });
  if (error) throw error;
  return toCapsules(data as unknown as CapsuleRow[]);
}

/** 작성자만 지울 수 있다 (태그·파일도 함께 삭제) */
export async function deleteCapsule(id: string): Promise<void> {
  if (!isUuid(id)) return;
  const { data, error } = await client().from(TABLE).delete().eq('id', id).select('video_path, thumbnail_path').maybeSingle();
  if (error) throw error;
  const row = data as Pick<CapsuleRow, 'video_path' | 'thumbnail_path'> | null;
  if (row) await removeFiles([row.video_path, row.thumbnail_path]);
}
