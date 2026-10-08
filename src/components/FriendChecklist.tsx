import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Profile } from '../types/social';
import Avatar from './Avatar';

interface FriendChecklistProps {
  /** 고를 수 있는 친구 (불러오는 중이면 null) */
  friends: Profile[] | null;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** 최대 몇 명까지 고를 수 있는지 */
  max: number;
  /** 고를 친구가 없을 때 안내 */
  emptyText: string;
}

/** 그룹에 초대할 친구 고르기 (여러 명) */
export default function FriendChecklist({ friends, selected, onChange, max, emptyText }: FriendChecklistProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().replace(/^@/, '').toLowerCase();
  const chosen = new Set(selected);
  const visible = (friends ?? []).filter((f) => !q || f.username.includes(q) || f.displayName.toLowerCase().includes(q));
  const full = selected.length >= max;

  const toggle = (id: string) => onChange(chosen.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  if (friends === null) return <p className="text-label-md text-on-surface-variant">친구 목록을 불러오는 중…</p>;
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 p-4 flat-card">
        <p className="text-label-md text-on-surface-variant">{emptyText}</p>
        <Link to="/friends" className="h-9 px-3.5 rounded-full bg-primary text-on-primary text-label-md font-bold flex items-center gap-1 pressable">
          <span className="material-symbols-rounded text-[18px]">person_add</span>
          친구 찾기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {friends.length > 6 && (
        <div className="mb-1 flex items-center gap-2 px-4 h-12 rounded-xl bg-gray-100">
          <span className="material-symbols-rounded text-[20px] text-gray-400">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="친구 이름이나 아이디 검색"
            autoCapitalize="none"
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-gray-400"
          />
        </div>
      )}
      {visible.length === 0 ? (
        <p className="px-1 py-2 text-label-md text-on-surface-variant">찾는 친구가 없어요.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visible.map((f) => {
            const on = chosen.has(f.id);
            return (
              <li key={f.id}>
                <button
                  onClick={() => toggle(f.id)}
                  disabled={!on && full}
                  className="w-full flex items-center gap-3 px-1 py-2.5 text-left disabled:opacity-40"
                  type="button"
                  aria-pressed={on}
                >
                  <Avatar profile={f} size={40} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-label-lg font-bold text-on-surface truncate">{f.displayName}</span>
                    <span className="block text-label-sm text-on-surface-variant truncate">@{f.username}</span>
                  </span>
                  <span
                    className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                      on ? 'bg-primary text-on-primary' : 'border-2 border-gray-300'
                    }`}
                  >
                    {on && <span className="material-symbols-rounded text-[16px]">check</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
