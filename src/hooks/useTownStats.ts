import { useEffect, useState } from 'react';
import { getPlace } from '../data/places';
import { listPlaceStats } from '../lib/capsuleStore';
import { TOWN_DAYS, type PlaceStat } from '../lib/placeStats';

// 지도 ↔ 다른 화면을 오갈 때 바로 보이도록 마지막 결과를 기억해 두고, 화면을 열 때마다 새로 받는다
let cache: PlaceStat[] | null = null;

/** 동네 지도: 최근 30일 가게별 방문 수 (앱의 가게 목록에 있는 곳만, 방문 많은 순). 처음 불러오는 중에는 null */
export function useTownStats() {
  const [loaded, setLoaded] = useState<PlaceStat[] | null>(null);

  useEffect(() => {
    let alive = true;
    listPlaceStats(TOWN_DAYS)
      .then((stats) => {
        cache = stats.filter((s) => getPlace(s.placeId));
        if (alive) setLoaded(cache);
      })
      .catch((err) => {
        console.error(err);
        if (alive) setLoaded(cache ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  return loaded ?? cache;
}
