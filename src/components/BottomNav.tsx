import { Link } from 'react-router-dom';
import { useGroups } from '../hooks/useGroups';

interface BottomNavProps {
  currentPath: string;
}

interface Tab {
  path: string;
  key: string;
  icon: string;
  label: string;
}

const TABS_LEFT: Tab[] = [
  { path: '/', key: 'home', icon: 'map', label: '지도' },
  { path: '/feed', key: 'feed', icon: 'dynamic_feed', label: '피드' },
];
const TABS_RIGHT: Tab[] = [
  { path: '/groups', key: 'groups', icon: 'groups', label: '그룹' },
  { path: '/log', key: 'log', icon: 'video_library', label: 'MY' },
];

export default function BottomNav({ currentPath }: BottomNavProps) {
  // 받은 그룹 초대 수를 그룹 탭에 표시
  const invites = useGroups().list?.filter((g) => g.myStatus === 'invited').length ?? 0;
  const section = currentPath.split('/')[0];

  const tab = (t: Tab) => {
    const active = section === t.key;
    const badge = t.key === 'groups' ? invites : 0;
    return (
      <Link
        key={t.key}
        to={t.path}
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? 'text-on-surface' : 'text-gray-400'}`}
        aria-current={active ? 'page' : undefined}
        aria-label={badge ? `${t.label}, 받은 초대 ${badge}개` : undefined}
      >
        <span className="relative">
          <span className={`material-symbols-rounded text-[26px] ${active ? 'icon-fill' : ''}`}>{t.icon}</span>
          {badge > 0 && (
            <span className="absolute -top-0.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-bold leading-4 text-center ring-2 ring-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-100 pb-safe">
      <div className="max-w-[430px] mx-auto h-16 grid grid-cols-5">
        {TABS_LEFT.map(tab)}

        {/* 가운데는 글자 없이 동그란 + 버튼 (화면 읽기 프로그램에는 이름을 알려 준다) */}
        <Link to="/leave" className="flex items-center justify-center" aria-label="5초 남기기" aria-current={section === 'leave' ? 'page' : undefined}>
          <span className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center pressable">
            <span className="material-symbols-rounded text-[30px]">add</span>
          </span>
        </Link>

        {TABS_RIGHT.map(tab)}
      </div>
    </nav>
  );
}
