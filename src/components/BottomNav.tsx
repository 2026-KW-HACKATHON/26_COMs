import { Link } from 'react-router-dom';

interface BottomNavProps {
  currentPath: string;
}

export default function BottomNav({ currentPath }: BottomNavProps) {
  const tab = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? 'text-on-surface' : 'text-gray-400'}`;
  const icon = (active: boolean) => `material-symbols-rounded text-[26px] ${active ? 'icon-fill' : ''}`;

  const home = currentPath === 'home';
  const log = currentPath === 'log';

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-gray-100 pb-safe">
      <div className="max-w-md mx-auto h-16 grid grid-cols-3">
        <Link to="/" className={tab(home)} aria-current={home ? 'page' : undefined}>
          <span className={icon(home)}>map</span>
          지도
        </Link>

        <Link to="/leave" className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-primary">
          <span className="w-12 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center pressable">
            <span className="material-symbols-rounded text-[24px]">add</span>
          </span>
          남기기
        </Link>

        <Link to="/log" className={tab(log)} aria-current={log ? 'page' : undefined}>
          <span className={icon(log)}>video_library</span>
          마이로그
        </Link>
      </div>
    </nav>
  );
}
