import { useEffect, useState } from 'react';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { listFriendTitles, type Title } from '../lib/titles';
import { useAuth } from './useAuth';

// 로그인 전·기기 저장·불러오는 중에 돌려주는 빈 목록
const NONE: ReadonlyMap<string, Title> = new Map();

/** 나와 친구들의 대표 칭호 (사람 id → 칭호). 불러오기 전이거나 칭호가 없는 사람은 빠진다 */
export function useFriendTitles(): ReadonlyMap<string, Title> {
  const me = useAuth().session?.user.id ?? '';
  const [loaded, setLoaded] = useState<{ me: string; titles: ReadonlyMap<string, Title> } | null>(null);

  useEffect(() => {
    if (!SOCIAL_ENABLED || !me) return;
    let alive = true;
    listFriendTitles()
      .then((titles) => alive && setLoaded({ me, titles }))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [me]);

  return loaded?.me === me ? loaded.titles : NONE;
}
