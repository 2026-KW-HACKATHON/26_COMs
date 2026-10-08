import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getPlace } from '../data/places';
import Header from './Header';
import BottomNav from './BottomNav';
import NudgeProvider from './NudgeProvider';

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname.replace('/', '') || 'home';
  // 홈과 남기기의 가게 고르기 화면(가게를 아직 안 골랐을 때)은 지도가 화면을 꽉 채우도록 여백 없이
  const isHome = currentPath === 'home';
  const isLeaveMap = currentPath === 'leave' && !getPlace(new URLSearchParams(location.search).get('place'));
  const fullBleed = isHome || isLeaveMap;

  // 앱 안에서 이동해 온 기록이 있을 때만 뒤로 간다. 로그인(카카오·구글)에서 돌아왔거나 공유 링크로 바로 열면
  // 이전 기록이 로그인 페이지·다른 사이트라서 홈으로 보낸다 (React Router가 첫 화면에 idx 0을 기록한다)
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  };

  return (
    <NudgeProvider>
      <div className="app-shell flex flex-col min-h-screen">
        <Header currentPath={currentPath} goBack={goBack} />

        <main
          className={`flex-1 flex flex-col relative w-full max-w-[430px] mx-auto pt-[var(--header-space)] bg-white sm:border-x sm:border-gray-200 ${
            fullBleed ? '' : 'px-4 sm:px-5 pb-[calc(var(--nav-space)+1.5rem)]'
          }`}
        >
          <Outlet />
        </main>

        <BottomNav currentPath={currentPath} />
      </div>
    </NudgeProvider>
  );
}
