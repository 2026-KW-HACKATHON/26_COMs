import { useContext } from 'react';
import { AuthContext } from '../lib/authContext';

/** 로그인 세션·내 프로필 (기기 저장 모드에서는 항상 로그아웃 상태) */
export function useAuth() {
  return useContext(AuthContext);
}
