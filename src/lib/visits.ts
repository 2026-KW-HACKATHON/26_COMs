import { PLACES, getPlace } from '../data/places';
import type { Capsule } from '../types/capsule';
import { kstDay } from './placeStats';

/** 다른 날 이만큼 가면 단골 (동네 지도의 단골과 같은 기준) */
export const REGULAR_DAYS = 2;
/** 마지막으로 간 지 이만큼 지나면 "오랜만이에요" */
export const DUE_DAYS = 30;

/** 내가 한 가게에 다녀온 기록 (내가 남겼거나 태그된 영상 기준) */
export interface MyPlaceVisit {
  placeId: string;
  /** 다녀온 날 수 (같은 날 여러 개를 남겨도 하루) */
  days: number;
  lastAt: number;
  /** 마지막으로 간 뒤 지난 날 수 (한국 날짜) */
  daysSince: number;
  regular: boolean;
  due: boolean;
}

/** 내 지도의 기록으로 가게별 방문을 센다 (앱의 가게 목록에 있는 곳만) */
export function myPlaceVisits(capsules: Capsule[], now = Date.now()): Map<string, MyPlaceVisit> {
  const byPlace = new Map<string, { days: Set<number>; lastAt: number }>();
  for (const c of capsules) {
    if (!getPlace(c.placeId)) continue;
    const v = byPlace.get(c.placeId) ?? { days: new Set<number>(), lastAt: 0 };
    v.days.add(kstDay(c.createdAt));
    v.lastAt = Math.max(v.lastAt, c.createdAt);
    byPlace.set(c.placeId, v);
  }
  const today = kstDay(now);
  return new Map(
    [...byPlace].map(([placeId, v]) => {
      const daysSince = today - kstDay(v.lastAt);
      return [placeId, { placeId, days: v.days.size, lastAt: v.lastAt, daysSince, regular: v.days.size >= REGULAR_DAYS, due: daysSince >= DUE_DAYS }];
    }),
  );
}

export interface VisitSummary {
  visited: number;
  total: number;
  regulars: number;
  /** 오랜만인 곳 (오래 안 간 순) */
  due: MyPlaceVisit[];
}

export function summarizeVisits(visits: Map<string, MyPlaceVisit>): VisitSummary {
  const list = [...visits.values()];
  return {
    visited: list.length,
    total: PLACES.length,
    regulars: list.filter((v) => v.regular).length,
    due: list.filter((v) => v.due).sort((a, b) => a.lastAt - b.lastAt),
  };
}

/** "오늘" · "어제" · "12일 전" */
export function daysAgo(days: number) {
  return days <= 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`;
}
