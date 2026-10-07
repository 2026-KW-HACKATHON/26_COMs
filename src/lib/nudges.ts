import type { Nudge } from '../types/social';
import { sendNudgePush } from './push';
import { PROFILE_COLUMNS, toProfile, type ProfileRow } from './social';
import { isUuid, supabase } from './supabase';

// 조르기: 같은 영상에 함께 나온(같이 간) 친구에게 "여기 또 가자" 알림.
// 누가 누구에게 보낼 수 있는지는 supabase/schema.sql의 nudge_friend가 정한다.

const NUDGE_SELECT = `id, capsule_id, place_id, place_name, created_at, read_at, sender:profiles!nudges_sender_id_fkey(${PROFILE_COLUMNS})`;

interface NudgeRow {
  id: string;
  capsule_id: string | null;
  place_id: string;
  place_name: string;
  created_at: string;
  read_at: string | null;
  sender: ProfileRow | null;
}

const toNudge = (r: NudgeRow): Nudge => ({
  id: r.id,
  sender: r.sender ? toProfile(r.sender) : null,
  capsuleId: r.capsule_id,
  placeId: r.place_id,
  placeName: r.place_name,
  createdAt: new Date(r.created_at).getTime(),
  read: !!r.read_at,
});

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** 같은 친구에게 같은 가게로는 10분에 한 번만 조를 수 있다 */
export class NudgeCooldownError extends Error {}

/** 같이 간 친구에게 조르기. 친구가 폰 알림을 켰다면 폰으로도 간다 */
export async function nudgeFriend(capsuleId: string, friendId: string): Promise<void> {
  const { data, error } = await client().rpc('nudge_friend', { capsule: capsuleId, target: friendId });
  if (error?.message.includes('nudge cooldown')) throw new NudgeCooldownError();
  if (error) throw error;
  void sendNudgePush(data as string);
}

/** 내가 받은 조르기 (최근 50개) */
export async function listNudges(me: string): Promise<Nudge[]> {
  const { data, error } = await client()
    .from('nudges')
    .select(NUDGE_SELECT)
    .eq('receiver_id', me)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as unknown as NudgeRow[]).map(toNudge);
}

export async function getNudge(id: string): Promise<Nudge | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await client().from('nudges').select(NUDGE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toNudge(data as unknown as NudgeRow) : null;
}

export async function countUnreadNudges(me: string): Promise<number> {
  const { count, error } = await client()
    .from('nudges')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', me)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNudgesRead(me: string): Promise<void> {
  const { error } = await client()
    .from('nudges')
    .update({ read_at: new Date().toISOString() })
    .eq('receiver_id', me)
    .is('read_at', null);
  if (error) throw error;
}
