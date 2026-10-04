import type { FriendStatus, Profile, ProfileWithStatus } from '../types/social';
import { isUuid, supabase } from './supabase';

// 계정·친구 기능 (Supabase 설정이 있을 때만). 정책은 supabase/schema.sql 참고.

export type LoginProvider = 'kakao' | 'google';

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface ProfileWithStatusRow extends ProfileRow {
  status: FriendStatus;
}

export const PROFILE_COLUMNS = 'id, username, display_name, avatar_url';

/** 아이디 규칙 (schema.sql의 profiles.username 검사와 같다) */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    // 카카오 프로필 사진은 http 주소로 올 때가 있어 https로 바꾼다
    avatarUrl: row.avatar_url?.replace(/^http:\/\//, 'https://') ?? null,
  };
}

const toProfileWithStatus = (row: ProfileWithStatusRow): ProfileWithStatus => ({ ...toProfile(row), status: row.status });

/** 다른 앱 주소로 튕겨 나가지 않도록 앱 안의 경로만 허용한다 */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}

/**
 * 카카오에 요청할 동의항목. Supabase는 기본으로 이메일(account_email)까지 요청하는데,
 * 이메일 동의항목은 비즈 앱에서만 켤 수 있어서 일반 앱이면 KOE205 오류가 난다.
 * 비즈 앱으로 전환해 이메일을 켰다면 ',account_email'을 붙인다 (README 로그인 설정 참고).
 */
const KAKAO_SCOPE = 'profile_nickname,profile_image';

/** 카카오톡 안의 브라우저. 구글은 이런 내장 브라우저에서 로그인을 막는다(403 disallowed_useragent) */
export const isKakaoInAppBrowser = () => /KAKAOTALK/i.test(navigator.userAgent);

/** 소셜 로그인 화면으로 이동. 돌아오면 로그인 페이지가 세션을 확인하고 next로 보낸다. */
export async function signInWith(provider: LoginProvider, next: string) {
  const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(safeNextPath(next))}`;
  const { error } = await client().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // 구글: 여러 계정을 쓰는 기기에서 계정을 고를 수 있게
      queryParams: provider === 'google' ? { prompt: 'select_account' } : { scope: KAKAO_SCOPE },
    },
  });
  if (error) throw error;
}

/** 이 기기에서만 로그아웃 (다른 기기의 로그인은 유지) */
export async function signOut() {
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** 가입할 때 자동으로 정해진 아이디 (이메일이 없는 카카오 계정 등). 친구가 찾기 어려워 바꾸도록 안내한다 */
export const isAutoUsername = (username: string) => /^user(_[0-9a-f]{6,12})?$/.test(username);

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as ProfileRow) : null;
}

export class UsernameTakenError extends Error {}

export async function updateMyProfile(id: string, changes: { username: string; displayName: string }): Promise<Profile> {
  const { data, error } = await client()
    .from('profiles')
    .update({ username: changes.username, display_name: changes.displayName })
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  // 23505: unique 위반 (이미 쓰고 있는 아이디)
  if (error?.code === '23505') throw new UsernameTakenError();
  if (error) throw error;
  return toProfile(data as ProfileRow);
}

/** 아이디 앞부분 또는 이름 일부로 검색. 2글자 미만이면 빈 목록 */
export async function searchProfiles(query: string): Promise<ProfileWithStatus[]> {
  if (query.trim().replace(/^@/, '').length < 2) return [];
  const { data, error } = await client().rpc('search_profiles', { q: query });
  if (error) throw error;
  return (data as ProfileWithStatusRow[]).map(toProfileWithStatus);
}

/** 친구·받은 요청·보낸 요청 (최근 순) */
export async function listFriendships(): Promise<ProfileWithStatus[]> {
  const { data, error } = await client().rpc('list_friendships');
  if (error) throw error;
  return (data as ProfileWithStatusRow[]).map(toProfileWithStatus);
}

/** 친구 요청. 상대가 이미 요청했다면 수락된다. */
export async function requestFriend(id: string): Promise<FriendStatus> {
  const { data, error } = await client().rpc('request_friend', { target: id });
  if (error) throw error;
  return data as FriendStatus;
}

/** 친구 끊기·요청 취소·요청 거절 */
export async function removeFriend(id: string): Promise<void> {
  const { error } = await client().rpc('remove_friend', { target: id });
  if (error) throw error;
}

/** 친구가 나를 태그한 기록에서 내 태그를 뺀다 */
export async function removeMyTag(capsuleId: string, myId: string): Promise<void> {
  if (!isUuid(capsuleId)) return;
  const { error } = await client().from('capsule_tags').delete().eq('capsule_id', capsuleId).eq('user_id', myId);
  if (error) throw error;
}
