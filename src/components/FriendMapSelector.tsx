import { Link } from 'react-router-dom';
import type { Profile } from '../types/social';
import Avatar from './Avatar';

interface FriendMapSelectorProps {
  me: Profile | null;
  friends: Profile[];
  /** 보고 있는 친구 id. null이면 내 지도 */
  selectedId: string | null;
  onSelect: (friendId: string | null) => void;
  /** 받은 친구 요청 수 (친구 칩에 표시) */
  requestCount?: number;
}

/** 홈 지도 위에서 누구의 지도를 볼지 고르는 칩 목록 */
export default function FriendMapSelector({ me, friends, selectedId, onSelect, requestCount = 0 }: FriendMapSelectorProps) {
  const chip = (active: boolean) =>
    `h-9 shrink-0 pl-1 pr-3 rounded-full flex items-center gap-1.5 shadow-md font-label-md text-label-md transition-colors ${
      active ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-lowest/95 text-on-surface'
    }`;

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-3 px-3">
      <button onClick={() => onSelect(null)} className={chip(selectedId === null)} type="button" aria-pressed={selectedId === null}>
        <Avatar profile={me} size={28} />
        내 지도
      </button>
      {friends.map((f) => (
        <button key={f.id} onClick={() => onSelect(f.id)} className={chip(selectedId === f.id)} type="button" aria-pressed={selectedId === f.id}>
          <Avatar profile={f} size={28} />
          <span className="max-w-[6rem] truncate">{f.displayName}</span>
        </button>
      ))}
      <Link to="/friends" className="h-9 shrink-0 px-3 rounded-full flex items-center gap-1 shadow-md bg-surface-container-lowest/95 text-primary font-label-md text-label-md font-bold">
        <span className="material-symbols-outlined text-[18px]">person_add</span>
        친구
        {requestCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold leading-[18px] text-center" aria-label={`받은 요청 ${requestCount}개`}>
            {requestCount}
          </span>
        )}
      </Link>
    </div>
  );
}
