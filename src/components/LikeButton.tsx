import type { Like } from '../hooks/useLike';

/** 하트 버튼: 누르면 채워지며 톡 튀고 숫자가 오른다 (상태는 useLike) */
export default function LikeButton({ like }: { like: Like }) {
  return (
    <button
      onClick={like.toggle}
      className="h-10 -ml-1.5 pl-1.5 pr-2 rounded-lg flex items-center gap-1 text-label-lg text-on-surface pressable"
      type="button"
      aria-pressed={like.liked}
      aria-label={like.count ? `하트 ${like.count}개` : '하트'}
    >
      <span
        key={like.pop}
        className={`material-symbols-rounded text-[28px] ${like.liked ? `icon-fill text-error ${like.pop ? 'like-pop' : ''}` : 'text-gray-700'}`}
      >
        favorite
      </span>
      {like.count > 0 && <span className="font-bold tabular-nums">{like.count}</span>}
    </button>
  );
}
