import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { findRecall } from '../lib/recall';
import CapsuleThumb from './CapsuleThumb';

const DISMISS_KEY = 'recall-dismissed';

/** 닫은 카드는 그날 다시 띄우지 않는다 (이 기기에서만) */
function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** 피드 맨 위: "한 달 전 오늘, ○○분식" — 그날 남긴 영상을 다시 보고, 다시 가서 남기게 한다 */
export default function RecallCard() {
  const navigate = useNavigate();
  const me = useAuth().session?.user.id ?? '';
  const capsules = useCapsules();
  const recall = useMemo(() => (capsules ? findRecall(capsules) : null), [capsules]);
  // 같은 영상의 같은 기념일은 한 번뿐이라 날짜 대신 기념일 이름으로 구분한다
  const key = recall ? `${recall.capsule.id}:${recall.label}` : '';
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!recall || dismissed === key) return null;
  const c = recall.capsule;
  const names = [...(c.author && c.userId !== me ? [c.author.displayName] : []), ...c.tags.filter((t) => t.id !== me).map((t) => t.displayName)];
  const withText = names.length ? `${names[0]}님${names.length > 1 ? ` 외 ${names.length - 1}명` : ''}과 함께 남긴 5초` : '그날 남긴 5초';

  const dismiss = () => {
    setDismissed(key);
    try {
      localStorage.setItem(DISMISS_KEY, key);
    } catch {
      // 저장하지 못해도 이번에는 닫힌다
    }
  };

  return (
    <section className="relative mb-5 p-3 rounded-xl surface border border-gray-200 flex gap-3">
      <button onClick={() => navigate(`/video/${c.id}`)} className="relative w-20 h-[6.5rem] shrink-0 rounded-lg overflow-hidden bg-gray-100 pressable" type="button" aria-label="영상 보기">
        <CapsuleThumb thumbnail={c.thumbnail} />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="media-play material-symbols-rounded icon-fill text-[28px]">play_arrow</span>
        </span>
      </button>
      <div className="flex-1 min-w-0 flex flex-col py-0.5">
        <p className="text-label-sm font-bold text-primary">{recall.label} 오늘</p>
        <p className="text-label-lg font-bold text-on-surface truncate pr-6">{c.placeName}</p>
        <p className="text-label-sm text-on-surface-variant truncate">{withText}</p>
        <div className="mt-auto pt-2 flex gap-1.5">
          <button onClick={() => navigate(`/video/${c.id}`)} className="h-9 px-3 rounded-md bg-gray-100 text-gray-700 text-label-md font-semibold pressable" type="button">
            다시 보기
          </button>
          <button
            onClick={() => navigate(`/leave?place=${encodeURIComponent(c.placeId)}`)}
            className="h-9 px-3 rounded-md fill-accent text-white text-label-md font-bold pressable"
            type="button"
          >
            또 가서 남기기
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center" type="button" aria-label="닫기">
        <span className="material-symbols-rounded text-[18px]">close</span>
      </button>
    </section>
  );
}
