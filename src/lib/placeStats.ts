/** 가게별 방문 수 (기준은 supabase/schema.sql의 place_ranking과 같다) */
export interface PlaceStat {
  placeId: string;
  /** 방문 = 영상에 나온 사람(작성자·태그된 친구) × 날짜. 같은 사람이 같은 날 여러 개 남겨도 한 번 */
  visits: number;
  /** 다녀간 사람 수 */
  people: number;
  /** 다른 날 두 번 이상 온 사람 수 */
  regulars: number;
  videos: number;
  /** 그중 현장 인증된 영상이 있는 방문 */
  verifiedVisits: number;
}

/** 집계 기간: 오늘 포함 최근 며칠, null이면 전체 */
export type StatDays = number | null;
/** 동네 지도는 최근 30일 방문으로 칠한다 */
export const TOWN_DAYS = 30;
export const TOWN_PERIOD_LABEL = '최근 30일';

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
/** 한국 시간 기준 날짜 번호 */
export const kstDay = (ms: number) => Math.floor((ms + KST_OFFSET_MS) / DAY_MS);

interface Visit {
  placeId: string;
  createdAt: number;
  /** 영상에 나온 사람 id (작성자와 태그된 친구) */
  people: string[];
  verified: boolean;
}

/** 기기 저장(서버 없음)에서 place_ranking과 같은 계산을 한다 (방문 많은 순) */
export function computePlaceStats(visits: Visit[], days: StatDays, now = Date.now()): PlaceStat[] {
  const from = days === null ? -Infinity : kstDay(now) - days + 1;
  const byPlace = new Map<string, { videos: number; last: number; days: Map<string, Set<number>>; verifiedDays: Map<string, Set<number>> }>();
  for (const v of visits) {
    const day = kstDay(v.createdAt);
    if (day < from) continue;
    const s = byPlace.get(v.placeId) ?? { videos: 0, last: 0, days: new Map<string, Set<number>>(), verifiedDays: new Map<string, Set<number>>() };
    s.videos += 1;
    s.last = Math.max(s.last, v.createdAt);
    for (const person of new Set(v.people)) {
      const set = s.days.get(person) ?? new Set<number>();
      set.add(day);
      s.days.set(person, set);
      if (v.verified) {
        const verified = s.verifiedDays.get(person) ?? new Set<number>();
        verified.add(day);
        s.verifiedDays.set(person, verified);
      }
    }
    byPlace.set(v.placeId, s);
  }
  return [...byPlace]
    .map(([placeId, s]) => {
      const perPerson = [...s.days.values()].map((d) => d.size);
      return {
        stat: {
          placeId,
          visits: perPerson.reduce((a, b) => a + b, 0),
          people: perPerson.length,
          regulars: perPerson.filter((n) => n >= 2).length,
          videos: s.videos,
          verifiedVisits: [...s.verifiedDays.values()].reduce((a, d) => a + d.size, 0),
        },
        last: s.last,
      };
    })
    .sort((a, b) => b.stat.visits - a.stat.visits || b.stat.people - a.stat.people || b.last - a.last)
    .map((x) => x.stat);
}
