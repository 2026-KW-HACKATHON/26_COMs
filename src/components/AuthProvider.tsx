import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from '../lib/authContext';
import { getProfile } from '../lib/social';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/social';

interface State {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
}

/** 로그인 세션과 내 프로필을 앱 전체에 제공한다. Supabase 설정이 없으면 항상 로그아웃 상태. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ loading: !!supabase, session: null, profile: null });
  // 토큰 갱신 때마다 프로필을 다시 부르지 않도록, 프로필을 불러온 사용자 id를 기억한다
  const profileFor = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // 이 콜백 안에서 다른 supabase 요청을 기다리면 교착될 수 있어 다음 틱으로 미룬다
      setTimeout(() => {
        if (!alive) return;
        const userId = session?.user.id ?? null;
        if (userId === profileFor.current) {
          setState((s) => ({ ...s, loading: false, session }));
          return;
        }
        profileFor.current = userId;
        if (!session || !userId) {
          setState({ loading: false, session: null, profile: null });
          return;
        }
        getProfile(userId)
          .catch(() => null)
          .then((profile) => {
            if (alive && profileFor.current === userId) setState({ loading: false, session, profile });
          });
      }, 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ ...state, setProfile: (profile: Profile) => setState((s) => ({ ...s, profile })) }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
