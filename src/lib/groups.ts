import { getPlace } from '../data/places';
import type { Group, GroupMember, GroupMemberStatus, GroupVisit } from '../types/group';
import { toProfile } from './social';
import { isUuid, supabase } from './supabase';

// 그룹: 친구를 초대해서 만들고, 그룹원들의 가게 방문을 한 지도에 모아 가게마다 가장 많이 간 사람의 땅으로 칠한다.
// 누가 무엇을 할 수 있는지는 supabase/schema.sql의 그룹 RPC가 정한다.

/** 한 그룹 인원 (초대 중 포함). schema.sql의 group_members.color 범위(0~7)·GROUP_COLORS 개수와 같다 */
export const GROUP_MAX = 8;
/** 그룹 이름 길이 (schema.sql의 groups.name 검사와 같다) */
export const GROUP_NAME_MAX = 20;

export const MEDALS = ['🥇', '🥈', '🥉'];

/** 그룹에 들어갈 때 알려 주는 공개 범위 (schema.sql의 group_map) */
export const GROUP_SHARING_NOTE = '그룹원에게는 내가 다녀간 가게와 횟수만 보이고, 영상과 날짜는 보이지 않아요.';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** 그룹 색이 모자라서(8명) 더 초대할 수 없다 */
export class GroupFullError extends Error {}

interface GroupRow {
  group_id: string;
  name: string;
  created_at: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: GroupMemberStatus;
  color: number;
  invited_by: string | null;
}

/** 내 그룹과 받은 초대 (최근 만든 그룹부터) */
export async function listGroups(me: string): Promise<Group[]> {
  const { data, error } = await client().rpc('list_groups');
  if (error) throw error;
  const groups = new Map<string, Group>();
  for (const r of data as GroupRow[]) {
    const group = groups.get(r.group_id) ?? { id: r.group_id, name: r.name, createdAt: Date.parse(r.created_at), members: [], myStatus: 'invited' };
    const profile = toProfile({ id: r.user_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url });
    const member: GroupMember = { ...profile, status: r.status, color: r.color, invitedBy: r.invited_by };
    group.members.push(member);
    if (r.user_id === me) group.myStatus = r.status;
    groups.set(r.group_id, group);
  }
  return [...groups.values()];
}

const rethrow = (error: { message: string } | null) => {
  if (error?.message.includes('group is full')) throw new GroupFullError();
  if (error) throw error;
};

/** 그룹을 만들고 친구들을 초대한다. 만든 그룹 id */
export async function createGroup(name: string, inviteeIds: string[]): Promise<string> {
  const { data, error } = await client().rpc('create_group', { group_name: name.trim(), invitees: inviteeIds.filter(isUuid) });
  rethrow(error);
  return data as string;
}

/** 친구를 더 초대한다 (그룹원만). 초대한 사람 수 */
export async function inviteToGroup(groupId: string, friendIds: string[]): Promise<number> {
  const { data, error } = await client().rpc('invite_to_group', { target_group: groupId, targets: friendIds.filter(isUuid) });
  rethrow(error);
  return data as number;
}

export async function acceptGroupInvite(groupId: string): Promise<void> {
  const { error } = await client().rpc('accept_group_invite', { target_group: groupId });
  if (error) throw error;
}

/** 그룹 나가기·초대 거절. 마지막 그룹원이 나가면 그룹이 지워진다 */
export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await client().rpc('leave_group', { target_group: groupId });
  if (error) throw error;
}

/** 아직 수락하지 않은 초대 취소 */
export async function cancelGroupInvite(groupId: string, userId: string): Promise<void> {
  const { error } = await client().rpc('cancel_group_invite', { target_group: groupId, target: userId });
  if (error) throw error;
}

/** 그룹 지도: 그룹원별 가게 방문 수와 땅 주인 (그룹원만 받는다) */
export async function getGroupMap(groupId: string): Promise<GroupVisit[]> {
  if (!isUuid(groupId)) return [];
  const { data, error } = await client().rpc('group_map', { target_group: groupId });
  if (error) throw error;
  type Row = { place_id: string; user_id: string; visits: number; owner: boolean };
  return (data as Row[]).map((r) => ({ placeId: r.place_id, userId: r.user_id, visits: r.visits, owner: r.owner }));
}

export interface Standing {
  member: GroupMember;
  /** 차지한 땅(가게) 수 */
  places: number;
  /** 모든 가게에 간 횟수 */
  visits: number;
  /** 땅 수와 방문 수가 같으면 같은 순위 */
  rank: number;
}

export interface Territory {
  /** 가게별 땅 주인과 그의 방문 수 */
  owners: Map<string, { userId: string; visits: number }>;
  /** 가게별 그룹원 방문 (많은 순, 주인이 먼저) */
  byPlace: Map<string, GroupVisit[]>;
  /** 그룹원 순위 (땅 많은 순, 같으면 방문 많은 순) */
  standings: Standing[];
}

/** 그룹 지도 결과로 땅 주인과 그룹원 순위를 정한다 (앱의 가게 목록에 있는 곳만) */
export function computeTerritory(visits: GroupVisit[], members: GroupMember[]): Territory {
  const owners = new Map<string, { userId: string; visits: number }>();
  const byPlace = new Map<string, GroupVisit[]>();
  const totals = new Map<string, { places: number; visits: number }>();
  for (const v of visits) {
    if (!getPlace(v.placeId)) continue;
    byPlace.set(v.placeId, [...(byPlace.get(v.placeId) ?? []), v]);
    const t = totals.get(v.userId) ?? { places: 0, visits: 0 };
    t.visits += v.visits;
    if (v.owner) {
      t.places += 1;
      owners.set(v.placeId, { userId: v.userId, visits: v.visits });
    }
    totals.set(v.userId, t);
  }
  for (const list of byPlace.values()) list.sort((a, b) => Number(b.owner) - Number(a.owner) || b.visits - a.visits);

  const standings: Standing[] = [];
  members
    .filter((m) => m.status === 'member')
    .map((member) => ({ member, places: totals.get(member.id)?.places ?? 0, visits: totals.get(member.id)?.visits ?? 0 }))
    .sort((a, b) => b.places - a.places || b.visits - a.visits || a.member.color - b.member.color)
    .forEach((s) => {
      const prev = standings[standings.length - 1];
      const tie = prev && prev.places === s.places && prev.visits === s.visits;
      standings.push({ ...s, rank: tie ? prev.rank : standings.length + 1 });
    });
  return { owners, byPlace, standings };
}

/** 지도 말풍선에 넣을 그룹원 표시: 이름 첫 글자 (이모지도 한 글자로) */
export const memberBadge = (m: Pick<GroupMember, 'displayName'>) => Array.from(m.displayName.trim())[0] ?? '?';
