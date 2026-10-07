import { useEffect, useState } from 'react';
import { listPlaceStats } from '../lib/capsuleStore';
import { rankPlaces, type RankedPlace, type RankingDays } from '../lib/ranking';

// 지도 ↔ 랭킹 화면을 오갈 때 바로 보이도록 마지막 결과를 기억해 두고, 화면을 열 때마다 새로 받는다
const cache = new Map<string, RankedPlace[]>();

/** 동네 랭킹 (순위순). 처음 불러오는 중에는 null */
export function usePlaceRanking(days: RankingDays) {
  const key = String(days);
  const [loaded, setLoaded] = useState<{ key: string; list: RankedPlace[] } | null>(null);

  useEffect(() => {
    let alive = true;
    listPlaceStats(days)
      .then((stats) => {
        const list = rankPlaces(stats);
        cache.set(key, list);
        if (alive) setLoaded({ key, list });
      })
      .catch((err) => {
        console.error(err);
        if (alive) setLoaded({ key, list: cache.get(key) ?? [] });
      });
    return () => {
      alive = false;
    };
  }, [days, key]);

  return loaded?.key === key ? loaded.list : (cache.get(key) ?? null);
}
