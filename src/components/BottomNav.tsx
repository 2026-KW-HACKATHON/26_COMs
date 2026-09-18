import React from 'react';
import { Link } from 'react-router-dom';

interface BottomNavProps {
  currentPath: string;
}

export default function BottomNav({ currentPath }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none pb-safe">
      <nav className="max-w-md mx-auto px-4 pb-2 pointer-events-auto">
        <div className="relative bg-surface/90 backdrop-blur-2xl rounded-[28px] shadow-[0_8px_32px_rgba(45,41,38,0.08)] px-2 h-16 flex items-center justify-between">
          
          <Link 
            to="/" 
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${currentPath === 'home' || currentPath === '' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <span className="material-symbols-outlined text-[22px]">cottage</span>
            <span className="font-label-sm text-label-sm">홈</span>
          </Link>

          <Link 
            to="/map" 
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${currentPath === 'map' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <span className="material-symbols-outlined text-[22px]">explore</span>
            <span className="font-label-sm text-label-sm">지도 탐색</span>
          </Link>

          <div className="relative flex flex-col items-center justify-center px-1 -top-5">
            <Link 
              to="/seal" 
              className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF9A76] to-[#FF7B54] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(255,123,84,0.42)] active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[30px]">add</span>
            </Link>
            <span className="font-label-sm text-label-sm text-primary font-bold mt-1">봉인하기</span>
          </div>

          <Link 
            to="/timeline" 
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${currentPath === 'timeline' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <span className="material-symbols-outlined text-[22px]">inventory_2</span>
            <span className="font-label-sm text-label-sm">타임라인</span>
          </Link>

          <Link 
            to="/log" 
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${currentPath === 'log' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <span className="material-symbols-outlined text-[22px]">person</span>
            <span className="font-label-sm text-label-sm">마이로그</span>
          </Link>

        </div>
      </nav>
    </div>
  );
}