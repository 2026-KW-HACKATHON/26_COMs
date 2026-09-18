import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SealCapsule() {
  const navigate = useNavigate();
  const [duration, setDuration] = useState<string>('6개월 뒤');
  const durations: string[] = ['1개월 뒤', '3개월 뒤', '6개월 뒤', '1년 뒤'];

  const triggerSealPulse = () => {
    if (navigator.vibrate) {
      navigator.vibrate([30, 40, 30]);
    }
  };

  const handleSeal = () => {
    triggerSealPulse();
    alert('타임캡슐이 성공적으로 봉인되었습니다!');
    navigate('/');
  };

  return (
    <div className="flex flex-col w-full pb-24 space-y-6">
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-bold">2</span>
            <span className="font-label-md text-label-md text-primary font-bold tracking-tight">기억 묻기 여정</span>
          </div>
          <span className="font-label-md text-label-md text-on-surface-variant">2 / 3 단계</span>
        </div>
        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-secondary-container to-primary-container rounded-full w-2/3 transition-all duration-500"></div>
        </div>
        <p className="font-headline-sm text-headline-sm text-on-surface mt-1">공간 인증 & 감정 봉인하기</p>
      </div>

      <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-[0_4px_20px_rgba(45,41,38,0.05)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">place</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">방문 장소</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-primary-fixed/40 text-primary font-label-sm text-label-sm font-bold">체크인 완료</span>
        </div>
        <div className="bg-surface-container-low rounded-xl p-space-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-full bg-primary-fixed flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">storefront</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-headline-sm text-on-surface truncate">대림국수 성수점</span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate">서울 성동구 연무장길 15 1층 · 성수 골목길</p>
            </div>
          </div>
          <button className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-colors" type="button">
            <span className="material-symbols-outlined text-[15px]">search</span>
            <span>장소 변경</span>
          </button>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-[0_4px_20px_rgba(45,41,38,0.05)] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">photo_library</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">함께 묻을 기억 사진</h2>
          </div>
          <span className="font-label-md text-label-md text-primary font-bold px-2 py-0.5 bg-primary-fixed/40 rounded-full">3 / 5장</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="relative aspect-square rounded-lg overflow-hidden group shadow-sm">
            <img className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="따뜻한 국수" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVEXSMsKCIWVXO1kX-qXLE5dSEe3ywmmANRrYm0IZ3O7_ekZtHYinVW5akZ4x8anVRNBideJb6LXGNBVvDoVdkyKuezwULz-K0UC7nCY9yUK0tYngWNnZwCaMz1Iuo9nGwNsL6GT3RgSuKqSAIl5kZbdk-toXv2YCTI1w1mqUQVplLofVcxiyfMOLYHat_KELX_bgQpl3qGt7tL_4-uUfiNaxmUoYoReumjNJLaw6ps33TUwNThc5Y" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
            <span className="absolute bottom-1.5 left-1.5 text-on-primary font-label-sm text-label-sm font-medium">따뜻한 국수</span>
          </div>
          <div className="relative aspect-square rounded-lg overflow-hidden group shadow-sm">
            <img className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="노포의 온기" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPrJ19ISjs0dq0VkViJtUy4qvOm91DbO1TKVKn52MDm0TTfPbYqmpapLK6DOVW6HBaaIrbgOS_-WXJaJMI-quwSaBdDjNKpOyZ-DrtuphLWJ7_zFLtZbCkJ1QHNCWFzT64yHQQEia8wuvIdq-x8Vo7JyDBvh-BSH_dYYEt9kCpVlTbGal1sX4VInKzqYPFhRDQnp5rbMsfkR6L-GbR4dQGznvbNSCuVEXDK28sY9-mo-8G8DWBeUnr" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
            <span className="absolute bottom-1.5 left-1.5 text-on-primary font-label-sm text-label-sm font-medium">노포의 온기</span>
          </div>
          <button className="aspect-square rounded-lg bg-surface-container flex flex-col items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all" type="button">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center mb-1 text-primary">
              <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
            </div>
            <span className="font-label-sm text-label-sm font-medium">사진 추가</span>
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          <label className="font-label-md text-label-md text-on-surface-variant">그날의 감정 및 날씨 무드</label>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-medium shadow-sm flex items-center gap-1">☕ 따뜻함</span>
            <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-medium flex items-center gap-1">🏮 노포 감성</span>
            <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm font-medium flex items-center gap-1">🍂 가을 냄새</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center">
            <label className="font-label-md text-label-md text-on-surface font-medium" htmlFor="emotional-note">미래로 보낼 속마음 메모</label>
          </div>
          <div className="relative bg-surface-container-low rounded-xl p-3.5 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <textarea 
              className="w-full bg-transparent resize-none border-none outline-none font-body-md text-body-md text-on-surface placeholder:text-outline/60 leading-relaxed" 
              id="emotional-note" 
              placeholder="이 순간을 미래의 나에게 전해주세요..." 
              rows={4} 
              defaultValue="사라지기 전에 꼭 다시 와보고 싶었던 골목 안 국숫집. 바깥 바람은 쌀쌀했지만 꼬치국수 국물 한 입에 온몸이 녹아내렸다. 재개발 구역이라 내년이면 이전한다는데, 다시 열어볼 때 우리는 어디에 있을까?"
            />
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-[0_4px_20px_rgba(45,41,38,0.05)] flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
            <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">봉인 기간 설정</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant">미래의 언제 이 기억을 열어볼까요?</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {durations.map((d) => (
            <button 
              key={d}
              onClick={() => setDuration(d)}
              className={`relative py-2.5 px-2 rounded-lg font-label-md text-label-md text-center transition-all ${
                duration === d 
                  ? 'bg-primary text-on-primary font-bold shadow-sm' 
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
              type="button"
            >
              {d === '3개월 뒤' && (
                <span className="absolute -top-2 right-1 px-1.5 py-0.2 bg-secondary text-on-secondary font-label-sm text-[9px] rounded-full">추천</span>
              )}
              {d}
            </button>
          ))}
          <button className="col-span-2 py-2.5 px-2 rounded-lg bg-surface-container text-on-surface-variant font-label-md text-label-md text-center transition-all flex items-center justify-center gap-1 hover:bg-surface-container-high" type="button">
            <span className="material-symbols-outlined text-[16px]">calendar_month</span> 직접 특별한 날 지정
          </button>
        </div>
      </section>

      <div className="pt-2 flex flex-col gap-3">
        <button 
          onClick={handleSeal}
          className="w-full h-14 rounded-xl bg-gradient-to-r from-secondary-container via-primary-container to-primary text-on-primary font-headline-sm text-headline-sm font-bold shadow-[0_10px_24px_-4px_rgba(255,123,84,0.38)] active:scale-[0.98] transition-all flex items-center justify-center gap-2" 
          type="button"
        >
          <span className="material-symbols-outlined text-[22px]">lock</span>
          <span>캡슐 타임머신 봉인하기</span>
        </button>
      </div>
    </div>
  );
}