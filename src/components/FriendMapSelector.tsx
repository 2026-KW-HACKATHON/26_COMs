import { useState } from 'react';
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

/**
 * 홈 지도 위에서 누구의 지도를 볼지 고르는 칩: 나 · 동네 · 친구▸.
 * 친구 칩을 누르면 오른쪽으로 친구 목록이 펼쳐지고(아코디언), 한 번 더 누르면 접힌다
 */
export default function FriendMapSelector({ me, friends, selectedId, onSelect, town, onSelectTown, requestCount = 0 }: FriendMapSelectorProps) {
  const viewingFriend = !town && selectedId !== null;
  // 친구 지도를 보고 있으면 펼친 채로 시작한다
  const [open, setOpen] = useState(viewingFriend);
  const viewing = viewingFriend ? friends.find((f) => f.id === selectedId) : undefined;

  const chip = (active: boolean) =>
    `h-9 shrink-0 pl-1 pr-3 rounded-full flex items-center gap-1.5 shadow-float text-label-md font-semibold transition-colors pressable ${
      active ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface text-gray-700'
    }`;

  // 나·동네로 바꾸면 친구 목록은 접는다
  const selectMine = () => {
    setOpen(false);
    onSelect(null);
  };
  const selectTown = () => {
    setOpen(false);
    onSelectTown();
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-3 px-3">
      <button onClick={selectMine} className={chip(!town && selectedId === null)} type="button" aria-pressed={!town && selectedId === null}>
        <Avatar profile={me} size={28} />나
      </button>
      <button onClick={selectTown} className={chip(town)} type="button" aria-pressed={town}>
        <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center">
          <span className="material-symbols-rounded icon-fill text-[17px]">local_fire_department</span>
        </span>
        동네
      </button>

      <button onClick={() => setOpen((o) => !o)} className={`${chip(viewingFriend)} pr-2`} type="button" aria-expanded={open} aria-controls="friend-map-list">
        {/* 접혀 있을 때 친구 지도를 보고 있으면 그 친구를 보여 준다 */}
        {!open && viewing ? (
          <>
            <Avatar profile={viewing} size={28} />
            <span className="max-w-[6rem] truncate">{viewing.displayName}</span>
          </>
        ) : (
          <>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center ${viewingFriend ? 'bg-white/15' : 'bg-gray-100'}`}>
              <span className="material-symbols-rounded icon-fill text-[17px]">group</span>
            </span>
            친구
          </>
        )}
        {requestCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold leading-[18px] text-center" aria-label={`받은 요청 ${requestCount}개`}>
            {requestCount}
          </span>
        )}
        <span className={`material-symbols-rounded text-[20px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden>
          chevron_right
        </span>
      </button>

      {open && (
        <div id="friend-map-list" className="flex gap-1.5 accordion-in">
          {friends.map((f) => (
            <button key={f.id} onClick={() => onSelect(f.id)} className={chip(!town && selectedId === f.id)} type="button" aria-pressed={!town && selectedId === f.id}>
              <Avatar profile={f} size={28} />
              <span className="max-w-[6rem] truncate">{f.displayName}</span>
            </button>
          ))}
          <Link to="/friends" className="h-9 shrink-0 px-3 rounded-full flex items-center gap-1 shadow-float bg-surface text-gray-700 text-label-md font-semibold pressable">
            <span className="material-symbols-rounded text-[18px]">person_add</span>
            {friends.length ? '친구 추가' : '친구 찾기'}
          </Link>
        </div>
      )}
    </div>
  );
}
