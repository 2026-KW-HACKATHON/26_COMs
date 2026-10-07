interface ImportMetaEnv {
  /** Supabase 프로젝트 URL (없으면 기기 저장) */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase Publishable key (또는 legacy anon key) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** 폰 알림(웹 푸시) VAPID 공개 키. 없으면 조르기는 앱 안 알림으로만 보인다 */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}
