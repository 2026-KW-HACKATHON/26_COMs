import React, { useState } from 'react';

export default function CapsuleDetail() {
  const [isCouponGrabbed, setIsCouponGrabbed] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  return (
    <div className="flex flex-col w-full pb-24 space-y-space-lg mt-4">
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low shadow-sm p-space-lg">
        <div className="relative flex flex-col items-center text-center space-y-space-sm">
          <div className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center text-primary transform transition-transform hover:scale-105 active:scale-95 duration-300">
            <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock_open_right</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>봉인 해제 완료</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface pt-1">
            6개월 동안 봉인되었던<br />소중한 추억이 열렸습니다
          </h2>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-space-md mt-4">
        <h3 className="font-headline-lg text-headline-lg text-on-surface pt-1">을지로 3가 레트로 LP바 '소리샘'</h3>
        
        <div className="rounded-xl bg-surface-container-high p-space-lg space-y-space-md shadow-sm mt-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[22px]">storefront</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-headline-sm text-headline-sm text-on-surface leading-snug">
                사라지지 않고 이전한 사장님의 새 보금자리 소식!
              </h4>
            </div>
          </div>
          <button 
            onClick={() => setIsCouponGrabbed(true)}
            className={`w-full h-[52px] rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${isCouponGrabbed ? 'bg-surface-container text-on-surface-variant' : 'bg-primary-container text-on-primary hover:opacity-95'}`}
          >
            {isCouponGrabbed ? (
              <><span className="material-symbols-outlined text-[20px]">check_circle</span> 쿠폰북에 발급되었습니다</>
            ) : (
              <><span className="material-symbols-outlined text-[20px]">loyalty</span> 추억 소환 재방문 15% 감사 쿠폰 받기</>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button className="h-[52px] rounded-xl bg-surface-container-low text-on-surface font-label-lg flex items-center justify-center gap-2 hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[20px] text-secondary">share</span> 친구에게 공유
          </button>
          <button 
            onClick={() => setIsSaved(true)}
            className={`h-[52px] rounded-xl font-label-lg flex items-center justify-center gap-2 transition-colors ${isSaved ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={!isSaved ? { fontVariationSettings: "'FILL' 1", color: 'var(--color-primary)' } : {}}>
              {isSaved ? 'check' : 'bookmark'}
            </span>
            {isSaved ? '영구 보관됨' : '영구 앨범 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}