import { useCallback, useEffect, useState } from 'react';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { listFriendships } from '../lib/social';
import type { ProfileWithStatus } from '../types/social';
import { useAuth } from './useAuth';

/**
 * 내 친구·받은 요청·보낸 요청. 처음 불러오는 중에는 null, 로그인 전이면 빈 목록.
 * reload() 중에는 이전 목록을 그대로 보여 준다.
 */
export function useFriendships() {
  const me = useAuth().session?.user.id ?? '';
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ me: string; list: ProfileWithStatus[] } | null>(null);

  useEffect(() => {
    if (!SOCIAL_ENABLED || !me) return;
    let alive = true;
    listFriendships()
      .then((list) => alive && setLoaded({ me, list }))
      .catch((err) => {
        console.error(err);
        if (alive) setLoaded({ me, list: [] });
      });
    return () => {
      alive = false;
    };
  }, [me, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const list = !SOCIAL_ENABLED || !me ? [] : loaded?.me === me ? loaded.list : null;
  return { list, reload };
}
