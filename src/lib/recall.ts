import type { Capsule } from '../types/capsule';
import { kstDay } from './placeStats';

/** 회상: 이만큼 전 오늘 남긴 영상을 다시 보여 준다 (오래된 추억이 먼저). api/recall.ts의 폰 알림과 같은 목록 */
export const ANNIVERSARIES = [
  { days: 365, label: '1년 전' },
  { days: 100, label: '100일 전' },
  { days: 30, label: '한 달 전' },
  { days: 7, label: '일주일 전' },
];

export interface Recall {
  capsule: Capsule;
  label: string;
}

/** 내 지도의 기록(내가 남겼거나 태그된 영상) 중 오늘이 기념일인 가장 오래된 추억 하나 */
export function findRecall(capsules: Capsule[], now = Date.now()): Recall | null {
  const today = kstDay(now);
  for (const a of ANNIVERSARIES) {
    const capsule = capsules.find((c) => today - kstDay(c.createdAt) === a.days);
    if (capsule) return { capsule, label: a.label };
  }
  return null;
}
