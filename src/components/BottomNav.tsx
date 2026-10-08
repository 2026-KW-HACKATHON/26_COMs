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
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? 'text-primary' : 'text-gray-500'}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className={`material-symbols-rounded text-[26px] ${active ? 'icon-fill' : ''}`}>{t.icon}</span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe">
      <div className="max-w-[430px] mx-auto px-3 pb-3">
        <div className="h-[var(--nav-bar-h)] grid grid-cols-5 items-end rounded-xl app-surface px-2 py-2">
        {TABS_LEFT.map(tab)}

        <Link to="/leave" className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-primary">
          <span className="w-12 h-12 rounded-full fill-accent text-white flex items-center justify-center pressable">
            <span className="material-symbols-rounded text-[24px] icon-fill">add</span>
          </span>
          남기기
        </Link>

        {TABS_RIGHT.map(tab)}
        </div>
      </div>
    </nav>
  );
}
