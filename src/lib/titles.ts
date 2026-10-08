import { getPlace } from '../data/places';
import { supabase } from './supabase';
import type { MyPlaceVisit } from './visits';

// 칭호: 한 가게에 간 횟수로 얻는 "가게 이름 + 등급" (예: 행복분식 골드). 프로필 이름 오른쪽에 붙고,
// 나와 친구끼리만 서로의 칭호를 본다 (supabase/schema.sql의 friend_titles).
// 방문은 동네 지도·그룹 지도와 같은 기준: 영상에 나온(작성자·태그) 날 수라서 같은 날 여러 개를 남겨도 한 번이다.

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Tier {
  id: TierId;
  name: string;
  /** 이 등급이 되는 방문 수 */
  min: number;
}

/** 낮은 등급부터. 첫 등급(브론즈)의 횟수는 schema.sql의 friend_titles가 돌려주는 최소 방문 수와 같다 */
export const TIERS: Tier[] = [
  { id: 'bronze', name: '브론즈', min: 5 },
  { id: 'silver', name: '실버', min: 10 },
  { id: 'gold', name: '골드', min: 20 },
  { id: 'platinum', name: '플래티넘', min: 30 },
  { id: 'diamond', name: '다이아몬드', min: 50 },
];

export const tierOf = (visits: number): Tier | null => [...TIERS].reverse().find((t) => visits >= t.min) ?? null;
export const nextTierOf = (visits: number): Tier | null => TIERS.find((t) => visits < t.min) ?? null;

export interface Title {
  placeId: string;
  placeName: string;
  visits: number;
  tier: Tier;
}

/** 앱의 가게 목록에 있는 가게만 칭호가 된다 (기록의 가게 이름은 사용자가 보낸 값이라 쓰지 않는다) */
function toTitle(placeId: string, visits: number): Title | null {
  const place = getPlace(placeId);
  const tier = tierOf(visits);
  return place && tier ? { placeId, placeName: place.name, visits, tier } : null;
}

export const titleLabel = (title: Title) => `${title.placeName} ${title.tier.name}`;

/** 내 칭호 모두 (대표 칭호부터: 많이 간 순, 같으면 그 횟수에 먼저 닿은 가게. friend_titles의 pos와 같은 순서) */
export function myTitles(visits: Map<string, MyPlaceVisit>): Title[] {
  return [...visits.values()]
    .sort((a, b) => b.days - a.days || a.reachedAt - b.reachedAt || (a.placeId < b.placeId ? -1 : 1))
    .flatMap((v) => toTitle(v.placeId, v.days) ?? []);
}

export interface TitleGoal {
  placeName: string;
  /** 다음 등급까지 남은 방문 수 */
  left: number;
  tier: Tier;
}

/** 다음 등급에 가장 가까운 가게 (다이아몬드까지 다 따면 null) */
export function nextGoal(visits: Map<string, MyPlaceVisit>): TitleGoal | null {
  let best: TitleGoal | null = null;
  for (const v of visits.values()) {
    const tier = nextTierOf(v.days);
    const place = getPlace(v.placeId);
    if (!tier || !place) continue;
    const left = tier.min - v.days;
    if (!best || left < best.left) best = { placeName: place.name, left, tier };
  }
  return best;
}

/** 나와 친구들의 대표 칭호 (사람 id → 칭호). 칭호가 없는 사람은 빠진다 */
export async function listFriendTitles(): Promise<Map<string, Title>> {
  if (!supabase) return new Map();
  const { data, error } = await supabase.rpc('friend_titles');
  if (error) throw error;
  type Row = { user_id: string; place_id: string; visits: number; pos: number };
  const titles = new Map<string, Title>();
  // 사람마다 대표 칭호 순서(pos)대로 와서, 앱의 가게 목록에 있는 첫 가게를 고른다
  for (const r of [...(data as Row[])].sort((a, b) => a.pos - b.pos)) {
    if (titles.has(r.user_id)) continue;
    const title = toTitle(r.place_id, r.visits);
    if (title) titles.set(r.user_id, title);
  }
  return titles;
}
