import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname.replace('/', '') || 'home';
  // 홈은 지도가 화면을 꽉 채우도록 여백 없이
  const isHome = currentPath === 'home';

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
      <Header currentPath={currentPath} goBack={() => navigate(-1)} />

      <main className={`flex-1 flex flex-col relative w-full max-w-md mx-auto pt-16 bg-surface ${isHome ? '' : 'px-margin pb-28'}`}>
        <Outlet />
      </main>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
