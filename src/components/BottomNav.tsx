import { Link } from 'react-router-dom';

interface BottomNavProps {
  currentPath: string;
}

export default function BottomNav({ currentPath }: BottomNavProps) {
  const tab = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${active ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none pb-safe">
      <nav className="max-w-md mx-auto px-4 pb-2 pointer-events-auto">
        <div className="relative bg-surface/90 backdrop-blur-2xl rounded-[28px] shadow-[0_8px_32px_rgba(45,41,38,0.08)] px-6 h-16 flex items-center justify-between">
          <Link to="/" className={tab(currentPath === 'home')}>
            <span className="material-symbols-outlined text-[22px]">map</span>
            <span className="font-label-sm text-label-sm">홈</span>
          </Link>

          <div className="relative flex flex-col items-center justify-center px-1 -top-5">
            <Link
              to="/leave"
              className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF9A76] to-[#FF7B54] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(255,123,84,0.42)] active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[30px]">add</span>
            </Link>
            <span className="font-label-sm text-label-sm text-primary font-bold mt-1">남기기</span>
          </div>

          <Link to="/log" className={tab(currentPath === 'log')}>
            <span className="material-symbols-outlined text-[22px]">video_library</span>
            <span className="font-label-sm text-label-sm">마이로그</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
