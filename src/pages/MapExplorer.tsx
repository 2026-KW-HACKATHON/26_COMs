import React, { useState } from 'react';

// 필터 타입 인터페이스
interface FilterItem {
  id: string;
  label: string;
  count: number;
  icon?: string;
  color?: string;
}

export default function MapExplorer() {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showBottomSheet, setShowBottomSheet] = useState<boolean>(false);
  const [isRecentering, setIsRecentering] = useState<boolean>(false);

  const filters: FilterItem[] = [
    { id: 'all', label: '전체 핀', count: 14 },
    { id: 'sealed', label: '봉인', count: 5, icon: 'lock', color: 'text-primary' },
    { id: 'unsealed', label: '개봉', count: 9, icon: 'lock_open', color: 'text-tertiary' }
  ];

  const handleRecenter = () => {
    setIsRecentering(true);
    setTimeout(() => setIsRecentering(false), 300);
  };

  return (
    <div className="flex flex-col w-full relative">
      <div className="sticky top-0 z-30 pb-3 pt-1">
        <div className="bg-surface-container-lowest/90 backdrop-blur-xl rounded-2xl shadow-md p-2.5 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {filters.map((f) => (
              <button 
                key={f.id} 
                onClick={() => setSelectedFilter(f.id)}
                className={`px-3 py-1 rounded-full text-label-md font-label-md transition-all whitespace-nowrap flex items-center gap-1 ${selectedFilter === f.id ? 'bg-primary-container text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant'}`}
              >
                {f.icon && <span className={`material-symbols-outlined text-[14px] ${f.color}`}>{f.icon}</span>}
                {f.label} <span className={selectedFilter === f.id ? 'px-1.5 py-0.2 bg-white/25 rounded-full text-label-sm' : ''}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full h-[540px] rounded-3xl overflow-hidden shadow-sm bg-surface-container-low select-none">
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
          <path d="M-20,120 Q120,180 240,140 T460,200" fill="none" stroke="#dfc0b7" strokeLinecap="round" strokeWidth="14" />
          <path d="M120,-10 Q140,220 200,380 T320,560" fill="none" stroke="#f5ece7" strokeWidth="22" />
        </svg>

        <div 
          onClick={() => setShowBottomSheet(true)}
          className="absolute top-[36%] left-[42%] -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95"
        >
          <div className="relative flex flex-col items-center">
            <div className="absolute -top-1 w-12 h-12 bg-primary-container/40 rounded-full blur-md animate-pulse"></div>
            <div className="relative z-10 px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-lg flex items-center gap-1 mb-1 ring-2 ring-surface-bright">
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              <span className="font-label-sm text-label-sm font-bold tracking-tight">성수 동양서점</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center text-primary border-2 border-primary-container">
              <span className="material-symbols-outlined text-[16px]">history_edu</span>
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-16 z-20 flex flex-col gap-2">
          <button 
            onClick={handleRecenter}
            className={`w-10 h-10 rounded-xl bg-surface-container-lowest/95 backdrop-blur-md shadow-md text-on-surface-variant flex items-center justify-center transition-all ${isRecentering ? 'rotate-45' : ''}`}
          >
            <span className="material-symbols-outlined text-[20px]">my_location</span>
          </button>
        </div>
      </div>

      {showBottomSheet && (
        <div className="w-full mt-3 bg-surface-container-lowest rounded-3xl p-4 shadow-xl flex flex-col gap-3.5">
           <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate mt-0.5">
                동양서점 <span className="font-body-sm text-body-sm text-on-surface-variant font-normal">(성수2가 300-1)</span>
              </h2>
            </div>
            <button onClick={() => setShowBottomSheet(false)} className="w-9 h-9 rounded-full bg-surface-container-low text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          
          <div className="relative w-full h-36 rounded-2xl overflow-hidden shadow-sm bg-surface-container">
            <div className="absolute inset-0 bg-surface-container-lowest/60 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-fixed-dim to-primary-container text-on-primary flex items-center justify-center shadow-md mb-1.5">
                <span className="material-symbols-outlined text-[22px]">lock_clock</span>
              </div>
              <p className="font-headline-sm text-[15px] font-bold text-on-surface">2024년 10월 15일에 개봉됩니다</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}