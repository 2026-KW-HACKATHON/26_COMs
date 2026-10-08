import { Link } from 'react-router-dom';
import type { Profile } from '../types/social';
import Avatar from './Avatar';

interface FriendMapSelectorProps {
  me: Profile | null;
  friends: Profile[];
  /** 보고 있는 친구 id. null이면 내 지도 (town이면 동네 지도) */
  selectedId: string | null;
  onSelect: (friendId: string | null) => void;
  /** 동네 지도(모두의 방문 수)를 보고 있는지 */
  town: boolean;
  onSelectTown: () => void;
  /** 받은 친구 요청 수 (친구 칩에 표시) */
  requestCount?: number;
}

/** 홈 지도 위에서 누구의 지도를 볼지 고르는 칩 목록 */
export default function FriendMapSelector({ me, friends, selectedId, onSelect, town, onSelectTown, requestCount = 0 }: FriendMapSelectorProps) {
  const chip = (active: boolean) =>
    `h-10 shrink-0 pl-1.5 pr-3.5 rounded-lg flex items-center gap-1.5 shadow-float text-label-md font-semibold transition-colors pressable ${
      active ? 'bg-inverse-surface text-inverse-on-surface' : 'fill-neutral text-gray-700'
    }`;

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-3 px-3">
      <button onClick={() => onSelect(null)} className={chip(!town && selectedId === null)} type="button" aria-pressed={!town && selectedId === null}>
        <Avatar profile={me} size={28} />
        내 지도
      </button>
      <button onClick={onSelectTown} className={chip(town)} type="button" aria-pressed={town}>
        <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center">
          <span className="material-symbols-rounded icon-fill text-[17px]">local_fire_department</span>
        </span>
        동네
      </button>
      {friends.map((f) => (
        <button key={f.id} onClick={() => onSelect(f.id)} className={chip(!town && selectedId === f.id)} type="button" aria-pressed={!town && selectedId === f.id}>
          <Avatar profile={f} size={28} />
          <span className="max-w-[6rem] truncate">{f.displayName}</span>
        </button>
      ))}
      <Link to="/friends" className="h-10 shrink-0 px-3.5 rounded-lg flex items-center gap-1 shadow-float fill-neutral text-gray-700 text-label-md font-semibold pressable">
        <span className="material-symbols-rounded text-[18px]">person_add</span>
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
