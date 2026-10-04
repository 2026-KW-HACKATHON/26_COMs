import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** .env.local에 Supabase 설정이 있을 때만 만든다. null이면 로그인 없이 기록을 기기(IndexedDB)에 저장한다. */
export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL 등에서 받은 id를 PostgREST 필터에 넣기 전에 검사한다 */
export const isUuid = (value: string | null | undefined): value is string => !!value && UUID.test(value);
