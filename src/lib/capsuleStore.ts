import * as device from './localStore';
import * as cloud from './remoteStore';
import { supabase } from './supabase';

// Supabase 설정(.env.local)이 있으면 로그인 계정으로 서버에, 없으면 이 기기 브라우저(IndexedDB)에 저장한다.
// 두 저장소는 함수 모양이 같아서 화면 코드는 어느 쪽인지 몰라도 된다.
export const STORAGE_MODE = supabase ? 'cloud' : 'device';

/** 로그인·친구·태그 기능을 쓸 수 있는지 (서버 저장일 때만) */
export const SOCIAL_ENABLED = STORAGE_MODE === 'cloud';

export const { addCapsule, getCapsule, listCapsules, deleteCapsule } = supabase ? cloud : device;

/** 앨범 영상 최대 용량. Supabase 무료 요금제는 파일당 50MB까지 올릴 수 있다. */
export const MAX_VIDEO_BYTES = (supabase ? 50 : 200) * 1024 * 1024;
