import { getPlace, type Place } from '../data/places';

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
}

export interface RankedPlace extends PlaceStat {
  place: Place;
  /** 방문 수와 사람 수가 같으면 같은 순위 */
  rank: number;
}

/** 랭킹 기간. 지도·홈 카드는 첫 번째(최근 30일)를 쓴다 */
export const RANKING_PERIODS = [
  { days: 30, label: '최근 30일' },
  { days: null, label: '전체' },
] as const;
export type RankingDays = (typeof RANKING_PERIODS)[number]['days'];
export const DEFAULT_RANKING_DAYS: RankingDays = RANKING_PERIODS[0].days;

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
/** 한국 시간 기준 날짜 번호 */
const kstDay = (ms: number) => Math.floor((ms + KST_OFFSET_MS) / DAY_MS);

interface Visit {
  placeId: string;
  createdAt: number;
  /** 영상에 나온 사람 id (작성자와 태그된 친구) */
  people: string[];
}

/** 기기 저장(서버 없음)에서 place_ranking과 같은 계산을 한다. days: 오늘 포함 최근 며칠, null이면 전체 */
export function computePlaceStats(visits: Visit[], days: RankingDays, now = Date.now()): PlaceStat[] {
  const from = days === null ? -Infinity : kstDay(now) - days + 1;
  const byPlace = new Map<string, { videos: number; last: number; days: Map<string, Set<number>> }>();
  for (const v of visits) {
    const day = kstDay(v.createdAt);
    if (day < from) continue;
    const s = byPlace.get(v.placeId) ?? { videos: 0, last: 0, days: new Map<string, Set<number>>() };
    s.videos += 1;
    s.last = Math.max(s.last, v.createdAt);
    for (const person of new Set(v.people)) {
      const set = s.days.get(person) ?? new Set<number>();
      set.add(day);
      s.days.set(person, set);
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
        },
        last: s.last,
      };
    })
    .sort((a, b) => b.stat.visits - a.stat.visits || b.stat.people - a.stat.people || b.last - a.last)
    .map((x) => x.stat);
}

/** 앱의 가게 목록에 있는 곳만 남기고 순위를 매긴다 (stats는 순위 순서로 정렬되어 있다) */
export function rankPlaces(stats: PlaceStat[]): RankedPlace[] {
  const ranked: RankedPlace[] = [];
  for (const s of stats) {
    const place = getPlace(s.placeId);
    if (!place) continue;
    const prev = ranked[ranked.length - 1];
    const tie = prev && prev.visits === s.visits && prev.people === s.people;
    ranked.push({ ...s, place, rank: tie ? prev.rank : ranked.length + 1 });
  }
  return ranked;
}

export const MEDALS = ['🥇', '🥈', '🥉'];
