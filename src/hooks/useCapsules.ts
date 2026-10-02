import { useEffect, useState } from 'react';
import { listCapsules } from '../lib/capsuleStore';
import type { Capsule } from '../types/capsule';
import { useAuth } from './useAuth';

/**
 * 한 사람의 지도에 올라갈 영상 기록 (최신순). ownerId를 생략하면 내 지도.
 * 불러오는 중에는 null. 로그인 상태가 바뀌면 다시 불러온다.
 */
export function useCapsules(ownerId?: string) {
  const { session, loading: authLoading } = useAuth();
  const key = `${session?.user.id ?? ''}|${ownerId ?? ''}`;
  const [loaded, setLoaded] = useState<{ key: string; list: Capsule[] } | null>(null);

  useEffect(() => {
    // 저장된 로그인을 확인한 뒤에 한 번만 불러온다
    if (authLoading) return;
    let alive = true;
    listCapsules(ownerId)
      .then((list) => alive && setLoaded({ key, list }))
      .catch((err) => {
        console.error(err);
        if (alive) setLoaded({ key, list: [] });
      });
    return () => {
      alive = false;
    };
  }, [ownerId, key, authLoading]);

  return !authLoading && loaded?.key === key ? loaded.list : null;
}
