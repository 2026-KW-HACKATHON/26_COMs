import { useRef, useState } from 'react';
import { setLiked } from '../lib/capsuleStore';
import type { Capsule } from '../types/capsule';

export interface Like {
  liked: boolean;
  count: number;
  /** 하트를 새로 누를 때마다 오른다. 하트 버튼이 이 값으로 톡 튀는 애니메이션을 다시 재생한다 (처음엔 0이라 튀지 않음) */
  pop: number;
  /** 하트 버튼: 누르기·취소 */
  toggle: () => void;
  /** 영상 두 번 톡: 누르기만 (이미 눌렀으면 그대로) */
  like: () => void;
}

/**
 * 영상 하나의 하트. 화면에 먼저 반영하고 저장은 뒤에서 하고, 실패하면 되돌린다.
 * 영상을 불러오는 중(undefined)이거나 다른 영상으로 바뀌면 그 영상의 값으로 새로 시작한다.
 */
export function useLike(capsule: Capsule | null | undefined): Like {
  const id = capsule?.id ?? null;
  const [changed, setChanged] = useState<{ id: string; liked: boolean; count: number; pop: number } | null>(null);
  const saving = useRef(false);
  const current = changed?.id === id ? changed : { id, liked: !!capsule?.liked, count: capsule?.likeCount ?? 0, pop: 0 };

  const save = async (liked: boolean) => {
    if (!capsule || saving.current || current.liked === liked) return;
    saving.current = true;
    const prev = { ...current, id: capsule.id };
    setChanged({ ...prev, liked, count: Math.max(0, prev.count + (liked ? 1 : -1)), pop: liked ? prev.pop + 1 : prev.pop });
    try {
      await setLiked(capsule.id, liked);
    } catch (err) {
      console.error(err);
      setChanged(prev);
      alert('하트를 누르지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      saving.current = false;
    }
  };

  return { liked: current.liked, count: current.count, pop: current.pop, toggle: () => save(!current.liked), like: () => save(true) };
}
