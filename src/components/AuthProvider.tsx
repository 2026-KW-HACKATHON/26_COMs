import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  // 토큰 갱신 때마다 프로필을 다시 부르지 않도록, 프로필을 불러온(불러오는 중인) 사용자 id를 기억한다
  const profileFor = useRef<string | null>(null);
  const latestSession = useRef<Session | null>(null);

  const loadProfile = useCallback((userId: string) => {
    profileFor.current = userId;
    getProfile(userId)
      .catch((err) => {
        console.error(err);
        // 실패는 기억하지 않아서 다음 로그인 이벤트(탭 복귀, 토큰 갱신)에 다시 시도한다
        if (profileFor.current === userId) profileFor.current = null;
        return null;
      })
      .then((profile) => {
        const session = latestSession.current;
        if (session?.user.id === userId) setState({ loading: false, session, profile });
      });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // 이 콜백 안에서 다른 supabase 요청을 기다리면 교착될 수 있어 다음 틱으로 미룬다
      setTimeout(() => {
        if (!alive) return;
        latestSession.current = session;
        const userId = session?.user.id ?? null;
        if (!userId) {
          profileFor.current = null;
          setState({ loading: false, session: null, profile: null });
          return;
        }
        if (userId === profileFor.current) {
          // 같은 사용자의 이벤트가 연달아 와도(로그인 직후 SIGNED_IN + INITIAL_SESSION) 프로필을 다 받을 때까지는 로딩 유지
          setState((s) => ({ ...s, session }));
          return;
        }
        // 처음 로그인했거나 다른 사용자로 바뀌면 프로필을 받을 때까지 로딩 (이전 사람의 프로필은 비운다).
        // 같은 사용자의 재시도(앞서 실패)라면 화면을 가리지 않고 뒤에서 다시 받는다
        setState((s) => {
          const sameUser = s.session?.user.id === userId;
          return { loading: sameUser ? s.loading : true, session, profile: sameUser ? s.profile : null };
        });
        loadProfile(userId);
      }, 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({ ...state, setProfile: (profile: Profile) => setState((s) => ({ ...s, profile })) }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
