import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomeFeed() {
  const navigate = useNavigate();
  // 타입 명시
  const [activeFilter, setActiveFilter] = useState<string>('unlocked');

  return (
    <div className="flex flex-col w-full pb-8">
      <section className="flex flex-col pt-3 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-fixed text-primary text-label-sm font-label-sm">
            <span className="material-symbols-outlined text-[14px]">favorite</span>
          </span>
          <span className="font-label-md text-label-md text-primary tracking-wide">기억보관함 다이어리</span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-snug">
          은우님, 사라져가는 골목의<br />소중한 순간들이 봉인 중이에요.
        </h2>
        <div className="mt-4 p-4 rounded-2xl bg-surface-container-low shadow-sm flex items-center justify-between">
          <div className="flex-1 flex flex-col items-center">
            <span className="font-label-sm text-label-sm text-on-surface-variant">묻어둔 기억</span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="font-headline-lg text-headline-lg text-on-surface">14</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">개</span>
            </div>
          </div>
          <div className="w-px h-7 bg-outline-variant/40"></div>
          <div className="flex-1 flex flex-col items-center">
            <span className="font-label-sm text-label-sm text-primary font-bold">빛을 본 추억</span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="font-headline-lg text-headline-lg text-primary">9</span>
              <span className="font-label-sm text-label-sm text-primary">개</span>
            </div>
          </div>
          <div className="w-px h-7 bg-outline-variant/40"></div>
          <div className="flex-1 flex flex-col items-center">
            <span className="font-label-sm text-label-sm text-tertiary">함께한 친구</span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="font-headline-lg text-headline-lg text-tertiary">8</span>
              <span className="font-label-sm text-label-sm text-tertiary">명</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveFilter('unlocked')}
          className={`px-4 py-2 rounded-xl font-label-md text-label-md transition-all shadow-sm ${activeFilter === 'unlocked' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}
        >
          개봉된 추억 ✨ <span className="opacity-90 ml-0.5">9</span>
        </button>
      </section>

      <section className="flex flex-col gap-4 mt-2">
        {activeFilter === 'unlocked' && (
          <article className="capsule-card relative flex flex-col rounded-2xl bg-surface-container-lowest shadow-[0_4px_24px_-2px_rgba(255,178,107,0.32)] overflow-hidden transition-all duration-300 ring-2 ring-primary-fixed">
            <div className="relative w-full h-52 overflow-hidden bg-surface-container-high">
              <img className="w-full h-full object-cover" alt="Euljiro" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBoz_F1KCoP5mMrECbS2G1u6DYH_TkGJwhb0TTrD8Qg4b6YUJf4SVEpXza1DNJSJI3POONArNUKTSHIOSybFa4K6us9Zgyuy9iCn1gG8qj408_NFLgNwp3ImIOMizXQDuhyI1Ou4S0Mg1GV2UCgQX2Uu4bHT0XeMcx-tfmUZCohDdxPCYbcqhZ45jS3g64LNzuKxgbzKw91pfEXNCh3Rv3qjzCk-WQ4kVS3bt2zHLThbRrWWodhvxsJ" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                <span className="px-2.5 py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-bold flex items-center gap-1 shadow-md">
                  <span className="material-symbols-outlined text-[13px]">lock_open</span> 개봉 완료
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-bright/90 backdrop-blur-md text-on-surface font-label-sm text-label-sm font-medium">
                  2024.09.20 열림
                </span>
              </div>
            </div>
            <div className="p-4 flex flex-col">
              <h3 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                을지로 노포 골목, 원조 만선호프 옆 골목식당
              </h3>
              <div className="mt-2.5 p-3 rounded-xl bg-surface-container-low flex gap-2.5 items-start">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 opacity-70">format_quote</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                  "재개발 전 친구들과 마셨던 시원한 생맥주와 바삭한 노가리. 골목이 사라져도 그날의 웃음소리는 남아있다."
                </p>
              </div>
              <button onClick={() => navigate('/detail')} className="mt-4 font-label-sm text-label-sm font-bold text-primary flex items-center justify-end gap-0.5 hover:underline">
                추억 전체보기 <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}