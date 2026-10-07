import { useContext } from 'react';
import { NudgeContext } from '../lib/nudgeContext';

/** 받은 조르기 알림 상태 (안 읽은 수·새로 받은 조르기) */
export function useNudges() {
  return useContext(NudgeContext);
}
