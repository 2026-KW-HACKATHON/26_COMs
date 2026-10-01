import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';

interface RequireAuthProps {
  children: ReactNode;
  /** 계정이 있어야만 의미 있는 화면(친구·프로필). 기기 저장 모드에서는 홈으로 보낸다 */
  accountOnly?: boolean;
}

/** 로그인이 필요한 화면. 로그인하지 않았으면 로그인 화면을 거쳐 다시 돌아온다. */
export default function RequireAuth({ children, accountOnly = false }: RequireAuthProps) {
  const { loading, session } = useAuth();
  const location = useLocation();

  if (!SOCIAL_ENABLED) return accountOnly ? <Navigate to="/" replace /> : children;
  if (loading) return null;
  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return children;
}
