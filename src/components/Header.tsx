import React from 'react';

// Props에 대한 타입 정의
interface HeaderProps {
  currentPath: string;
  goBack: () => void;
}

export default function Header({ currentPath, goBack }: HeaderProps) {
  const isHomeOrMap = currentPath === 'home' || currentPath === 'map';

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="h-16 px-4 flex items-center justify-between max-w-md mx-auto">
        {isHomeOrMap ? (
          <div className="flex items-center gap-space-sm">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[22px]">lock_clock</span>
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">기억캡슐</span>
            </div>
            <button className="flex items-center gap-0.5 px-2.5 py-1 bg-surface-container-low rounded-full hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-secondary text-[16px]">location_on</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">성수동 · 연남동</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[14px]">expand_more</span>
            </button>
          </div>
        ) : (
          <>
            <button onClick={goBack} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h1 className="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate max-w-[200px]">
              {currentPath === 'seal' ? 'Seal Capsule' : 'Capsule Detail'}
            </h1>
          </>
        )}
        
        <div className="flex items-center gap-1">
          {isHomeOrMap ? (
            <button className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant relative">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary ring-2 ring-surface"></span>
            </button>
          ) : (
            <button className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[22px]">more_horiz</span>
            </button>
          )}
          <img 
            alt="Profile" 
            className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-fixed" 
            src="https://lh3.googleusercontent.com/aida/AEtjO1VK1I0W5u9vpi4wG5WpxaW3R5zbM73lt9ZP9ni7J2EM4Zv9tpGt57YI0sIwNPdB_O0qHj8qJRtVDmzG48Iefvs3PpJDpGsqy76XjlyJwXsPQZZ636IkrA4iTHi7KfqjrZlhTX7hl4BdzKj16di2dND6HsCbZ7O8vyjr02SC71Kj-V40o1A4EZn7zd-vhSedwZs5FAaJHqLnlevGSW8S4hoefVXYHJdswuKbDSMmjJOlrJA0rIXwcksnKg" 
          />
        </div>
      </div>
    </header>
  );
}