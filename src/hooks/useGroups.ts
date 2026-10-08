import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { listGroups } from '../lib/groups';
import type { Group } from '../types/group';
import { useAuth } from './useAuth';

// 아래 탭의 초대 배지와 그룹 화면이 같은 목록을 보도록 화면 밖에 하나만 둔다
let state: { me: string; list: Group[] } | null = null;
let latest = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function load(me: string) {
  const request = ++latest;
  try {
    const list = await listGroups(me);
    if (request !== latest) return;
    state = { me, list };
  } catch (err) {
    console.error(err);
    if (request !== latest || state?.me === me) return;
    state = { me, list: [] };
  }
  listeners.forEach((l) => l());
}

const NONE: Group[] = [];

/**
 * 내 그룹과 받은 초대 (최근 만든 그룹부터). 처음 불러오는 중에는 null, 로그인 전이면 빈 목록.
 * 이 훅을 쓰는 화면이 열릴 때마다 새로 받고, reload() 중에는 이전 목록을 그대로 보여 준다.
 */
export function useGroups() {
  const me = useAuth().session?.user.id ?? '';
  const snapshot = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (SOCIAL_ENABLED && me) void load(me);
  }, [me]);

  const reload = useCallback(() => (SOCIAL_ENABLED && me ? load(me) : Promise.resolve()), [me]);
  const list = !SOCIAL_ENABLED || !me ? NONE : snapshot?.me === me ? snapshot.list : null;
  return { list, reload };
}
