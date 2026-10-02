import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** .env.local에 Supabase 설정이 있을 때만 만든다. null이면 기록은 기기(IndexedDB)에 저장된다. */
export const supabase = url && key ? createClient(url, key) : null;
