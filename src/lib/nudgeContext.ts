import { createContext } from 'react';
import type { Nudge } from '../types/social';

export interface NudgeState {
  /** 안 읽은 조르기 수 (헤더 벨 배지) */
  unread: number;
  /** 앱을 연 뒤 실시간으로 받은 가장 최근 조르기 (알림 목록이 이걸 보고 다시 불러온다) */
  latest: Nudge | null;
  /** 읽음 처리 뒤 안 읽은 수를 다시 센다 */
  refresh: () => void;
}

export const NudgeContext = createContext<NudgeState>({ unread: 0, latest: null, refresh: () => {} });
