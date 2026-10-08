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
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? 'text-on-surface' : 'text-gray-400'}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className={`material-symbols-rounded text-[26px] ${active ? 'icon-fill' : ''}`}>{t.icon}</span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 app-surface border-t border-gray-900/[0.06] pb-safe">
      <div className="max-w-[430px] mx-auto h-16 grid grid-cols-5">
        {TABS_LEFT.map(tab)}

        {/* 남기기: 탭 막대 위로 살짝 떠오른 노을빛 버튼 (종이색 테두리로 막대와 떼어 놓는다) */}
        <Link to="/leave" className="flex flex-col items-center justify-end pb-[7px] gap-0.5 text-[11px] font-bold text-primary">
          <span className="w-[52px] h-[52px] -mt-5 rounded-full bg-sunset shadow-glow ring-4 ring-paper flex items-center justify-center pressable">
            <span className="material-symbols-rounded icon-fill text-[26px]">videocam</span>
          </span>
          남기기
        </Link>

        {TABS_RIGHT.map(tab)}
      </div>
    </nav>
  );
}
