import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Profile } from '../types/social';
import Avatar from './Avatar';

interface FriendTagPickerProps {
  /** 태그할 수 있는 친구 (불러오는 중이면 null) */
  friends: Profile[] | null;
  selected: Profile[];
  onChange: (selected: Profile[]) => void;
}

/** 인스타그램 태그처럼 함께한 친구를 검색해서 고른다 */
export default function FriendTagPicker({ friends, selected, onChange }: FriendTagPickerProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().replace(/^@/, '').toLowerCase();
  const selectedIds = new Set(selected.map((f) => f.id));
  const visible = (friends ?? []).filter((f) => !q || f.username.includes(q) || f.displayName.toLowerCase().includes(q));

  const toggle = (friend: Profile) =>
    onChange(selectedIds.has(friend.id) ? selected.filter((f) => f.id !== friend.id) : [...selected, friend]);

  if (friends && friends.length === 0) {
    return (
      <p className="font-label-md text-label-md text-on-surface-variant">
        아직 친구가 없어요.{' '}
        <Link to="/friends" className="text-primary font-bold underline underline-offset-2">
          친구 추가하기
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((f) => (
            <button
              key={f.id}
              onClick={() => toggle(f)}
              className="h-8 pl-1 pr-2 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md flex items-center gap-1"
              type="button"
              aria-label={`${f.displayName} 태그 빼기`}
            >
              <Avatar profile={f} size={24} />
              <span className="font-bold">@{f.username}</span>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 h-11 rounded-xl bg-surface-container-low">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">alternate_email</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="친구 이름이나 아이디 검색"
          className="flex-1 min-w-0 bg-transparent outline-none font-body-md text-body-md text-on-surface placeholder:text-outline/70"
        />
      </div>

      {friends === null ? (
        <p className="font-label-sm text-label-sm text-on-surface-variant">친구 목록을 불러오는 중…</p>
      ) : visible.length === 0 ? (
        <p className="font-label-sm text-label-sm text-on-surface-variant">찾는 친구가 없어요.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {visible.map((f) => {
            const on = selectedIds.has(f.id);
            return (
              <button key={f.id} onClick={() => toggle(f)} className="w-14 shrink-0 flex flex-col items-center gap-1" type="button" aria-pressed={on}>
                <span className={`relative rounded-full p-0.5 ${on ? 'ring-2 ring-primary-container' : ''}`}>
                  <Avatar profile={f} size={48} />
                  {on && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary-container text-white flex items-center justify-center ring-2 ring-surface-container-lowest">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </span>
                  )}
                </span>
                <span className={`w-full truncate text-center font-label-sm text-label-sm ${on ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                  {f.displayName}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
