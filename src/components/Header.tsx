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
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="max-w-[430px] mx-auto pt-safe bg-white border-b border-gray-200 sm:border-x">
        <div className="h-14 pl-2 pr-3 flex items-center justify-between">
        {subTitle ? (
          <>
            <button onClick={goBack} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 text-on-surface transition-colors" aria-label="뒤로">
              <span className="material-symbols-rounded text-[22px]">arrow_back_ios_new</span>
            </button>
            <h1 className="text-[16px] font-bold text-on-surface">{subTitle}</h1>
            <span className="w-10" />
          </>
        ) : (
          <>
            {/* 앱 이름 옆에 동네 이름을 붙여 쓴다: "왔다감 · 월계1동" */}
            <div className="pl-2 flex items-baseline gap-1.5 min-w-0">
              <span className="text-[19px] font-extrabold tracking-tight text-on-surface">왔다감</span>
              <span className="text-label-md text-on-surface-variant truncate">노원구 월계1동</span>
            </div>
            <div className="flex items-center gap-1">
              {showBell && (
                <Link
                  to="/notifications"
                  className="relative w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 text-gray-700"
                  aria-label={unread ? `알림 ${unread}개 새로 옴` : '알림'}
                >
                  {/* 새 조르기가 오면 벨이 흔들린다 */}
                  <span key={unread} className={`material-symbols-rounded text-[24px] ${unread ? 'icon-fill nudge-wiggle' : ''}`}>
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
