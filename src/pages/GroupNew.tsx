import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import FriendChecklist from '../components/FriendChecklist';
import { useFriendships } from '../hooks/useFriendships';
import { useGroups } from '../hooks/useGroups';
import { GROUP_MAX, GROUP_NAME_MAX, GROUP_SHARING_NOTE, createGroup } from '../lib/groups';

/** 새 그룹: 이름을 정하고 친구를 초대한다 (나 포함 8명까지) */
export default function GroupNew() {
  const navigate = useNavigate();
  const { list: friendships } = useFriendships();
  const friends = useMemo(() => friendships?.filter((f) => f.status === 'friend') ?? null, [friendships]);
  const { reload } = useGroups();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && selected.length > 0 && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const id = await createGroup(trimmed, selected);
      await reload();
      navigate(`/groups/${id}`, { replace: true });
    } catch (err) {
      console.error(err);
      setError('그룹을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col w-full pt-4 pb-8 gap-6">
      <section className="flex flex-col gap-2">
        <label htmlFor="group-name" className="px-1 text-headline-sm text-on-surface">
          그룹 이름
        </label>
        <div className="flex items-center gap-2 px-4 h-12 rounded-xl bg-gray-100">
          <input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={GROUP_NAME_MAX}
            placeholder="예: 월계 맛집 탐험대"
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-gray-400"
          />
          <span className="text-label-sm text-gray-400">
            {name.length}/{GROUP_NAME_MAX}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-headline-sm text-on-surface">초대할 친구</h2>
          <span className="text-label-md text-on-surface-variant">
            {selected.length}/{GROUP_MAX - 1}명
          </span>
        </div>
        <p className="px-1 text-label-md text-on-surface-variant">초대를 수락한 친구부터 그룹 지도에 함께 칠해져요. {GROUP_SHARING_NOTE}</p>
        <FriendChecklist
          friends={friends}
          selected={selected}
          onChange={setSelected}
          max={GROUP_MAX - 1}
          emptyText="그룹은 친구를 초대해서 만들어요. 먼저 같은 동네 친구를 추가해 보세요."
        />
      </section>

      {error && <p className="text-label-md text-error">{error}</p>}

      <button
        disabled={!canSubmit}
        className="h-14 rounded-2xl bg-primary text-on-primary text-[16px] font-bold flex items-center justify-center gap-1.5 pressable disabled:opacity-40"
        type="submit"
      >
        {busy ? '만드는 중…' : selected.length ? `${selected.length}명 초대하고 그룹 만들기` : '그룹 만들기'}
      </button>
    </form>
  );
}
