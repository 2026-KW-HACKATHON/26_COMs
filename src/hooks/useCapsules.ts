import { useEffect, useState } from 'react';
import { listCapsules } from '../lib/capsuleStore';
import type { Capsule } from '../types/capsule';

/** 저장된 영상 기록 목록 (최신순). 로딩 중에는 null. */
export function useCapsules() {
  const [capsules, setCapsules] = useState<Capsule[] | null>(null);

  useEffect(() => {
    let alive = true;
    listCapsules()
      .then((list) => alive && setCapsules(list))
      .catch(() => alive && setCapsules([]));
    return () => {
      alive = false;
    };
  }, []);

  return capsules;
}
