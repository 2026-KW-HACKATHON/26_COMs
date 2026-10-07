interface HeaderProps {
  currentPath: string;
  goBack: () => void;
}

const SUB_TITLES: Record<string, string> = {
  leave: '영상 남기기',
  video: '영상',
  login: '로그인',
  friends: '친구',
  profile: '프로필 편집',
};

export default function Header({ currentPath, goBack }: HeaderProps) {
  const section = currentPath.split('/')[0];
  const subTitle = SUB_TITLES[section];

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface">
      <div className="h-14 px-2 flex items-center justify-between max-w-md mx-auto">
        {subTitle ? (
          <>
            <button onClick={goBack} className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container text-on-surface transition-colors" aria-label="뒤로">
              <span className="material-symbols-rounded text-[26px]">arrow_back_ios_new</span>
            </button>
            <h1 className="text-[17px] font-bold text-on-surface">{subTitle}</h1>
            <span className="w-11" />
          </>
        ) : (
          <>
            <span className="pl-3 text-[20px] font-bold tracking-tight text-on-surface">기억캡슐</span>
            <span className="mr-2 flex items-center gap-0.5 h-8 pl-2 pr-3 bg-surface-container rounded-full text-[13px] font-semibold text-gray-700">
              <span className="material-symbols-rounded text-[16px] text-gray-500">location_on</span>
              노원구 월계1동
            </span>
          </>
        )}
      </div>
    </header>
  );
}
