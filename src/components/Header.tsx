interface HeaderProps {
  currentPath: string;
  goBack: () => void;
}

const SUB_TITLES: Record<string, string> = {
  leave: '영상 남기기',
  video: '내 영상',
};

export default function Header({ currentPath, goBack }: HeaderProps) {
  const section = currentPath.split('/')[0];
  const subTitle = SUB_TITLES[section];

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="h-16 px-4 flex items-center justify-between max-w-md mx-auto">
        {subTitle ? (
          <>
            <button onClick={goBack} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface transition-colors" aria-label="뒤로">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h1 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">{subTitle}</h1>
            <span className="w-11" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[22px]">lock_clock</span>
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">기억캡슐</span>
            </div>
            <span className="flex items-center gap-0.5 px-2.5 py-1 bg-surface-container-low rounded-full">
              <span className="material-symbols-outlined text-secondary text-[16px]">location_on</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">노원구 월계1동</span>
            </span>
          </>
        )}
      </div>
    </header>
  );
}
