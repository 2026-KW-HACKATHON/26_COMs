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
    <header className="fixed top-0 w-full z-50 pt-safe">
      <div className="max-w-[430px] mx-auto px-3">
        <div className="mt-2 mb-2 h-14 px-3 flex items-center justify-between app-surface rounded-full">
        {subTitle ? (
          <>
            <button onClick={goBack} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 text-on-surface transition-colors" aria-label="뒤로">
              <span className="material-symbols-rounded text-[26px]">arrow_back_ios_new</span>
            </button>
            <h1 className="text-[17px] font-extrabold tracking-tight text-on-surface">{subTitle}</h1>
            <span className="w-10" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full instagram-gradient flex items-center justify-center text-white shadow-[0_10px_24px_rgba(225,48,108,0.28)]">
                <span className="material-symbols-rounded text-[22px] icon-fill">camera_alt</span>
              </div>
              <div className="min-w-0">
                <span className="block text-[19px] font-extrabold tracking-tight text-on-surface leading-none">왔다감</span>
              </div>
            </div>
            <div className={`flex items-center gap-2 ${showBell ? '' : 'mr-1'}`}>
              <span className="flex items-center gap-1 h-9 pl-2.5 pr-3 rounded-full bg-gray-50 text-[12px] font-semibold text-gray-700 border border-gray-100">
                <span className="material-symbols-rounded text-[16px] text-gray-500">location_on</span>
                노원구 월계1동
              </span>
              {showBell && (
                <Link
                  to="/notifications"
                  className="relative w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 text-gray-700"
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
      </div>
    </header>
  );
}
