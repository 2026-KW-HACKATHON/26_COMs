import { Link } from 'react-router-dom';

interface BottomNavProps {
  currentPath: string;
}

const TABS_LEFT = [
  { path: '/', key: 'home', icon: 'map', label: '지도' },
  { path: '/feed', key: 'feed', icon: 'dynamic_feed', label: '피드' },
];
const TABS_RIGHT = [
  { path: '/ranking', key: 'ranking', icon: 'leaderboard', label: '랭킹' },
  { path: '/log', key: 'log', icon: 'video_library', label: 'MY' },
];

export default function BottomNav({ currentPath }: BottomNavProps) {
  const tab = (t: (typeof TABS_LEFT)[number]) => {
    const active = currentPath === t.key;
    return (
      <Link
        key={t.key}
        to={t.path}
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${active ? 'text-on-surface' : 'text-gray-400'}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className={`material-symbols-rounded text-[24px] ${active ? 'icon-fill' : ''}`}>{t.icon}</span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="max-w-[430px] mx-auto pb-safe bg-white border-t border-gray-200 sm:border-x">
        <div className="h-[var(--nav-bar-h)] grid grid-cols-5">
          {TABS_LEFT.map(tab)}

          {/* 남기기: 다른 탭과 같은 크기에, 아이콘만 강조색 상자에 담는다 */}
          <Link to="/leave" className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-on-surface" aria-current={currentPath === 'leave' ? 'page' : undefined}>
            <span className="w-11 h-7 rounded-lg bg-primary text-white flex items-center justify-center pressable">
              <span className="material-symbols-rounded text-[20px]">add</span>
            </span>
            남기기
          </Link>

          {TABS_RIGHT.map(tab)}
        </div>
      </div>
    </nav>
  );
}
