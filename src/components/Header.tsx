import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNudges } from '../hooks/useNudges';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';

interface HeaderProps {
  currentPath: string;
  goBack: () => void;
}

const SUB_TITLES: Record<string, string> = {
  leave: '5초 남기기',
  video: '영상',
  login: '로그인',
  friends: '친구',
  profile: '프로필 편집',
  notifications: '알림',
  privacy: '개인정보처리방침',
};

export default function Header({ currentPath, goBack }: HeaderProps) {
  const section = currentPath.split('/')[0];
  const subTitle = SUB_TITLES[section];
  const loggedIn = !!useAuth().session;
  const { unread } = useNudges();
  const showBell = SOCIAL_ENABLED && loggedIn;

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-white/90 backdrop-blur-xl border-b border-gray-100">
      <div className="h-14 px-2 flex items-center justify-between max-w-[430px] mx-auto">
        {subTitle ? (
          <>
            <button onClick={goBack} className="w-11 h-11 flex items-center justify-center rounded-full active:bg-gray-100 text-on-surface transition-colors" aria-label="뒤로">
              <span className="material-symbols-rounded text-[26px]">arrow_back_ios_new</span>
            </button>
            <h1 className="text-[17px] font-bold text-on-surface">{subTitle}</h1>
            <span className="w-11" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 pl-2">
              <span className="w-8 h-8 rounded-[10px] bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-rounded icon-fill text-[19px]">location_on</span>
              </span>
              <span className="text-[20px] font-extrabold tracking-tight text-on-surface">왔다감</span>
            </div>
            <div className={`flex items-center gap-1 ${showBell ? '' : 'mr-2'}`}>
              <span className="flex items-center gap-0.5 h-8 pl-2 pr-3 rounded-full bg-gray-100 text-[13px] font-semibold text-gray-700">
                <span className="material-symbols-rounded text-[16px] text-gray-500">location_on</span>
                노원구 월계1동
              </span>
              {showBell && (
                <Link
                  to="/notifications"
                  className="relative w-11 h-11 flex items-center justify-center rounded-full active:bg-gray-100 text-gray-700"
                  aria-label={unread ? `알림 ${unread}개 새로 옴` : '알림'}
                >
                  {/* 새 조르기가 오면 벨이 흔들린다 */}
                  <span key={unread} className={`material-symbols-rounded text-[26px] ${unread ? 'icon-fill nudge-wiggle' : ''}`}>
                    notifications
                  </span>
                  {unread > 0 && (
                    <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold leading-[18px] text-center ring-2 ring-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
