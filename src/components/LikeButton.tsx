import { useRef, useState } from 'react';
import { setLiked } from '../lib/capsuleStore';
import type { Capsule } from '../types/capsule';

/** 하트 버튼: 누르면 바로 채워지고 숫자가 오른다. 저장은 뒤에서 하고, 실패하면 되돌린다 */
export default function LikeButton({ capsule }: { capsule: Capsule }) {
  const [state, setState] = useState({ liked: capsule.liked, count: capsule.likeCount });
  // 하트를 새로 누를 때마다 바뀌어서 톡 튀는 애니메이션을 다시 재생한다 (처음 그릴 때는 튀지 않게 0)
  const [pop, setPop] = useState(0);
  const saving = useRef(false);

  const toggle = async () => {
    if (saving.current) return;
    saving.current = true;
    const prev = state;
    const next = { liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) };
    setState(next);
    if (next.liked) setPop((n) => n + 1);
    try {
      await setLiked(capsule.id, next.liked);
    } catch (err) {
      console.error(err);
      setState(prev);
      alert('하트를 누르지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      saving.current = false;
    }
  };

  return (
    <button
      onClick={toggle}
      className="h-10 -ml-1.5 pl-1.5 pr-2 rounded-xl flex items-center gap-1 text-label-lg text-on-surface pressable"
      type="button"
      aria-pressed={state.liked}
      aria-label={state.count ? `하트 ${state.count}개` : '하트'}
    >
      <span
        key={pop}
        className={`material-symbols-rounded text-[28px] ${state.liked ? `icon-fill text-error ${pop ? 'like-pop' : ''}` : 'text-gray-700'}`}
      >
        favorite
      </span>
      {state.count > 0 && <span className="font-bold tabular-nums">{state.count}</span>}
    </button>
  );
}
