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
    // 화면 아래에 떠 있는 탭 막대 (지도 화면에서는 지도 위에 뜬다)
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe pointer-events-none">
      <div className="max-w-[430px] mx-auto px-3 pb-3">
        <div className="h-16 grid grid-cols-5 rounded-[26px] app-surface pointer-events-auto">
          {TABS_LEFT.map(tab)}

          {/* 남기기: 가운데 강조 그라데이션 버튼 */}
          <Link to="/leave" className="flex items-center justify-center" aria-label="남기기" aria-current={currentPath === 'leave' ? 'page' : undefined}>
            <span className="w-11 h-11 rounded-2xl brand-gradient shadow-brand flex items-center justify-center pressable">
              <span className="material-symbols-rounded text-[26px]">add</span>
            </span>
          </Link>

          {TABS_RIGHT.map(tab)}
        </div>
      </div>
    </nav>
  );
}
