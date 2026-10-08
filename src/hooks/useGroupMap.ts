import { useEffect, useState } from 'react';
import { getGroupMap } from '../lib/groups';
import type { GroupVisit } from '../types/group';

/**
 * 그룹 지도의 방문 수와 땅 주인. 처음 불러오는 중에는 null, 그룹원이 아니면 빈 목록.
 * version이 바뀌면(그룹원이 들어오거나 나감) 이전 지도를 보여 주면서 다시 불러온다
 */
export function useGroupMap(groupId: string | null, version = '') {
  const [loaded, setLoaded] = useState<{ groupId: string; list: GroupVisit[] } | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    getGroupMap(groupId)
      .then((list) => alive && setLoaded({ groupId, list }))
      .catch((err) => {
        console.error(err);
        if (alive) setLoaded((prev) => (prev?.groupId === groupId ? prev : { groupId, list: [] }));
      });
    return () => {
      alive = false;
    };
  }, [groupId, version]);

  return groupId && loaded?.groupId === groupId ? loaded.list : null;
}
