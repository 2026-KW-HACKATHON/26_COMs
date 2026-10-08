import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { isAutoUsername, isKakaoInAppBrowser, safeNextPath, signInWith, type LoginProvider } from '../lib/social';

/** 로그인 서버가 돌려준 오류를 사용자에게 보여 줄 문장으로 (오류는 ?query와 #hash 양쪽에 올 수 있다) */
function oauthErrorMessage(search: URLSearchParams, hash: string): string {
  const fromHash = new URLSearchParams(hash.replace(/^#/, ''));
  const code = search.get('error') ?? fromHash.get('error');
  const description = search.get('error_description') ?? fromHash.get('error_description') ?? '';
  if (!code && !description) return '';
  if (code === 'access_denied') return '로그인을 취소했어요.';
  if (/email/i.test(description)) return '카카오 계정 이메일을 받지 못했어요. 관리자에게 Supabase 카카오 설정을 확인해 달라고 알려 주세요.';
  if (/saving new user/i.test(description)) return '계정을 만드는 중 문제가 생겼어요. 관리자에게 supabase/schema.sql 실행 여부를 확인해 달라고 알려 주세요.';
  // 주소에 담긴 문장을 그대로 보여 주면 가짜 안내문(피싱)에 쓰일 수 있어 정해진 문장만 보여 준다
  console.warn('OAuth error', code, description);
  return '로그인하지 못했어요. 다시 시도해 주세요.';
}

function KakaoSymbol() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#000"
        d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.7 6.78-.15.54-.97 3.47-1 3.7 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.7-2.43 4.29-2.85.55.08 1.11.12 1.68.12 5.52 0 10-3.58 10-8S17.52 3 12 3z"
      />
    </svg>
  );
}

function GoogleSymbol() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export default function Login() {
  const { session, profile, loading } = useAuth();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const [pending, setPending] = useState<LoginProvider | null>(null);
  const [error, setError] = useState('');

  const next = safeNextPath(params.get('next'));
  // 소셜 로그인 화면에서 취소하거나 실패하면 이 주소로 오류와 함께 돌아온다
  const oauthError = oauthErrorMessage(params, hash);
  // 로그인 결과(code)는 왔는데 세션이 없으면: 로그인을 시작한 브라우저와 돌아온 브라우저가 다른 경우
  const unfinished = !loading && !session && !oauthError && params.has('code')
    ? '로그인을 마치지 못했어요. 로그인을 시작한 브라우저에서 다시 시도해 주세요.'
    : '';
  const inKakaoTalk = isKakaoInAppBrowser();

  // 로그인 페이지로 이동한 뒤 뒤로 가기로 돌아오면 브라우저가 이전 화면 상태(버튼 비활성)를 그대로 복원한다
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(null);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  if (!SOCIAL_ENABLED) return <Navigate to="/" replace />;
  if (session && !loading) {
    // 처음 로그인해서 아이디가 임시(user_xxxx)면 친구가 찾을 수 있게 아이디부터 정한다
    const setup = profile && isAutoUsername(profile.username);
    return <Navigate to={setup ? `/profile?setup=1&next=${encodeURIComponent(next)}` : next} replace />;
  }

  const login = async (provider: LoginProvider) => {
    setPending(provider);
    setError('');
    try {
      await signInWith(provider, next);
    } catch (err) {
      console.error(err);
      setError('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setPending(null);
    }
  };

  const busy = loading || pending !== null;

  return (
    <div className="flex flex-col items-center w-full pt-8 pb-6 gap-8">
      <div className="flex flex-col items-center text-center gap-4 w-full app-card px-6 py-8">
        <div className="w-20 h-20 rounded-[24px] instagram-gradient flex items-center justify-center shadow-[0_16px_34px_rgba(225,48,108,0.28)]">
          <img src="/pwa-192x192.png" alt="" className="w-14 h-14 rounded-[18px]" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-500">Welcome back</p>
          <h2 className="text-headline-lg text-on-surface">왔다감</h2>
          <p className="text-label-lg font-bold text-primary">동네 가게에 남기는 5초</p>
        </div>
        <p className="text-body-md text-on-surface-variant leading-relaxed">
          로그인하면 가게에서 찍은 5초가 내 지도에 쌓이고,
          <br />
          친구를 태그하거나 서로의 지도를 볼 수 있어요.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={() => login('kakao')}
          disabled={busy}
          className="relative h-14 rounded-full bg-[#FEE500] text-black/85 text-[16px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 pressable shadow-[0_12px_24px_rgba(254,229,0,0.2)]"
          type="button"
        >
          <span className="absolute left-4">
            <KakaoSymbol />
          </span>
          {pending === 'kakao' ? '카카오로 이동 중…' : '카카오로 시작하기'}
        </button>
        <button
          onClick={() => login('google')}
          disabled={busy || inKakaoTalk}
          className="relative h-14 rounded-full bg-white border border-gray-200 text-on-surface text-[16px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 pressable shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
          type="button"
        >
          <span className="absolute left-4">
            <GoogleSymbol />
          </span>
          {pending === 'google' ? 'Google로 이동 중…' : 'Google로 시작하기'}
        </button>
        {inKakaoTalk && (
          <p className="text-label-sm text-on-surface-variant text-center px-4">
            카카오톡 안에서는 Google 로그인이 막혀 있어요. 오른쪽 아래 ⋯ 메뉴에서 &lsquo;다른 브라우저로 열기&rsquo;를 눌러 주세요.
          </p>
        )}
      </div>

      <p className="text-label-sm text-on-surface-variant text-center">
        시작하면{' '}
        <Link to="/privacy" className="underline underline-offset-2">
          개인정보처리방침
        </Link>
        에 동의하는 것으로 봐요.
      </p>

      {loading && <p className="text-label-md text-on-surface-variant">로그인 정보를 확인하는 중…</p>}
      {(error || oauthError || unfinished) && (
        <p className="text-label-md text-error text-center">{error || oauthError || unfinished}</p>
      )}
    </div>
  );
}
