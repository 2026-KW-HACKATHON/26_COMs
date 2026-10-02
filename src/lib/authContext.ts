import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../types/social';

export interface AuthState {
  /** 저장된 로그인 세션을 확인하는 중 */
  loading: boolean;
  session: Session | null;
  /** 내 프로필. 로그인했지만 불러오지 못하면 null */
  profile: Profile | null;
  /** 프로필을 고친 뒤 화면에 바로 반영 */
  setProfile: (profile: Profile) => void;
}

export const AuthContext = createContext<AuthState>({ loading: false, session: null, profile: null, setProfile: () => {} });
