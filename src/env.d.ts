interface ImportMetaEnv {
  /** Supabase 프로젝트 URL (없으면 기기 저장) */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase Publishable key (또는 legacy anon key) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
